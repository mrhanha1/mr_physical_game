import * as THREE from 'three'
import { EnemyAI } from './EnemyAI.js'

export class EnemyPool {
  constructor(scene, poolSize = 20) {
    this.scene = scene
    this.pool = []       // idle
    this.active = new Set()

    // Pre-allocate ở vị trí ẩn
    const hidden = new THREE.Vector3(0, -100, 0)
    for (let i = 0; i < poolSize; i++) {
      const enemy = new EnemyAI(hidden, scene)
      enemy.mesh.visible = false
      enemy.isActive = false
      this.pool.push(enemy)
    }
  }

  // Lấy enemy từ pool, đặt tại position
  acquire(position) {
    let enemy = this.pool.pop()

    if (!enemy) {
      // Pool cạn → tạo mới
      console.warn('[EnemyPool] Pool empty, creating new enemy')
      enemy = new EnemyAI(position, this.scene)
    } else {
      enemy.reset(position)
      enemy.mesh.visible = true
    }

    this.active.add(enemy)
    return enemy
  }

  // Trả enemy về pool
  release(enemy) {
    if (!this.active.has(enemy)) return
    this.active.delete(enemy)
    enemy.isActive = false
    enemy.mesh.visible = false
    this.pool.push(enemy)
  }

  // Trả tất cả enemy đã chết về pool
  releaseDeadEnemies() {
    for (const enemy of this.active) {
      if (enemy.isDead) {
        this.release(enemy)
      }
    }
  }

  getActiveEnemies() {
    return [...this.active]
  }

  getActiveCount() {
    return this.active.size
  }
}