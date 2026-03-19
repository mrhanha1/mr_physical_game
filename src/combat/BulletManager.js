import * as THREE from 'three'

const BULLET_SPEED = 15   // m/s
const BULLET_LIFE = 3     // giây

export class BulletManager {
  constructor(scene) {
    this.scene = scene
    this.bullets = []

    // Reuse geometry/material
    this._geo = new THREE.SphereGeometry(0.012)
    this._mat = new THREE.MeshBasicMaterial({ color: 0xffee00 })
  }

  spawn(position, direction) {
    const mesh = new THREE.Mesh(this._geo, this._mat)
    mesh.position.copy(position)
    this.scene.add(mesh)

    this.bullets.push({
      mesh,
      velocity: direction.clone().multiplyScalar(BULLET_SPEED),
      life: BULLET_LIFE
    })
  }

  update(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.life -= dt
      b.mesh.position.addScaledVector(b.velocity, dt)

      if (b.life <= 0) {
        this.scene.remove(b.mesh)
        this.bullets.splice(i, 1)
      }
    }
  }

  getBullets() {
    return this.bullets
  }
}