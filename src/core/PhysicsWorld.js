import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

// ── PhysicsWorld.js ───────────────────────────────────────────────────────
// Thêm: addFlatRoom() — tạo collider sàn + 4 tường cho Flatscreen mode.
// AR mode tiếp tục dùng addStaticMesh() từ MeshDetector như cũ.

const ROOM_W = 10
const ROOM_D = 10
const ROOM_H = 3

export class PhysicsWorld {
  constructor() {
    this.world  = null
    this.bodies = new Map()
    this.ready  = false
  }

  async init() {
    await RAPIER.init()
    this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 })
    this.ready = true
    console.log('[Physics] Rapier ready')
  }

  // ── AR mode: feed trimesh từ MeshDetector ───────────────────────────
  addStaticMesh(geometry) {
    const pos = geometry.attributes.position
    const idx = geometry.index

    const vertices = new Float32Array(pos.array)
    const indices  = new Uint32Array(idx.array)

    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
    this.world.createCollider(desc)
  }

  // ── Flatscreen mode: tạo sàn + 4 tường bằng cuboid collider ────────
  addFlatRoom() {
    const hw = ROOM_W / 2
    const hd = ROOM_D / 2
    const hh = ROOM_H / 2
    const t  = 0.1   // độ dày tường

    const surfaces = [
      // [half-extents x,y,z]  [translation x,y,z]
      // Sàn
      { he: [hw, t, hd],   tr: [0,      -t,    0] },
      // Trần
      { he: [hw, t, hd],   tr: [0,  ROOM_H + t, 0] },
      // Tường trước/sau
      { he: [hw, hh, t],   tr: [0, hh,  -hd - t] },
      { he: [hw, hh, t],   tr: [0, hh,   hd + t] },
      // Tường trái/phải
      { he: [t, hh, hd],   tr: [-hw - t, hh, 0] },
      { he: [t, hh, hd],   tr: [ hw + t, hh, 0] },
    ]

    for (const { he, tr } of surfaces) {
      const desc = RAPIER.ColliderDesc
        .cuboid(he[0], he[1], he[2])
        .setTranslation(tr[0], tr[1], tr[2])
      this.world.createCollider(desc)
    }

    console.log('[Physics] Flat room colliders added')
  }

  // ── Tạo quả bóng dynamic ────────────────────────────────────────────
  spawnBall(position, radius = 0.05) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
    const body = this.world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc
      .ball(radius)
      .setRestitution(0.6)
      .setFriction(0.5)
    this.world.createCollider(colliderDesc, body)

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius),
      new THREE.MeshStandardMaterial({ color: 0xff4400 })
    )
    this.bodies.set(body, mesh)
    return { body, mesh }
  }

  step(dt) {
    if (!this.ready) return
    this.world.step()
    for (const [body, mesh] of this.bodies) {
      const t = body.translation()
      const r = body.rotation()
      mesh.position.set(t.x, t.y, t.z)
      mesh.quaternion.set(r.x, r.y, r.z, r.w)
    }
  }

  removeBody(body) {
    this.world.removeRigidBody(body)
    this.bodies.delete(body)
  }

  castRay(origin, direction, maxToi = 10) {
    const ray = new RAPIER.Ray(origin, direction)
    return this.world.castRay(ray, maxToi, true)
  }
}