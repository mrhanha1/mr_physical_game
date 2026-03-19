import * as THREE from 'three'
import { EnemyPool } from './EnemyPool.js'
import { Ragdoll } from './Ragdoll.js'

const _tmp = new THREE.Vector3()

export class EnemySpawner {
  constructor(scene, poolSize = 20) {
    this.pool = new EnemyPool(scene, poolSize)
    this.scene = scene
    this.planeDetector = null
    this.physicsWorld = null
    this.audioManager = null  // optional, set sau khi init

    this._ragdolls = []  // active Ragdoll instances

    // Cache floor points để không tính lại mỗi frame
    this._floorPoints = []
    this._floorCacheTimer = 0
    this._floorCacheInterval = 2.0  // giây
  }

  // Gọi sau khi PlaneDetector và PhysicsWorld sẵn sàng
  init(planeDetector, physicsWorld, audioManager = null) {
    this.planeDetector = planeDetector
    this.physicsWorld = physicsWorld
    this.audioManager = audioManager
  }

  // Spawn count enemy, cố gắng spawn xa player
  // frame, referenceSpace: từ XR frame loop
  // playerPos: THREE.Vector3
  spawn(count, frame, referenceSpace, playerPos) {
    if (!this.planeDetector?.isReady()) {
      console.warn('[EnemySpawner] PlaneDetector chưa sẵn sàng')
      return []
    }

    this._updateFloorPoints(frame, referenceSpace)

    const spawned = []
    const candidates = this._getSpawnCandidates(playerPos, 2.0)

    for (let i = 0; i < count; i++) {
      if (candidates.length === 0) {
        console.warn('[EnemySpawner] Không đủ điểm spawn')
        break
      }
      const idx = Math.floor(Math.random() * candidates.length)
      const pos = candidates.splice(idx, 1)[0]

      const enemy = this.pool.acquire(pos)

      // Wire death callback → tạo Ragdoll + phát âm thanh
      enemy.onDeath = (position, material) => {
        const floorY = this._floorPoints[0]?.y ?? 0
        this._spawnRagdoll(position, material, floorY)
        if (this.audioManager) {
          this.audioManager.playAt('enemyDeath', position, playerPos, new THREE.Vector3(0, 0, -1))
        }
      }

      spawned.push(enemy)
    }

    return spawned
  }

  // Gọi mỗi frame trong XR loop
  update(dt, playerPos, frame, referenceSpace) {
    // Cập nhật cache floor points định kỳ
    this._floorCacheTimer -= dt
    if (this._floorCacheTimer <= 0 && frame) {
      this._updateFloorPoints(frame, referenceSpace)
    }

    // Release enemy đã chết
    this.pool.releaseDeadEnemies()

    // Update từng enemy active
    const waypointFn = () => this._randomFloorPoint()
    for (const enemy of this.pool.active) {
      enemy.update(dt, playerPos, this.physicsWorld, waypointFn)
    }

    // Update ragdolls, dọn dẹp cái đã done
    for (let i = this._ragdolls.length - 1; i >= 0; i--) {
      const ragdoll = this._ragdolls[i]
      ragdoll.update(dt)
      if (ragdoll.isDone) {
        this._ragdolls.splice(i, 1)
      }
    }
  }

  getActiveEnemies() {
    return this.pool.getActiveEnemies()
  }

  getActiveCount() {
    return this.pool.getActiveCount()
  }

  // ── Private ──

  _updateFloorPoints(frame, referenceSpace) {
    if (!frame || !referenceSpace) return
    this._floorPoints = []
    this._floorCacheTimer = this._floorCacheInterval

    for (const floor of this.planeDetector.floors) {
      const pose = frame.getPose(floor.planeSpace, referenceSpace)
      if (!pose) continue

      const ox = pose.transform.position.x
      const oy = pose.transform.position.y
      const oz = pose.transform.position.z

      for (const p of floor.polygon) {
        this._floorPoints.push(new THREE.Vector3(ox + p.x, oy, oz + p.z))
      }
    }
  }

  _randomFloorPoint() {
    if (this._floorPoints.length === 0) return null
    const idx = Math.floor(Math.random() * this._floorPoints.length)
    return this._floorPoints[idx].clone()
  }

  // Lấy danh sách điểm spawn xa player >= minDist
  _getSpawnCandidates(playerPos, minDist) {
    return this._floorPoints
      .filter(p => p.distanceTo(playerPos) >= minDist)
      .map(p => p.clone())
  }

  // material: THREE.Material của enemy (clone màu cho xác)
  // floorY: y của sàn gần nhất
  _spawnRagdoll(position, material, floorY) {
    const ragdoll = new Ragdoll(position, this.scene, material, floorY)
    this._ragdolls.push(ragdoll)
  }
}