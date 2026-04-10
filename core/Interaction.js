// Interaction.js - Grab/Drop system (inspired by webxr_xr_dragging)
import * as THREE from 'three';
import { PhysicsBody, VelocityTracker } from './PhysicsBody.js';

export class Interaction {
  constructor(sceneManager, levelManager, audioManager, sphereGenerator) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.levelManager = levelManager;
    this.audio = audioManager;
    this.sphereGenerator = sphereGenerator;

    // GunMode ref - set sau khi GunMode khởi tạo
    this.gunMode = null;

    // Per-controller grab state
    this.grabState = [
      { isGrabbing: false, grabbed: null, previousPosition: new THREE.Vector3(), tracker: new VelocityTracker() },
      { isGrabbing: false, grabbed: null, previousPosition: new THREE.Vector3(), tracker: new VelocityTracker() },
    ];
    this.physicsBodies = [];

    this._raycaster = new THREE.Raycaster();
    this._tempMatrix = new THREE.Matrix4();
    this._worldPos = new THREE.Vector3();

    this._bindEvents();
  }

  /** Gọi từ main.js sau khi GunMode được tạo */
  setGunMode(gm) {
    this.gunMode = gm;
  }

  _bindEvents() {
    for (let i = 0; i < 2; i++) {
      const controller = this.sceneManager.getController(i);
      controller.addEventListener('selectstart', (e) => this._onGrab(i, e));
      controller.addEventListener('selectend', (e) => this._onRelease(i, e));
    }
  }

  _onGrab(controllerIndex, event) {
    // Right controller (1) không grab khi gun mode active
    if (controllerIndex === 1 && this.gunMode?.isActive) return;

    const controller = this.sceneManager.getController(controllerIndex);
    const state = this.grabState[controllerIndex];

    if (state.isGrabbing) return;

    const closest = this._findClosestSphere(controller);
    if (!closest) return;

    const { sphere, distance } = closest;
    if (distance > 0.25 || sphere.userData.isLocked) return;

    state.isGrabbing = true;
    state.tracker.reset();
    state.grabbed = sphere;
    state.previousPosition.copy(sphere.position);
    sphere.userData.isGrabbed = true;

    controller.attach(sphere);
    sphere.scale.set(0.9, 0.9, 0.9);
    this._hapticPulse(controllerIndex, 0.3, 80);
  }

  _onRelease(controllerIndex, event) {
    // Right controller (1) không release grab khi gun mode active (không grab được)
    if (controllerIndex === 1 && this.gunMode?.isActive) return;

    const controller = this.sceneManager.getController(controllerIndex);
    const state = this.grabState[controllerIndex];

    if (!state.isGrabbing || !state.grabbed) return;

    const sphere = state.grabbed;
    sphere.userData.isGrabbed = false;
    sphere.scale.set(1, 1, 1);

    const vel = state.tracker.compute();

    this.scene.attach(sphere);
    state.isGrabbing = false;
    state.grabbed = null;

    // Nếu left hand thả vào gần right controller và gun mode active → nạp đạn
    if (controllerIndex === 0 && this.gunMode?.isActive) {
      const rightCtrl = this.sceneManager.getController(1);
      const rightPos = new THREE.Vector3();
      rightCtrl.getWorldPosition(rightPos);

      sphere.getWorldPosition(this._worldPos);
      const distToRight = this._worldPos.distanceTo(rightPos);

      if (distToRight < 0.3) {
        // Nạp đạn
        this.gunMode.loadAmmo(sphere.userData.color);
        this.scene.remove(sphere);
        this.sphereGenerator.activeSpheres = this.sphereGenerator.activeSpheres.filter(
          (s) => s !== sphere
        );
        this._hapticPulse(0, 0.5, 120);
        return;
      }
    }

    // Logic drop bình thường
    sphere.getWorldPosition(this._worldPos);
    const result = this.levelManager.checkDrop(sphere, this._worldPos);

    if (result) {
      if (result.colorMatch) {
        this._onCorrectDrop(sphere, result.slot, controllerIndex);
      } else {
        this._onWrongDrop(sphere, controllerIndex);
      }
    } else {
      if (vel.length() > 0.1) {
        this.physicsBodies.push(new PhysicsBody(sphere, vel));
      }
    }
  }

  _onCorrectDrop(sphere, slot, controllerIndex) {
    const slotPos = new THREE.Vector3();
    slot.mesh.getWorldPosition(slotPos);

    const soundObj = this.audio.playCorrect(slotPos);
    if (soundObj) this.scene.add(soundObj);

    this.levelManager.fillSlot(slot, sphere);
    this._hapticPulse(controllerIndex, 0.8, 200);

    this.sphereGenerator.activeSpheres = this.sphereGenerator.activeSpheres.filter(
      (s) => s !== sphere
    );
  }

  _onWrongDrop(sphere, controllerIndex) {
    const controller = this.sceneManager.getController(controllerIndex);
    const ctrlPos = new THREE.Vector3();
    controller.getWorldPosition(ctrlPos);

    const soundObj = this.audio.playFail(ctrlPos);
    if (soundObj) this.scene.add(soundObj);

    this._hapticPulse(controllerIndex, 1.0, 300);
    this._rejectSphere(sphere);
  }

  _rejectSphere(sphere) {
    const startPos = sphere.position.clone();
    const rejectDir = sphere.position.clone().normalize();
    rejectDir.y += 0.3;
    const endPos = startPos.clone().addScaledVector(rejectDir, 0.2);

    const start = performance.now();
    const anim = () => {
      const t = Math.min((performance.now() - start) / 300, 1);
      const ease = Math.sin(t * Math.PI) * (1 - t);
      sphere.position.lerpVectors(startPos, endPos, ease);

      if (sphere.material) {
        sphere.material.emissiveIntensity = 0.5 * (1 - t);
      }

      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }

  _findClosestSphere(controller) {
    const spheres = this.sphereGenerator.getActiveSpheres();
    if (!spheres.length) return null;

    const ctrlPos = new THREE.Vector3();
    controller.getWorldPosition(ctrlPos);

    let closest = null;
    let minDist = Infinity;

    for (const sphere of spheres) {
      if (sphere.userData.isLocked) continue;
      const sphereWorld = new THREE.Vector3();
      sphere.getWorldPosition(sphereWorld);
      const dist = ctrlPos.distanceTo(sphereWorld);
      if (dist < minDist) {
        minDist = dist;
        closest = sphere;
      }
    }

    return closest ? { sphere: closest, distance: minDist } : null;
  }

  _hapticPulse(controllerIndex, intensity = 0.5, durationMs = 100) {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;
      const handedness = controllerIndex === 0 ? 'left' : 'right';
      let source = null;
      for (const s of session.inputSources) {
        if (s.handedness === handedness) { source = s; break; }
      }
      if (source?.gamepad?.hapticActuators?.[0]) {
        source.gamepad.hapticActuators[0].pulse(intensity, durationMs);
      }
    } catch (e) {}
  }

  updateLocomotion(delta, speed = 2.0) {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;

      let leftSource = null;
      let count = 0;
      for (const s of session.inputSources) {
        if (s.handedness === 'left') { leftSource = s; break; }
        count++;
      }

      if (!leftSource?.gamepad) return;

      const axes = leftSource.gamepad.axes;
      if (!axes || axes.length < 4) return;

      const x = axes[2];
      const y = axes[3];

      if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return;

      const camera = this.sceneManager.camera;
      const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
      const right = new THREE.Vector3(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));

      const move = new THREE.Vector3();
      move.addScaledVector(right, x * speed * delta);
      move.addScaledVector(forward, -y * speed * delta);

      const refSpace = this.sceneManager.getReferenceSpace();
      if (refSpace) {
        const offset = new XRRigidTransform({ x: -move.x, y: 0, z: -move.z, w: 1 });
        const newRefSpace = refSpace.getOffsetReferenceSpace(offset);
        this.sceneManager.renderer.xr.setReferenceSpace(newRefSpace);
      }
    } catch (e) {}
  }

  update(delta) {
    for (const state of this.grabState) {
      if (state.isGrabbing && state.grabbed) {
        const worldPos = new THREE.Vector3();
        state.grabbed.getWorldPosition(worldPos);
        state.tracker.record(worldPos);
      }
    }

    this.physicsBodies = this.physicsBodies.filter((body) => {
      body.update(delta);

      if (body.active && !body.mesh.userData.isLocked) {
        body.mesh.getWorldPosition(this._worldPos);
        const result = this.levelManager.checkDrop(body.mesh, this._worldPos);
        if (result) {
          if (result.colorMatch) {
            this._onCorrectDrop(body.mesh, result.slot, 0);
          } else {
            this._onWrongDrop(body.mesh, 0);
          }
          body.active = false;
          return false;
        }
      }

      return body.active;
    });
  }
}