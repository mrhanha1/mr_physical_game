import * as THREE from 'three'

const GRAVITY      = -9.81
const FLOOR_Y      = 0.15   // radius sphere, dừng ở đây
const FADE_DELAY   = 3.0    // giây nằm yên trước khi fade
const FADE_DURATION = 2.0   // giây fade out

export class Ragdoll {
  /**
   * @param {THREE.Vector3} position - vị trí enemy lúc chết
   * @param {THREE.Scene} scene
   * @param {THREE.Material} material - material của enemy (clone để tách opacity)
   * @param {number} floorY - y của sàn thật (từ PlaneDetector)
   */
  constructor(position, scene, material, floorY = 0) {
    this.scene  = scene
    this.isDone = false

    this._vy         = 0           // vận tốc dọc
    this._landed     = false
    this._fadeTimer  = 0
    this._state      = 'falling'   // 'falling' | 'fading'
    this._floorY     = floorY + FLOOR_Y

    // Clone mesh sphere đơn giản — giống visual của enemy
    this._mat = material.clone()
    this._mat.transparent = true
    this._mat.opacity = 1

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15),
      this._mat
    )
    this.mesh.position.copy(position)
    scene.add(this.mesh)
  }

  update(dt) {
    if (this.isDone) return

    if (this._state === 'falling') {
      if (!this._landed) {
        // Apply gravity
        this._vy += GRAVITY * dt
        this.mesh.position.y += this._vy * dt

        // Chạm sàn
        if (this.mesh.position.y <= this._floorY) {
          this.mesh.position.y = this._floorY
          this._vy = 0
          this._landed = true
        }
      } else {
        // Nằm yên, đếm delay
        this._fadeTimer += dt
        if (this._fadeTimer >= FADE_DELAY) {
          this._state = 'fading'
          this._fadeTimer = 0
        }
      }
      return
    }

    if (this._state === 'fading') {
      this._fadeTimer += dt
      const progress = this._fadeTimer / FADE_DURATION
      this._mat.opacity = Math.max(0, 1 - progress)

      if (progress >= 1) {
        this.scene.remove(this.mesh)
        this.isDone = true
      }
    }
  }
}