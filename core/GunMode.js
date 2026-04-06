// core/GunMode.js - Gun mode: load model, ammo, fire
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PhysicsBody } from './PhysicsBody.js';

const BULLET_SPEED   = 8.0;   // m/s
const AMMO_PLANE_SIZE = 0.06; // kích thước plane indicator đạn

export class GunMode {
  constructor(sceneManager, sphereGenerator, levelManager) {
    this.sceneManager    = sceneManager;
    this.scene           = sceneManager.scene;
    this.sphereGenerator = sphereGenerator;
    this.levelManager    = levelManager;

    this.isActive  = false;
    this.ammoColor = null;   // hex string màu đạn đang nạp, null = chưa nạp

    this._gunModel       = null;  // Group gắn vào right grip
    this._ammoIndicator  = null;  // Plane hiển thị màu đạn
    this._rightGrip      = sceneManager.getControllerGrip(1);
    this._rightController = sceneManager.getController(1);

    this.physicsBodies   = []; // các sphere đã bắn đang bay

    // debounce nút A
    this._btnAWasPressed = false;
    // debounce trigger right
    this._triggerWasPressed = false;

    this._buildAmmoIndicator();
    this._loadGunModel();
  }

  _loadGunModel() {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/DEpistol.glb',
      (gltf) => {
        this._gunModel = gltf.scene;
        // Điều chỉnh vị trí/xoay/scale cho vừa tay cầm - tinh chỉnh nếu cần
        this._gunModel.scale.setScalar(0.15);
        this._gunModel.rotation.set(0, Math.PI, 0);
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
    // Đặt cạnh phải right controller, hơi nghiêng để dễ thấy
    this._ammoIndicator.position.set(0.08, 0, -0.05);
    this._ammoIndicator.rotation.y = Math.PI / 4;
    this._ammoIndicator.visible = false;
    this._rightController.add(this._ammoIndicator);
  }

  /** Toggle gun mode on/off */
  toggle() {
    this.isActive = !this.isActive;

    if (this._gunModel) this._gunModel.visible = this.isActive;

    if (!this.isActive) {
      // Thoát gun mode → xóa ammo
      this.ammoColor = null;
      this._ammoIndicator.visible = false;
    }
  }

  /**
   * Nạp đạn từ sphere (gọi từ Interaction khi left thả vào right)
   * @param {string} hexColor
   */
  loadAmmo(hexColor) {
    this.ammoColor = hexColor;
    this._ammoIndicator.material.color.set(hexColor);
    this._ammoIndicator.visible = true;
  }

  /** Bắn sphere theo hướng right controller */
  fire() {
    if (!this.ammoColor) return; // chưa nạp đạn

    // Tạo sphere
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
    sphere.userData.isLocked  = false;
    sphere.userData.isGrabbed = false;

    // Vị trí xuất phát = vị trí right controller trong world space
    const startPos = new THREE.Vector3();
    this._rightController.getWorldPosition(startPos);
    sphere.position.copy(startPos);
    this.scene.add(sphere);

    // Hướng bắn = hướng ngắm của right controller
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this._rightController.getWorldQuaternion(new THREE.Quaternion()));
    dir.normalize();

    const velocity = dir.multiplyScalar(BULLET_SPEED);

    // PhysicsBody với gravity
    this.physicsBodies.push(new PhysicsBody(sphere, velocity, true));

    // Thêm vào activeSpheres để Interaction có thể check drop
    this.sphereGenerator.activeSpheres.push(sphere);

    // Xóa đạn đã bắn
    this.ammoColor = null;
    this._ammoIndicator.visible = false;

    // Haptic
    this._hapticPulse(1, 0.6, 80);
  }

  /**
   * Poll gamepad buttons - gọi mỗi frame từ main.js
   */
  updateButtonInput() {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;

      let rightSource = null;
      let count = 0;
      for (const s of session.inputSources) {
        if (count === 1) { rightSource = s; break; }
        count++;
      }
      if (!rightSource?.gamepad) return;

      const buttons = rightSource.gamepad.buttons;

      // Nút A = index 4
      const btnA = buttons[4]?.pressed ?? false;
      if (btnA && !this._btnAWasPressed) this.toggle();
      this._btnAWasPressed = btnA;

      // Trigger right = index 0, chỉ fire khi gun active
      if (this.isActive) {
        const trigger = buttons[0]?.pressed ?? false;
        if (trigger && !this._triggerWasPressed) this.fire();
        this._triggerWasPressed = trigger;
      } else {
        this._triggerWasPressed = false;
      }
    } catch (e) {
      // XR không khả dụng
    }
  }

  /**
   * Update physics các sphere đã bắn, check drop vào slot
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
            // Đúng màu → lock vào slot
            const slotPos = new THREE.Vector3();
            result.slot.mesh.getWorldPosition(slotPos);
            this.levelManager.fillSlot(result.slot, body.mesh);
            this.sphereGenerator.activeSpheres = this.sphereGenerator.activeSpheres.filter(
              (s) => s !== body.mesh
            );
            this._hapticPulse(1, 0.8, 200);
          } else {
            // Sai màu → bounce off, giữ trong activeSpheres để có thể grab lại
            body.velocity.reflect(new THREE.Vector3(0, 1, 0)).multiplyScalar(0.4);
          }
          body.active = false;
          return false;
        }
      }

      // Xóa nếu rơi quá sàn hoặc đã dừng
      if (!body.active || body.mesh.position.y < -2) {
        this.scene.remove(body.mesh);
        this.sphereGenerator.activeSpheres = this.sphereGenerator.activeSpheres.filter(
          (s) => s !== body.mesh
        );
        return false;
      }

      return true;
    });
  }

  _hapticPulse(controllerIndex, intensity = 0.5, durationMs = 100) {
    try {
      const session = this.sceneManager.renderer.xr.getSession();
      if (!session) return;
      let source = null;
      let count = 0;
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