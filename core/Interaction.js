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
    

    // Per-controller grab state
    this.grabState = [
      { isGrabbing: false, grabbed: null, previousPosition: new THREE.Vector3(),tracker: new VelocityTracker() },
      { isGrabbing: false, grabbed: null, previousPosition: new THREE.Vector3(),tracker: new VelocityTracker() },
    ];
    this.physicsBodies = [];

    this._raycaster = new THREE.Raycaster();
    this._tempMatrix = new THREE.Matrix4();
    this._worldPos = new THREE.Vector3();

    this._bindEvents();
  }

  _bindEvents() {
    for (let i = 0; i < 2; i++) {
      const controller = this.sceneManager.getController(i);

      controller.addEventListener('selectstart', (e) => this._onGrab(i, e));
      controller.addEventListener('selectend', (e) => this._onRelease(i, e));
    }
  }

  _onGrab(controllerIndex, event) {
    const controller = this.sceneManager.getController(controllerIndex);
    const state = this.grabState[controllerIndex];

    if (state.isGrabbing) return;

    // Find closest sphere to controller
    const closest = this._findClosestSphere(controller);
    if (!closest) return;

    const { sphere, distance } = closest;
    if (distance > 0.25 || sphere.userData.isLocked) return;

    state.isGrabbing = true;
    state.tracker.reset();
    state.grabbed = sphere;
    state.previousPosition.copy(sphere.position);
    sphere.userData.isGrabbed = true;

    // Attach sphere to controller in world space
    controller.attach(sphere);

    // Visual feedback - slight scale down
    sphere.scale.set(0.9, 0.9, 0.9);

    // Haptic feedback on grab
    this._hapticPulse(controllerIndex, 0.3, 80);
  }

  _onRelease(controllerIndex, event) {
    const controller = this.sceneManager.getController(controllerIndex);
    const state = this.grabState[controllerIndex];

    if (!state.isGrabbing || !state.grabbed) return;

    const sphere = state.grabbed;
    sphere.userData.isGrabbed = false;
    sphere.scale.set(1, 1, 1);

    // 1. Lưu velocity TRƯỚC khi detach
    const vel = state.tracker.compute();

    // 2. Detach
    this.scene.attach(sphere);
    state.isGrabbing = false;
    state.grabbed = null;

    // 3. Check drop
    sphere.getWorldPosition(this._worldPos);
    const result = this.levelManager.checkDrop(sphere, this._worldPos);

    if (result) {
      if (result.colorMatch) {
        // CORRECT DROP
        this._onCorrectDrop(sphere, result.slot, controllerIndex);
      } else {
        // WRONG COLOR
        this._onWrongDrop(sphere, controllerIndex);
      }
    } else {
      // 4. Không gần slot nào → apply inertia
      if (vel.length() > 0.1) {
        this.physicsBodies.push(new PhysicsBody(sphere, vel));
      }
    }
  }

  _onCorrectDrop(sphere, slot, controllerIndex) {
    // Get slot world position for audio
    const slotPos = new THREE.Vector3();
    slot.mesh.getWorldPosition(slotPos);

    // Play correct sound at slot position
    const soundObj = this.audio.playCorrect(slotPos);
    if (soundObj) this.scene.add(soundObj);

    // Lock sphere into slot
    this.levelManager.fillSlot(slot, sphere);

    // String haptic celebration
    this._hapticPulse(controllerIndex, 0.8, 200);

    // Remove from active spheres list
    this.sphereGenerator.activeSpheres = this.sphereGenerator.activeSpheres.filter(
      (s) => s !== sphere
    );
  }

  _onWrongDrop(sphere, controllerIndex) {
    // Controller world position for audio
    const controller = this.sceneManager.getController(controllerIndex);
    const ctrlPos = new THREE.Vector3();
    controller.getWorldPosition(ctrlPos);

    // Play fail sound at controller
    const soundObj = this.audio.playFail(ctrlPos);
    if (soundObj) this.scene.add(soundObj);

    // Haptic pulse for fail
    this._hapticPulse(controllerIndex, 1.0, 300);

    // Bounce sphere back toward its last resting position
    this._rejectSphere(sphere);
  }

  _rejectSphere(sphere) {
    // Animate the sphere away with a "bounce away" effect
    const startPos = sphere.position.clone();
    const rejectDir = sphere.position.clone().normalize();
    rejectDir.y += 0.3;
    const endPos = startPos.clone().addScaledVector(rejectDir, 0.2);

    const start = performance.now();
    const anim = () => {
      const t = Math.min((performance.now() - start) / 300, 1);
      const ease = Math.sin(t * Math.PI) * (1 - t);
      sphere.position.lerpVectors(startPos, endPos, ease);

      // Red flash
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
      const dist = ctrlPos.distanceTo(sphere.position);
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

      const inputSources = session.inputSources;
      let source = null;
      let count = 0;
      for (const s of inputSources) {
        if (count === controllerIndex) { source = s; break; }
        count++;
      }

      if (source?.gamepad?.hapticActuators?.[0]) {
        source.gamepad.hapticActuators[0].pulse(intensity, durationMs);
      }
    } catch (e) {
      // Haptics not available
    }
  }

  /**
   * Update locomotion from left gamepad - called every frame.
   * @param {number} delta
   * @param {number} speed
   */
  updateLocomotion(delta, speed = 2.0) {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;

      let leftSource = null;
      let count = 0;
      for (const s of session.inputSources) {
        if (count === 0) { leftSource = s; break; }
        count++;
      }

      if (!leftSource?.gamepad) return;

      const axes = leftSource.gamepad.axes;
      if (!axes || axes.length < 4) return;

      // axes[2], axes[3] = left thumbstick X, Y
      const x = axes[2];
      const y = axes[3];

      if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return;

      // Move in camera-relative direction
      const camera = this.sceneManager.camera;
      const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
      const right = new THREE.Vector3(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));

      const move = new THREE.Vector3();
      move.addScaledVector(right, x * speed * delta);
      move.addScaledVector(forward, -y * speed * delta);

      // Apply via XR reference space offset
      const refSpace = this.sceneManager.getReferenceSpace();
      if (refSpace) {
        const offset = new XRRigidTransform(
          { x: -move.x, y: 0, z: -move.z, w: 1 }
        );
        const newRefSpace = refSpace.getOffsetReferenceSpace(offset);
        this.sceneManager.renderer.xr.setReferenceSpace(newRefSpace);
      }
    } catch (e) {
      // Not in XR or feature unavailable
    }
  }
  update(delta) {
    for (const state of this.grabState) {
      if (state.isGrabbing && state.grabbed) {
        const worldPos = new THREE.Vector3();
        state.grabbed.getWorldPosition(worldPos);
        state.tracker.record(worldPos);
      }
    }

    const toRemoveFromPhysics = [];

      this.physicsBodies = this.physicsBodies.filter(body => {
        body.update(delta);

        // Check nếu sphere đang lăn vào gần slot
        if (body.active && !body.sphere.userData.isLocked) {
          body.sphere.getWorldPosition(this._worldPos);
          const result = this.levelManager.checkDrop(body.sphere, this._worldPos);
          if (result) {
            if (result.colorMatch) {
              this._onCorrectDrop(body.sphere, result.slot, 0);
            } else {
              this._onWrongDrop(body.sphere, 0);
            }
            body.active = false; // dừng physics body này
            return false;
          }
        }

        return body.active;
      });
  }
}
