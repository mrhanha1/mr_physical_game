import * as THREE from 'three'
import { GameMode } from '../core/GameMode.js'

// AR mode  : snap turn bằng thumbstick phải
// Flat mode: smooth locomotion bằng thumbstick trái
//
// QUAN TRỌNG: Trong WebXR, vị trí camera bị XR pose override mỗi frame.
// Di chuyển camera.parent.position KHÔNG có tác dụng.
// Phải dùng XRReferenceSpace.getOffsetReferenceSpace() với XRRigidTransform.

const MOVE_SPEED = 2.0  // m/s

export class Locomotion {
  constructor(renderer) {
    this.renderer = renderer

    this._snapCooldown   = 0
    this.snapAngle       = Math.PI / 4

    // Base reference space (set từ sessionstart sau requestReferenceSpace)
    this._baseRefSpace   = null

    // Flat mode: tích lũy offset vị trí (m)
    this._offsetX        = 0
    this._offsetZ        = 0

    // AR mode: tích lũy góc snap turn (rad)
    this._snapAngleAccum = 0
  }

  /**
   * Gọi từ sessionstart sau khi requestReferenceSpace thành công.
   * Reset offset khi session mới bắt đầu.
   */
  setBaseReferenceSpace(refSpace) {
    this._baseRefSpace   = refSpace
    this._offsetX        = 0
    this._offsetZ        = 0
    this._snapAngleAccum = 0
  }

  /**
   * Cập nhật locomotion mỗi frame.
   * @param {number} dt   - delta time giây
   * @param {number} rxX  - thumbstick trục X tay phải  (AR snap turn)
   * @param {number} lxX  - thumbstick trục X tay trái  (Flat strafe)
   * @param {number} lxY  - thumbstick trục Y tay trái  (Flat forward/back)
   * @returns {XRReferenceSpace|null} reference space mới nếu có thay đổi
   */
  update(dt, rxX, lxX = 0, lxY = 0) {
    if (GameMode.isAR()) {
      return this._updateSnapTurn(dt, rxX)
    }
    return this._updateFlatMove(dt, lxX, lxY)
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _updateSnapTurn(dt, rxX) {
    if (!this._baseRefSpace) return null
    this._snapCooldown -= dt
    if (Math.abs(rxX) <= 0.7 || this._snapCooldown > 0) return null

    this._snapCooldown = 0.4
    // Joystick phải → turn phải → giảm angle (chiều âm)
    this._snapAngleAccum -= (rxX > 0 ? 1 : -1) * this.snapAngle

    const sin = Math.sin(this._snapAngleAccum / 2)
    const cos = Math.cos(this._snapAngleAccum / 2)
    const transform = new XRRigidTransform(
      { x: 0, y: 0,   z: 0, w: 1 },
      { x: 0, y: sin, z: 0, w: cos },
    )
    return this._baseRefSpace.getOffsetReferenceSpace(transform)
  }

  _updateFlatMove(dt, lxX, lxY) {
    if (!this._baseRefSpace) return null
    if (Math.abs(lxX) < 0.1 && Math.abs(lxY) < 0.1) return null

    // Lấy hướng nhìn từ XR camera thực (không phải PerspectiveCamera mặc định)
    const xrCam = this.renderer.xr.getCamera()
    const eye   = xrCam.cameras?.[0] ?? xrCam

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(eye.quaternion)
    fwd.y = 0
    if (fwd.lengthSq() < 1e-6) return null
    fwd.normalize()

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(eye.quaternion)
    right.y = 0
    right.normalize()

    const move = new THREE.Vector3()
      .addScaledVector(right, lxX)
      .addScaledVector(fwd,  -lxY)   // lxY âm = joystick đẩy lên = tiến

    if (move.lengthSq() < 1e-8) return null
    move.normalize().multiplyScalar(MOVE_SPEED * dt)

    this._offsetX += move.x
    this._offsetZ += move.z

    // XRRigidTransform: vị trí của newRefSpace trong baseRefSpace.
    // Để camera xuất hiện dịch về hướng move, refSpace phải dịch ngược chiều.
    const transform = new XRRigidTransform({
      x: -this._offsetX,
      y: 0,
      z: -this._offsetZ,
      w: 1,
    })
    return this._baseRefSpace.getOffsetReferenceSpace(transform)
  }
}