import * as THREE from 'three'

export class PlaneDetector {
  constructor() {
    this.floors = []
    this.walls = []
    this.tables = []
    this.meshes = new Map()  // planeId → Three.js mesh
  }

  update(frame, referenceSpace, scene) {
    if (!frame.detectedPlanes) return

    const seen = new Set()

    for (const plane of frame.detectedPlanes) {
      seen.add(plane)
      
      if (!this.meshes.has(plane)) {
        this._createPlaneMesh(plane, frame, referenceSpace, scene)
      }

      const orientation = plane.orientation  // 'horizontal' | 'vertical'
      const pose = frame.getPose(plane.planeSpace, referenceSpace)
      if (!pose) continue

      // Phân loại đơn giản theo y position và orientation
      if (orientation === 'horizontal') {
        const y = pose.transform.position.y
        if (y < 0.5) {
          if (!this.floors.includes(plane)) this.floors.push(plane)
        } else {
          if (!this.tables.includes(plane)) this.tables.push(plane)
        }
      } else {
        if (!this.walls.includes(plane)) this.walls.push(plane)
      }
    }

    // Xóa plane đã biến mất
    for (const [plane, mesh] of this.meshes) {
      if (!seen.has(plane)) {
        scene.remove(mesh)
        this.meshes.delete(plane)
      }
    }
  }

  _createPlaneMesh(plane, frame, referenceSpace, scene) {
    const pose = frame.getPose(plane.planeSpace, referenceSpace)
    if (!pose) return

    const polygon = plane.polygon  // mảng điểm DOMPointReadOnly
    const shape = new THREE.Shape()
    polygon.forEach((p, i) => {
      i === 0 ? shape.moveTo(p.x, p.z) : shape.lineTo(p.x, p.z)
    })

    const geo = new THREE.ShapeGeometry(shape)
    const mat = new THREE.MeshBasicMaterial({
      color: plane.orientation === 'horizontal' ? 0x0088ff : 0xff8800,
      transparent: true, opacity: 0.2,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2  // ShapeGeometry nằm trên XY, cần xoay xuống XZ

    const t = pose.transform
    mesh.position.set(t.position.x, t.position.y, t.position.z)
    mesh.quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w)

    scene.add(mesh)
    this.meshes.set(plane, mesh)
  }

  getFirstFloor() {
    return this.floors[0] || null
  }

  isReady() {
    return this.floors.length > 0
  }
  getRandomPointOnFloor(frame, referenceSpace) {
  const floor = this.floors[0]
  if (!floor) return null
  const pose = frame.getPose(floor.planeSpace, referenceSpace)
  const polygon = floor.polygon
  // random point trong polygon bounds
  const idx = Math.floor(Math.random() * polygon.length)
  const p = polygon[idx]
  return new THREE.Vector3(
    pose.transform.position.x + p.x,
    pose.transform.position.y,
    pose.transform.position.z + p.z
  )
}
}