import * as THREE from 'three'

// ── FlatWorldBuilder.js ───────────────────────────────────────────────────
// Xây dựng không gian tĩnh cho Flatscreen mode (không cần WebXR).
// Tạo: sàn, 4 tường, ánh sáng môi trường.
// Trả về geometries cho PhysicsWorld.addStaticMesh().

const ROOM_W = 10   // m
const ROOM_D = 10
const ROOM_H = 3

export class FlatWorldBuilder {
  constructor(scene) {
    this.scene     = scene
    this._meshes   = []
    this._geometries = []   // để feed vào physics
  }

  build() {
    this._addFloor()
    this._addWalls()
    this._addLights()
    console.log('[FlatWorld] Room built')
  }

  // Trả về mảng BufferGeometry để PhysicsWorld.addStaticMesh()
  getGeometries() {
    return this._geometries
  }

  // ── Private ──────────────────────────────────────────────────────────

  _addFloor() {
    const geo = new THREE.PlaneGeometry(ROOM_W, ROOM_D)
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))

    const mat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      roughness: 0.9,
      metalness: 0.1,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    this.scene.add(mesh)
    this._meshes.push(mesh)
    this._geometries.push(this._toIndexed(geo))
  }

  _addWalls() {
    const wallDefs = [
      // [width, height, rotY, tx, ty, tz]
      [ROOM_W, ROOM_H,  0,            0,          ROOM_H/2, -ROOM_D/2],  // front
      [ROOM_W, ROOM_H,  Math.PI,      0,          ROOM_H/2,  ROOM_D/2],  // back
      [ROOM_D, ROOM_H, -Math.PI/2,   -ROOM_W/2,  ROOM_H/2,  0],         // left
      [ROOM_D, ROOM_H,  Math.PI/2,    ROOM_W/2,  ROOM_H/2,  0],         // right
    ]

    const mat = new THREE.MeshStandardMaterial({
      color: 0x223344,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.BackSide,
    })

    for (const [w, h, ry, tx, ty, tz] of wallDefs) {
      const geo  = new THREE.PlaneGeometry(w, h)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.y   = ry
      mesh.position.set(tx, ty, tz)
      mesh.receiveShadow = true
      this.scene.add(mesh)
      this._meshes.push(mesh)

      // Convert sang world-space geometry để feed physics
      mesh.updateMatrixWorld(true)
      const worldGeo = geo.clone().applyMatrix4(mesh.matrixWorld)
      this._geometries.push(this._toIndexed(worldGeo))
    }
  }

  _addLights() {
    const ambient = new THREE.AmbientLight(0x8899aa, 0.8)
    this.scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(3, 5, 2)
    key.castShadow = true
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0x4466ff, 0.4)
    fill.position.set(-3, 2, -3)
    this.scene.add(fill)
  }

  // PlaneGeometry không có index mặc định — tạo index để Rapier trimesh dùng được
  _toIndexed(geo) {
    if (geo.index) return geo
    return geo.toNonIndexed()   // fallback: Rapier cũng chấp nhận non-indexed
  }

  dispose() {
    for (const m of this._meshes) {
      this.scene.remove(m)
      m.geometry.dispose()
    }
    this._meshes = []
    this._geometries = []
  }
}