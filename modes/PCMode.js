// modes/PCMode.js - PC keyboard/mouse/controller mode
import * as THREE from 'three';
import { PhysicsBody, VelocityTracker } from '../core/PhysicsBody.js';

const MOVE_SPEED   = 3.0;   // m/s
const HAND_OFFSET_L = new THREE.Vector3(-0.18, -0.18, -0.5);
const HAND_OFFSET_R = new THREE.Vector3( 0.18, -0.18, -0.5);
const GRAB_RADIUS   = 0.25;

export class PCMode {
  constructor(sceneManager, sphereGenerator, levelManager, audioManager, gunMode) {
    this.sceneManager    = sceneManager;
    this.scene           = sceneManager.scene;
    this.camera          = sceneManager.camera;
    this.sphereGenerator = sphereGenerator;
    this.levelManager    = levelManager;
    this.audio           = audioManager;
    this.gunMode         = gunMode;

    // Virtual hands (Object3D gắn vào camera)
    this.leftHand  = new THREE.Object3D();
    this.rightHand = new THREE.Object3D();
    this.camera.add(this.leftHand);
    this.camera.add(this.rightHand);
    this.leftHand.position.copy(HAND_OFFSET_L);
    this.rightHand.position.copy(HAND_OFFSET_R);

    // Visual hand meshes
    this._buildHandVisuals();

    // Grab state cho 2 tay
    this.grabState = [
      { isGrabbing: false, grabbed: null, tracker: new VelocityTracker() }, // left (0)
      { isGrabbing: false, grabbed: null, tracker: new VelocityTracker() }, // right (1)
    ];
    this.physicsBodies = [];

    // Input state
    this._keys     = {};
    this._yaw      = 0;   // camera horizontal rotation (radian)
    this._pitch    = 0;   // camera vertical rotation (radian)
    this._isLocked = false;

    // Debounce Q
    this._qWasPressed = false;

    this._worldPos = new THREE.Vector3();

    this._bindEvents();
    this._buildCrosshair();
  }

  // ─── Visual ───────────────────────────────────────────────────────────────

  _buildHandVisuals() {
    const geo = new THREE.SphereGeometry(0.04, 10, 10);

    const matL = new THREE.MeshPhysicalMaterial({ color: 0x88aaff, roughness: 0.4, metalness: 0.2 });
    this._leftMesh = new THREE.Mesh(geo, matL);
    this.leftHand.add(this._leftMesh);

    const matR = new THREE.MeshPhysicalMaterial({ color: 0xff8844, roughness: 0.4, metalness: 0.2 });
    this._rightMesh = new THREE.Mesh(geo, matR);
    this.rightHand.add(this._rightMesh);
  }

