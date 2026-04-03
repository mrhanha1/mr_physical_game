import * as THREE from 'three'

// ── FlatCamera.js ─────────────────────────────────────────────────────────
// Thay thế PlayerRig trong Flatscreen mode.
// Di chuyển camera trên mặt phẳng XZ bằng joystick trái của gamepad.
// Xoay camera bằng joystick phải (hoặc mouse drag nếu dùng pointer lock).
// Nhìn từ góc first-person ở độ cao cố định.

const MOVE_SPEED   = 3.0   // m/s
const LOOK_SPEED   = 2.0   // rad/s (joystick phải)
const CAMERA_HEIGHT = 1.6  // m

export class FlatCamera {
  constructor(camera, domElement) {
    this.camera     = camera
    this.domElement = domElement   // renderer.domElement để gắn pointer lock

    this._yaw   = 0   // xoay ngang (radian)
    this._vel   = new THREE.Vector3()
    this._fwd   = new THREE.Vector3()
    this._right = new THREE.Vector3()

    // Pointer lock (mouse) — optional, dùng khi không có gamepad
    this._mouseX = 0
    this._pointerLocked = false
    this._setupPointerLock()

    // Đặt camera ở vị trí mặc định
    camera.position.set(0, CAMERA_HEIGHT, 0)
    camera.rotation.set(0, 0, 0)
  }

  // ── Update gọi mỗi frame ─────────────────────────────────────────────
  // thumbstick: { lx, ly, rx } — đọc từ ControllerInput hoặc GamepadReader
  update(dt, thumbstick) {
    const { lx = 0, ly = 0, rx = 0 } = thumbstick ?? {}

    // Xoay theo joystick phải
    if (Math.abs(rx) > 0.1) {
      this._yaw -= rx * LOOK_SPEED * dt
    }

    // Áp dụng yaw lên camera (chỉ xoay Y, giữ pitch = 0 vì nhìn ngang)
    this.camera.quaternion.setFromEuler(new THREE.Euler(0, this._yaw, 0, 'YXZ'))

    // Tính vector forward/right từ yaw hiện tại (bỏ qua trục Y)
    this._fwd.set(
      -Math.sin(this._yaw), 0, -Math.cos(this._yaw)
    )
    this._right.set(
      Math.cos(this._yaw), 0, -Math.sin(this._yaw)
    )

    // Di chuyển theo joystick trái
    const moveX = lx
    const moveZ = ly   // ly dương = joystick xuống = lùi
    if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
      this._vel
        .copy(this._fwd).multiplyScalar(-moveZ)
        .addScaledVector(this._right, moveX)
        .normalize()
        .multiplyScalar(MOVE_SPEED * dt)

      this.camera.position.addScaledVector(this._vel, 1)
      this.camera.position.y = CAMERA_HEIGHT   // giữ độ cao cố định
    }
  }

  // Vị trí world để các hệ thống khác (GamePanel...) tham chiếu
  getPosition() {
    return this.camera.position.clone()
  }

  getForward() {
    return this._fwd.clone()
  }

  // ── Pointer lock (mouse look) ────────────────────────────────────────
  _setupPointerLock() {
    if (!this.domElement) return

    this.domElement.addEventListener('click', () => {
      if (!this._pointerLocked) this.domElement.requestPointerLock?.()
    })

    document.addEventListener('pointerlockchange', () => {
      this._pointerLocked = document.pointerLockElement === this.domElement
    })

    document.addEventListener('mousemove', (e) => {
      if (!this._pointerLocked) return
      this._yaw -= e.movementX * 0.002
    })
  }
}