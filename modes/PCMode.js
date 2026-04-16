// modes/PCMode.js - PC input layer: mouse look, WASD movement, virtual hands, gun toggle
import * as THREE from 'three';

const MOVE_SPEED    = 3.0;   // m/s
const HAND_OFFSET_L = new THREE.Vector3(-0.18, -0.18, -0.5);
const HAND_OFFSET_R = new THREE.Vector3( 0.18, -0.18, -0.5);

export class PCMode {
  /**
   * @param {object} sceneManager
   * @param {import('../core/GrabSystem.js').GrabSystem} grabSystem
   * @param {import('../core/GunMode.js').GunMode} gunMode
   */
  constructor(sceneManager, grabSystem, gunMode) {
    this.sceneManager = sceneManager;
    this.scene        = sceneManager.scene;
    this.camera       = sceneManager.camera;
    this.grabSystem   = grabSystem;
    this.gunMode      = gunMode;

    // Virtual hands (Object3D gắn vào camera)
    this.leftHand  = new THREE.Object3D();
    this.rightHand = new THREE.Object3D();
    this.camera.add(this.leftHand);
    this.camera.add(this.rightHand);
    this.leftHand.position.copy(HAND_OFFSET_L);
    this.rightHand.position.copy(HAND_OFFSET_R);

    // Visual hand meshes
    this._buildHandVisuals();

    // Input state
    this._keys     = {};
    this._yaw      = 0;
    this._pitch    = 0;
    this._isLocked = false;

    // Debounce Q
    this._qWasPressed = false;

    this._bindEvents();
    this._buildCrosshair();
  }

  // ─── Visual ───────────────────────────────────────────────────────────────

  _buildHandVisuals() {
    const geo  = new THREE.SphereGeometry(0.04, 10, 10);

    const matL = new THREE.MeshPhysicalMaterial({ color: 0x88aaff, roughness: 0.4, metalness: 0.2 });
    this._leftMesh = new THREE.Mesh(geo, matL);
    this.leftHand.add(this._leftMesh);

    const matR = new THREE.MeshPhysicalMaterial({ color: 0xff8844, roughness: 0.4, metalness: 0.2 });
    this._rightMesh = new THREE.Mesh(geo, matR);
    this.rightHand.add(this._rightMesh);
  }

  _buildCrosshair() {
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

    // Mouse buttons: left(0) = left hand / fire; right(2) = right hand
    document.addEventListener('mousedown', (e) => {
      if (!this._isLocked) return;
      if (e.button === 0) this._onMouseDown(0);
      if (e.button === 2) this._onMouseDown(1);
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
    // Gun mode: left click = fire
    if (this.gunMode?.isActive) {
      if (handIndex === 0) this.gunMode.fire(this.camera);
      return;
    }

    const hand = this._getHand(handIndex);
    this.grabSystem.grabSphere(handIndex, hand);
  }

  _onMouseUp(handIndex) {
    const hand      = this._getHand(handIndex);
    const otherHand = this._getHand(handIndex === 0 ? 1 : 0);
    this.grabSystem.releaseSphere(handIndex, hand, otherHand);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(delta) {
    if (!this._isLocked) return;

    // Camera rotation
    const euler = new THREE.Euler(this._pitch, this._yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // Movement
    const move = new THREE.Vector3();
    if (this._keys['KeyW'] || this._keys['ArrowUp'])    move.z -= 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  move.z += 1;
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  move.x -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) move.x += 1;
    if (this._keys['Space'])  move.y += 1;
    if (this._keys['KeyC'])   move.y -= 1;

    if (move.length() > 0) {
      move.normalize();
      const yawQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this._yaw, 0));
      move.applyQuaternion(yawQ);
      this.camera.position.addScaledVector(move, MOVE_SPEED * delta);
    }

    // Toggle GunMode bằng Q
    const qPressed = this._keys['KeyQ'] ?? false;
    if (qPressed && !this._qWasPressed) {
      this.gunMode?.toggle({ attachTo: this.rightHand });
    }
    this._qWasPressed = qPressed;
  }

  // ─── Dispose ──────────────────────────────────────────────────────────────

  dispose() {
    document.exitPointerLock();
    this._crosshair?.remove();
    this.camera.remove(this.leftHand);
    this.camera.remove(this.rightHand);
  }
}