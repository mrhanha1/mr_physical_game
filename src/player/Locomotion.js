import * as THREE from 'three'

export class Locomotion {
  constructor(camera) {
    this.camera = camera
    this.boundsGeometry = null  // XRBoundedReferenceSpace.boundsGeometry

    this._snapCooldown = 0
    this.snapAngle = Math.PI / 4  // 45 độ mỗi snap
  }

  setBounds(boundsGeometry) {
    this.boundsGeometry = boundsGeometry
  }

  update(dt, thumbstickX) {
    this._snapCooldown -= dt

    if (Math.abs(thumbstickX) > 0.7 && this._snapCooldown <= 0) {
      const dir = thumbstickX > 0 ? 1 : -1
      this.camera.rotation.y -= dir * this.snapAngle
      this._snapCooldown = 0.4
    }
  }

  // Kiểm tra điểm có nằm trong boundary polygon không (2D point-in-polygon)
  isInsideBounds(x, z) {
    if (!this.boundsGeometry || this.boundsGeometry.length === 0) return true

    const pts = this.boundsGeometry
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, zi = pts[i].z
      const xj = pts[j].x, zj = pts[j].z
      const intersect = ((zi > z) !== (zj > z)) &&
        (x < (xj - xi) * (z - zi) / (zj - zi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  teleportTo(targetPosition) {
    if (!this.isInsideBounds(targetPosition.x, targetPosition.z)) {
      console.warn('[Locomotion] Teleport target outside boundary, ignored')
      return
    }
    this.camera.position.set(targetPosition.x, targetPosition.y, targetPosition.z)
  }
}