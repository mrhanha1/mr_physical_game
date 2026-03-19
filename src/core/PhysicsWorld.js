import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

export class PhysicsWorld {
  constructor() {
    this.world = null
    this.bodies = new Map()   // Three.js mesh → rapier rigidBody
    this.debugMeshes = []
    this.ready = false
  }

  async init() {
    await RAPIER.init()
    this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 })
    this.ready = true
    console.log('[Physics] Rapier ready')
  }

  // Feed room mesh từ MeshDetector làm static collider
  addStaticMesh(geometry) {
    const pos = geometry.attributes.position
    const idx = geometry.index

    const vertices = new Float32Array(pos.array)
    const indices = new Uint32Array(idx.array)

    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
    this.world.createCollider(desc)
  }

  // Tạo quả bóng dynamic
  spawnBall(position, radius = 0.05) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
    const body = this.world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc
      .ball(radius)
      .setRestitution(0.6)  // nảy
      .setFriction(0.5)
    this.world.createCollider(colliderDesc, body)

    // Three.js mesh tương ứng
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

    // Sync Three.js mesh với Rapier body
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
  const hit = this.world.castRay(ray, maxToi, true)
  return hit  // null = không chạm gì
}
}