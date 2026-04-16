// core/VRInput.js - XR controller input layer (chỉ VR/AR, không chứa game logic)
import * as THREE from 'three';

export class VRInput {
  /**
   * @param {object} sceneManager
   * @param {import('./GrabSystem.js').GrabSystem} grabSystem
   */
  constructor(sceneManager, grabSystem) {
    this.sceneManager = sceneManager;
    this.grabSystem   = grabSystem;

    this._bindEvents();
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  _bindEvents() {
    for (let i = 0; i < 2; i++) {
      const controller = this.sceneManager.getController(i);
      controller.addEventListener('selectstart', () => this._onGrab(i));
      controller.addEventListener('selectend',   () => this._onRelease(i));
    }
  }

  _onGrab(controllerIndex) {
    const controller = this.sceneManager.getController(controllerIndex);
    const grabbed    = this.grabSystem.grabSphere(controllerIndex, controller);
    if (grabbed) this._hapticPulse(controllerIndex, 0.3, 80);
  }

  _onRelease(controllerIndex) {
    const controller  = this.sceneManager.getController(controllerIndex);
    const otherIndex  = controllerIndex === 0 ? 1 : 0;
    const otherCtrl   = this.sceneManager.getController(otherIndex);

    const state = this.grabSystem.grabState[controllerIndex];
    const wasGrabbing = state.isGrabbing;

    this.grabSystem.releaseSphere(controllerIndex, controller, otherCtrl);

    if (wasGrabbing) this._hapticPulse(controllerIndex, 0.15, 40);
  }

  // ─── Locomotion (joystick) ────────────────────────────────────────────────

  updateLocomotion(delta, speed = 2.0) {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;

      let leftSource = null;
      for (const s of session.inputSources) {
        if (s.handedness === 'left') { leftSource = s; break; }
      }
      if (!leftSource?.gamepad) return;

      const axes = leftSource.gamepad.axes;
      if (!axes || axes.length < 4) return;

      const x = axes[2];
      const y = axes[3];
      if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return;

      const camera  = this.sceneManager.camera;
      const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
      const right   = new THREE.Vector3(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));

      const move = new THREE.Vector3();
      move.addScaledVector(right,    x  * speed * delta);
      move.addScaledVector(forward, -y  * speed * delta);

      const refSpace = this.sceneManager.getReferenceSpace();
      if (refSpace) {
        const offset      = new XRRigidTransform({ x: -move.x, y: 0, z: -move.z, w: 1 });
        const newRefSpace = refSpace.getOffsetReferenceSpace(offset);
        this.sceneManager.renderer.xr.setReferenceSpace(newRefSpace);
      }
    } catch (e) {}
  }

  // ─── Haptic ───────────────────────────────────────────────────────────────

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
}