  _buildCrosshair() {
    // Crosshair đơn giản bằng HTML overlay
    const el = document.createElement('div');
    el.id = 'pc-crosshair';
    el.style.cssText = `
      position:fixed; top:50%; left:50%;
      transform:translate(-50%,-50%);
      width:16px; height:16px;
      pointer-events:none; display:none; z-index:999;
    `;
    el.innerHTML = `
      <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <line x1="8" y1="2" x2="8" y2="14" stroke="white" stroke-width="1.5" opacity="0.8"/>
        <line x1="2" y1="8" x2="14" y2="8" stroke="white" stroke-width="1.5" opacity="0.8"/>
        <circle cx="8" cy="8" r="2" fill="none" stroke="white" stroke-width="1" opacity="0.6"/>
      </svg>`;
    document.body.appendChild(el);
    this._crosshair = el;
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  _bindEvents() {
    const canvas = this.sceneManager.renderer.domElement;

    // Pointer Lock
    canvas.addEventListener('click', () => {
      if (!this._isLocked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this._isLocked = document.pointerLockElement === canvas;
      if (this._crosshair) this._crosshair.style.display = this._isLocked ? 'block' : 'none';
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
      if (!this._isLocked) return;
      this._yaw   -= e.movementX * 0.002;
      this._pitch -= e.movementY * 0.002;
      this._pitch  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this._pitch));
    });

    // Keyboard
    document.addEventListener('keydown', (e) => { this._keys[e.code] = true;  });
    document.addEventListener('keyup',   (e) => { this._keys[e.code] = false; });

    // Mouse buttons
    // Left click (0) = left hand grab / gun fire
    // Right click (2) = right hand grab / gun loadAmmo trigger (load via right)
    document.addEventListener('mousedown', (e) => {
      if (!this._isLocked) return;
      if (e.button === 0) this._onMouseDown(0);  // left click → left hand
      if (e.button === 2) this._onMouseDown(1);  // right click → right hand
    });
    document.addEventListener('mouseup', (e) => {
      if (!this._isLocked) return;
      if (e.button === 0) this._onMouseUp(0);
      if (e.button === 2) this._onMouseUp(1);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ─── Grab / Release ────────────────────────────────────────────────────────

  _getHand(index) {
    return index === 0 ? this.leftHand : this.rightHand;
  }

  _onMouseDown(handIndex) {
    // Gun mode: left click = fire, right click = không dùng
    if (this.gunMode?.isActive) {
      if (handIndex === 0) this.gunMode.firePCMode(this.camera);
      return;
    }

    const hand  = this._getHand(handIndex);
    const state = this.grabState[handIndex];
    if (state.isGrabbing) return;

    const handWorld = new THREE.Vector3();
    hand.getWorldPosition(handWorld);

    const spheres = this.sphereGenerator.getActiveSpheres();
    let closest = null, minDist = Infinity;

    for (const s of spheres) {
      if (s.userData.isLocked || s.userData.isGrabbed) continue;
      const sp = new THREE.Vector3();
      s.getWorldPosition(sp);
      const d = handWorld.distanceTo(sp);
      if (d < minDist) { minDist = d; closest = s; }
    }

    if (!closest || minDist > GRAB_RADIUS) return;

    state.isGrabbing = true;
    state.grabbed    = closest;
    state.tracker.reset();
    closest.userData.isGrabbed = true;
    hand.attach(closest);
    closest.scale.set(0.9, 0.9, 0.9);
  }

  _onMouseUp(handIndex) {
    const hand  = this._getHand(handIndex);
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
    if (handIndex === 0 && this.gunMode?.isActive) {
      const rightWorld = new THREE.Vector3();
      this.rightHand.getWorldPosition(rightWorld);
      sphere.getWorldPosition(this._worldPos);

      if (this._worldPos.distanceTo(rightWorld) < 0.3) {
        this.gunMode.loadAmmo(sphere.userData.color);
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

  _onCorrectDrop(sphere, slot) {
    const slotPos = new THREE.Vector3();
    slot.mesh.getWorldPosition(slotPos);
    const snd = this.audio.playCorrect(slotPos);
    if (snd) this.scene.add(snd);
    this.levelManager.fillSlot(slot, sphere);
    this.sphereGenerator.activeSpheres =
      this.sphereGenerator.activeSpheres.filter(s => s !== sphere);
  }

  _onWrongDrop(sphere) {
    const snd = this.audio.playFail(sphere.position.clone());
    if (snd) this.scene.add(snd);
    // Bounce nhỏ
    const dir = sphere.position.clone().normalize();
    dir.y += 0.3;
    this.physicsBodies.push(new PhysicsBody(sphere, dir.multiplyScalar(1.5)));
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(delta) {
    if (!this._isLocked) return;

    // ── Camera rotation ──
    const euler = new THREE.Euler(this._pitch, this._yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // ── Movement ──
    const move = new THREE.Vector3();
    if (this._keys['KeyW'] || this._keys['ArrowUp'])    move.z -= 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  move.z += 1;
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  move.x -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) move.x += 1;
    if (this._keys['Space'])  move.y += 1;
    if (this._keys['KeyC'])   move.y -= 1;

    if (move.length() > 0) {
      move.normalize();
      // Chỉ apply yaw cho horizontal, giữ pitch cho look
      const yawQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this._yaw, 0));
      move.applyQuaternion(yawQ);
      this.camera.position.addScaledVector(move, MOVE_SPEED * delta);
    }

    // ── Toggle GunMode bằng Q ──
    const qPressed = this._keys['KeyQ'] ?? false;
    if (qPressed && !this._qWasPressed) this.gunMode?.togglePCMode(this.camera, this.rightHand);
    this._qWasPressed = qPressed;

    // ── VelocityTracker cho sphere đang cầm ──
    for (const state of this.grabState) {
      if (state.isGrabbing && state.grabbed) {
        const wp = new THREE.Vector3();
        state.grabbed.getWorldPosition(wp);
        state.tracker.record(wp);
      }
    }

    // ── Physics cho sphere đã thả ──
    this.physicsBodies = this.physicsBodies.filter((body) => {
      body.update(delta);
      if (body.active) {
        body.mesh.getWorldPosition(this._worldPos);
        const result = this.levelManager.checkDrop(body.mesh, this._worldPos);
        if (result) {
          if (result.colorMatch) this._onCorrectDrop(body.mesh, result.slot);
          else                   this._onWrongDrop(body.mesh);
          body.active = false;
          return false;
        }
      }
      if (body.mesh.position.y < -2) {
        this.scene.remove(body.mesh);
        this.sphereGenerator.activeSpheres =
          this.sphereGenerator.activeSpheres.filter(s => s !== body.mesh);
        return false;
      }
      return body.active;
    });
  }

  /** Dọn dẹp khi thoát PC mode */
  dispose() {
    document.exitPointerLock();
    this._crosshair?.remove();
    this.camera.remove(this.leftHand);
    this.camera.remove(this.rightHand);
  }
}