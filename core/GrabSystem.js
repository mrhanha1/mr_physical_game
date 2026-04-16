// core/GrabSystem.js - Shared grab/drop/physics logic cho cả VR và PC mode
import * as THREE from 'three';
import { PhysicsBody, VelocityTracker } from './PhysicsBody.js';

const GRAB_RADIUS = 0.25;

export class GrabSystem {
  /**
   * @param {object} sceneManager
   * @param {object} levelManager
   * @param {object} audioManager
   * @param {object} sphereGenerator
   */
  constructor(sceneManager, levelManager, audioManager, sphereGenerator) {
    this.sceneManager    = sceneManager;
    this.scene           = sceneManager.scene;
    this.levelManager    = levelManager;
    this.audio           = audioManager;
    this.sphereGenerator = sphereGenerator;

    // GunMode ref — set sau khi GunMode khởi tạo
    this.gunMode = null;

    // Per-hand grab state [0=left, 1=right]
    this.grabState = [
      { isGrabbing: false, grabbed: null, tracker: new VelocityTracker() },
      { isGrabbing: false, grabbed: null, tracker: new VelocityTracker() },
    ];

    this.physicsBodies = [];
    this._worldPos = new THREE.Vector3();
  }

  /** Gọi từ main.js sau khi GunMode được tạo */
  setGunMode(gm) {
    this.gunMode = gm;
  }

  // ─── Grab ─────────────────────────────────────────────────────────────────

  /**
   * Thử grab sphere gần nhất với hand object3D.
   * @param {number} handIndex  0=left, 1=right
   * @param {THREE.Object3D} handObject  Object3D đại diện cho bàn tay (controller hoặc virtual hand)
   * @returns {boolean} true nếu grab thành công
   */
  grabSphere(handIndex, handObject) {
    // Right hand không grab khi gun mode active
    if (handIndex === 1 && this.gunMode?.isActive) return false;

    const state = this.grabState[handIndex];
    if (state.isGrabbing) return false;

    const handWorld = new THREE.Vector3();
    handObject.getWorldPosition(handWorld);

    const spheres = this.sphereGenerator.getActiveSpheres();
    let closest = null, minDist = Infinity;

    for (const s of spheres) {
      if (s.userData.isLocked || s.userData.isGrabbed) continue;
      const sp = new THREE.Vector3();
      s.getWorldPosition(sp);
      const d = handWorld.distanceTo(sp);
      if (d < minDist) { minDist = d; closest = s; }
    }

    if (!closest || minDist > GRAB_RADIUS) return false;

    state.isGrabbing = true;
    state.grabbed    = closest;
    state.tracker.reset();
    closest.userData.isGrabbed = true;
    handObject.attach(closest);
    closest.scale.set(0.9, 0.9, 0.9);
    return true;
  }

  // ─── Release ──────────────────────────────────────────────────────────────

  /**
   * Thả sphere đang cầm.
   * @param {number} handIndex  0=left, 1=right
   * @param {THREE.Object3D} handObject
   * @param {THREE.Object3D|null} otherHandObject  Bàn tay còn lại (để check load ammo)
   */
  releaseSphere(handIndex, handObject, otherHandObject = null) {
    // Right hand không được release khi gun mode active (không grab được)
    if (handIndex === 1 && this.gunMode?.isActive) return;

    const state = this.grabState[handIndex];
    if (!state.isGrabbing || !state.grabbed) return;

    const sphere = state.grabbed;
    sphere.userData.isGrabbed = false;
    sphere.scale.set(1, 1, 1);

    const vel = state.tracker.compute();
    this.scene.attach(sphere);
    state.isGrabbing = false;
    state.grabbed    = null;

    // Left hand thả gần right hand + gun active → load ammo
    if (handIndex === 0 && this.gunMode?.isActive && otherHandObject) {
      const rightWorld = new THREE.Vector3();
      otherHandObject.getWorldPosition(rightWorld);
      sphere.getWorldPosition(this._worldPos);

      if (this._worldPos.distanceTo(rightWorld) < 0.3) {
        this.gunMode.loadAmmo(sphere.userData.color, sphere.userData.colorIndex);
        this.scene.remove(sphere);
        this.sphereGenerator.activeSpheres =
          this.sphereGenerator.activeSpheres.filter(s => s !== sphere);
        return;
      }
    }

    // Drop bình thường
    sphere.getWorldPosition(this._worldPos);
    const result = this.levelManager.checkDrop(sphere, this._worldPos);

    if (result) {
      if (result.colorMatch) {
        this._onCorrectDrop(sphere, result.slot);
      } else {
        this._onWrongDrop(sphere);
      }
    } else if (vel.length() > 0.1) {
      this.physicsBodies.push(new PhysicsBody(sphere, vel));
    }
  }

  // ─── Drop callbacks ───────────────────────────────────────────────────────

  _onCorrectDrop(sphere, slot) {
    const slotPos = new THREE.Vector3();
    slot.mesh.getWorldPosition(slotPos);

    const soundObj = this.audio.playCorrect(slotPos);
    if (soundObj) this.scene.add(soundObj);

    this.levelManager.fillSlot(slot, sphere);

    this.sphereGenerator.activeSpheres =
      this.sphereGenerator.activeSpheres.filter(s => s !== sphere);
  }

  _onWrongDrop(sphere) {
    const soundObj = this.audio.playFail(sphere.position.clone());
    if (soundObj) this.scene.add(soundObj);

    this._rejectSphere(sphere);
  }

  _rejectSphere(sphere) {
    const startPos  = sphere.position.clone();
    const rejectDir = sphere.position.clone().normalize();
    rejectDir.y += 0.3;
    const endPos = startPos.clone().addScaledVector(rejectDir, 0.2);

    const start = performance.now();
    const anim  = () => {
      const t    = Math.min((performance.now() - start) / 300, 1);
      const ease = Math.sin(t * Math.PI) * (1 - t);
      sphere.position.lerpVectors(startPos, endPos, ease);

      if (sphere.material) sphere.material.emissiveIntensity = 0.5 * (1 - t);

      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  handOffToPhysics(sphere, velocity) {
    this.physicsBodies.push(new PhysicsBody(sphere, velocity));
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Gọi mỗi frame — track velocity của sphere đang cầm + simulate physics sphere đã thả.
   * @param {number} delta
   */
  update(delta) {
    // Velocity tracking
    for (const state of this.grabState) {
      if (state.isGrabbing && state.grabbed) {
        const wp = new THREE.Vector3();
        state.grabbed.getWorldPosition(wp);
        state.tracker.record(wp);
      }
    }

    // Physics simulation
    this.physicsBodies = this.physicsBodies.filter((body) => {
      body.update(delta);

      if (body.active && !body.mesh.userData.isLocked) {
        body.mesh.getWorldPosition(this._worldPos);
        const result = this.levelManager.checkDrop(body.mesh, this._worldPos);
        if (result) {
          if (result.colorMatch) {
            this._onCorrectDrop(body.mesh, result.slot);
          } else {
            this._onWrongDrop(body.mesh);
          }
          body.active = false;
          return false;
        }
      }

      // Xóa nếu rơi quá sàn
      if (body.mesh.position.y < -2) {
        this.scene.remove(body.mesh);
        this.sphereGenerator.activeSpheres =
          this.sphereGenerator.activeSpheres.filter(s => s !== body.mesh);
        return false;
      }

      return body.active;
    });
  }
}
