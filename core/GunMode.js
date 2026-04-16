// core/GunMode.js - Gun mode: load model, ammo, fire
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PhysicsBody } from './PhysicsBody.js';

const BULLET_SPEED    = 16.0;   // m/s
const AMMO_PLANE_SIZE = 0.06;   // kích thước plane indicator đạn

export class GunMode {
  constructor(sceneManager, sphereGenerator, levelManager, grabSystem) {
    this.sceneManager    = sceneManager;
    this.scene           = sceneManager.scene;
    this.sphereGenerator = sphereGenerator;
    this.levelManager    = levelManager;
    this.grabSystem      = grabSystem;

    this.isActive  = false;
    this.ammoColor = null;   // hex string màu đạn, null = chưa nạp

    this._gunModel        = null;  // Group gắn vào right grip / right hand
    this._ammoIndicator   = null;  // Plane hiển thị màu đạn
    this._rightGrip       = sceneManager.getControllerGrip(1);
    this._rightController = sceneManager.getController(1);

    this.physicsBodies    = []; // sphere đang bay

    // Debounce nút A (VR)
    this._btnAWasPressed = false;
    // Debounce trigger right (VR)
    this._triggerWasPressed = false;

    this._buildAmmoIndicator();
    this._loadGunModel();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  _loadGunModel() {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/DEpistol.glb',
      (gltf) => {
        this._gunModel = gltf.scene;
        this._gunModel.scale.setScalar(0.05);
        this._gunModel.rotation.set(-Math.PI * 0.5, Math.PI, 0);
        this._gunModel.position.set(0, -0.02, -0.05);
        this._gunModel.visible = false;
        this._rightGrip.add(this._gunModel);
      },
      undefined,
      (err) => console.error('[GunMode] Không load được DEpistol.glb:', err)
    );
  }

  _buildAmmoIndicator() {
    const geo = new THREE.PlaneGeometry(AMMO_PLANE_SIZE, AMMO_PLANE_SIZE);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this._ammoIndicator = new THREE.Mesh(geo, mat);
    this._ammoIndicator.position.set(0.08, 0, -0.05);
    this._ammoIndicator.rotation.y = Math.PI / 4;
    this._ammoIndicator.visible = false;
    this._rightController.add(this._ammoIndicator);
  }

  // ─── Toggle ───────────────────────────────────────────────────────────────

  /**
   * Toggle gun mode on/off.
   * @param {object} [options]
   * @param {THREE.Object3D} [options.attachTo]  PC mode: Object3D để gắn model (rightHand).
   *                                              VR: không truyền → dùng _rightGrip mặc định.
   */
  toggle(options = {}) {
    if (!this._gunModel) {
      console.warn('[GunMode] model chưa load, thử lại sau');
      return;
    }

    this.isActive = !this.isActive;

    // Tháo model khỏi parent hiện tại
    this._gunModel.removeFromParent();

    if (this.isActive) {
      const parent = options.attachTo ?? this._rightGrip;
      parent.add(this._gunModel);
      this._gunModel.visible = true;
    } else {
      this._gunModel.visible = false;
      this.ammoColor = null;
      this._ammoIndicator.visible = false;
    }
  }

  // ─── Ammo ─────────────────────────────────────────────────────────────────

  /**
   * Nạp đạn từ sphere (gọi từ GrabSystem khi left thả vào right).
   * @param {string} hexColor
   */
  loadAmmo(hexColor) {
    this.ammoColor = hexColor;
    this._ammoColorIndex = colorIndex;
    this._ammoIndicator.material.color.set(hexColor);
    this._ammoIndicator.visible = true;
  }

  // ─── Fire ─────────────────────────────────────────────────────────────────

  /**
   * Bắn sphere.
   * @param {THREE.Object3D} originObject  Right controller (VR) hoặc camera (PC).
   *                                       Dùng để lấy world position + world quaternion.
   */
  fire(originObject) {
    if (!this.ammoColor) return; // chưa nạp đạn

    const geo = new THREE.SphereGeometry(0.04, 16, 16);
    const mat = new THREE.MeshPhysicalMaterial({
      color: this.ammoColor,
      emissive: this.ammoColor,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.1,
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.userData.color     = this.ammoColor;
    sphere.userData.colorIndex = this._ammoColorIndex;
    sphere.userData.isLocked  = false;
    sphere.userData.isGrabbed = false;

    // Vị trí xuất phát
    const startPos = new THREE.Vector3();
    originObject.getWorldPosition(startPos);
    sphere.position.copy(startPos);
    this.scene.add(sphere);

    // Hướng bắn
    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(originObject.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();

    this.physicsBodies.push(new PhysicsBody(sphere, dir.multiplyScalar(BULLET_SPEED), true));
    this.sphereGenerator.activeSpheres.push(sphere);

    this.ammoColor = null;
    this._ammoIndicator.visible = false;

    // Haptic (VR only — no-op ngoài VR)
    this._hapticPulse(1, 0.6, 80);
  }

  // ─── Button input (VR) ────────────────────────────────────────────────────

  /**
   * Poll gamepad buttons — gọi mỗi frame từ render loop khi đang ở VR mode.
   */
  updateButtonInput() {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;

      let rightSource = null;
      for (const s of session.inputSources) {
        if (s.handedness === 'right') { rightSource = s; break; }
      }
      if (!rightSource?.gamepad) return;

      const buttons = rightSource.gamepad.buttons;

      // Nút A (index 4) → toggle VR (không truyền attachTo)
      const btnA = buttons[4]?.pressed ?? false;
      if (btnA && !this._btnAWasPressed) this.toggle();
      this._btnAWasPressed = btnA;

      // Trigger right (index 0) → fire
      if (this.isActive) {
        const trigger = buttons[0]?.pressed ?? false;
        if (trigger && !this._triggerWasPressed) this.fire(this._rightController);
        this._triggerWasPressed = trigger;
      } else {
        this._triggerWasPressed = false;
      }
    } catch (e) {}
  }

  // ─── Update physics ───────────────────────────────────────────────────────

  /**
   * Simulate physics cho sphere đang bay, check drop vào slot.
   * @param {number} delta
   */
  update(delta) {
    const worldPos = new THREE.Vector3();

    this.physicsBodies = this.physicsBodies.filter((body) => {
      body.update(delta);

      if (body.active) {
        body.mesh.getWorldPosition(worldPos);
        const result = this.levelManager.checkDrop(body.mesh, worldPos);
        if (result) {
          if (result.colorMatch) {
            this.levelManager.fillSlot(result.slot, body.mesh);
            this.scene.remove(body.mesh);
            this.sphereGenerator.activeSpheres =
              this.sphereGenerator.activeSpheres.filter(s => s !== body.mesh);
            this._hapticPulse(1, 0.8, 200);
          } else {
            const bounceVel = body.velocity.clone()
              .reflect(new THREE.Vector3(0, 1, 0))
              .multiplyScalar(0.4);
            this.grabSystem.handOffToPhysics(body.mesh, bounceVel);
          }
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

      //return true;
    });
  }

  // ─── Haptic ───────────────────────────────────────────────────────────────

  _hapticPulse(controllerIndex, intensity = 0.5, durationMs = 100) {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;
      let source = null, count = 0;
      for (const s of session.inputSources) {
        if (count === controllerIndex) { source = s; break; }
        count++;
      }
      if (source?.gamepad?.hapticActuators?.[0]) {
        source.gamepad.hapticActuators[0].pulse(intensity, durationMs);
      }
    } catch (e) {}
  }
}