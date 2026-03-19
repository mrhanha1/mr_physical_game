import * as THREE from 'three'

export class Locomotion {
  constructor(camera, floors) {
    this.camera = camera
    this.floors = floors  // array floor planes từ PlaneDetector

    this._snapCooldown = 0
    this._vignette = null  // optional DOM overlay
    this.snapAngle = Math.PI / 4  // 45 độ mỗi snap
  }

  update(dt, thumbstickX) {
    this._snapCooldown -= dt

    if (Math.abs(thumbstickX) > 0.7 && this._snapCooldown <= 0) {
      const dir = thumbstickX > 0 ? 1 : -1
      this.camera.rotation.y -= dir * this.snapAngle
      this._snapCooldown = 0.4  // giây
    }
  }

  teleportTo(targetPosition) {
    this.camera.position.set(
      targetPosition.x,
      targetPosition.y,
      targetPosition.z
    )
  }
}