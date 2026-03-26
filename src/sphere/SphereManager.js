import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { SPHERE_TYPES, SPHERE_TYPE_KEYS, createSphereMaterial, randomSphereType } from './SphereMaterials.js'

// ─── SphereManager ────────────────────────────────────────────────────────
// Quản lý spawn/despawn sphere trong scene + Rapier physics world.
// Mỗi sphere có state: FREE | HELD | LOADED_IN_WEAPON

export const SphereState = {
  FREE:             'free',      // đang bay/nằm tự do
  HELD:             'held',      // đang được tay cầm
  LOADED_IN_WEAPON: 'loaded',   // đã nạp vào súng
}

export class SphereManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physicsWorld
   */
  constructor(scene, physicsWorld) {
    this.scene        = scene
    this.physics      = physicsWorld

    // Map: rapier rigidBody handle (number) → sphereData object
    this._spheres     = new Map()

    // Shared SphereGeometry per radius (reuse across materials)
    this._geometryCache = new Map()

    this._maxSpheres  = 30     // giới hạn tối đa trong scene
    this._despawnY    = -5.0   // y thấp hơn này → despawn (rơi khỏi sàn)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Sinh sphere tại vị trí world position.
   * @param {THREE.Vector3} position
   * @param {string} typeKey - key trong SPHERE_TYPES, hoặc 'RANDOM'
   * @returns {object} sphereData
   */
  spawnSphere(position, typeKey = 'RANDOM') {
    if (this._spheres.size >= this._maxSpheres) {
      this._despawnOldest()
    }

    const { key, def } = typeKey === 'RANDOM'
      ? randomSphereType()
      : { key: typeKey, def: SPHERE_TYPES[typeKey] }

    const radius = def.radius

    // ── Rapier body ──
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setAdditionalMass(def.mass)
      .setLinearDamping(0.05)
      .setAngularDamping(0.3)

    const body = this.physics.world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc
      .ball(radius)
      .setRestitution(def.restitution)
      .setFriction(def.friction)
    this.physics.world.createCollider(colliderDesc, body)

    // ── THREE.js mesh ──
    const geo  = this._getGeometry(radius)
    const mat  = createSphereMaterial(def)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow    = true
    mesh.receiveShadow = true
    this.scene.add(mesh)

    const data = {
      body,
      mesh,
      typeKey: key,
      def,
      state:     SphereState.FREE,
      heldBy:    null,   // 'left' | 'right' | null
      spawnTime: performance.now(),
    }

    this._spheres.set(body.handle, data)
    return data
  }

  /**
   * Xóa sphere khỏi scene + physics.
   * @param {object} sphereData
   */
  despawnSphere(sphereData) {
    const { body, mesh } = sphereData
    this.scene.remove(mesh)
    mesh.geometry.dispose()    // không dispose shared geo — xem _getGeometry
    mesh.material.dispose()

    if (this.physics.world.getRigidBody(body.handle)) {
      this.physics.world.removeRigidBody(body)
    }
    this._spheres.delete(body.handle)
  }

  /**
   * Gọi mỗi frame: sync THREE mesh theo Rapier body + auto-despawn.
   */
  update() {
    for (const [, data] of this._spheres) {
      if (data.state === SphereState.HELD || data.state === SphereState.LOADED_IN_WEAPON) {
        continue // vị trí do SphereGrabSystem / WeaponBase kiểm soát
      }

      const t = data.body.translation()
      const r = data.body.rotation()
      data.mesh.position.set(t.x, t.y, t.z)
      data.mesh.quaternion.set(r.x, r.y, r.z, r.w)

      // Auto-despawn nếu rơi quá sâu
      if (t.y < this._despawnY) {
        this.despawnSphere(data)
      }
    }
  }

  /**
   * Tìm sphere FREE gần nhất với điểm world position trong bán kính maxDist.
   * @param {THREE.Vector3} point
   * @param {number} maxDist
   * @returns {object|null} sphereData hoặc null
   */
  findNearestFree(point, maxDist = 0.18) {
    let best = null
    let bestDist = maxDist

    for (const [, data] of this._spheres) {
      if (data.state !== SphereState.FREE) continue
      const t    = data.body.translation()
      const dist = point.distanceTo(new THREE.Vector3(t.x, t.y, t.z))
      if (dist < bestDist) {
        bestDist = dist
        best     = data
      }
    }
    return best
  }

  /**
   * Tìm sphere FREE gần nhất với điểm và bán kính lớn hơn để nạp vào súng.
   */
  findNearestFreeForLoad(point, maxDist = 0.12) {
    return this.findNearestFree(point, maxDist)
  }

  /** Danh sách tất cả sphere đang free */
  getFreeSpheres() {
    return [...this._spheres.values()].filter(d => d.state === SphereState.FREE)
  }

  /** Tổng số sphere trong scene */
  get count() { return this._spheres.size }

  // ── Private ───────────────────────────────────────────────────────────────

  _getGeometry(radius) {
    if (!this._geometryCache.has(radius)) {
      // 32 segments đủ mịn cho VR
      this._geometryCache.set(radius, new THREE.SphereGeometry(radius, 32, 24))
    }
    return this._geometryCache.get(radius)
  }

  _despawnOldest() {
    // Tìm sphere FREE có thời gian sống lâu nhất
    let oldest = null
    let oldestTime = Infinity
    for (const [, data] of this._spheres) {
      if (data.state === SphereState.FREE && data.spawnTime < oldestTime) {
        oldestTime = data.spawnTime
        oldest = data
      }
    }
    if (oldest) this.despawnSphere(oldest)
  }
}
