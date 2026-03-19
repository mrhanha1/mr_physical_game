import * as THREE from 'three'

export class MeshDetector {
  constructor() {
    this.roomMeshes = []
    this.debugMeshes = new Map()
  }

  update(frame, referenceSpace, scene) {
    if (!frame.detectedMeshes) return

    for (const mesh of frame.detectedMeshes) {
      if (this.debugMeshes.has(mesh)) continue

      const pose = frame.getPose(mesh.meshSpace, referenceSpace)
      if (!pose) continue

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array(mesh.vertices), 3
      ))
      geo.setIndex(new THREE.BufferAttribute(
        new Uint32Array(mesh.indices), 1
      ))
      geo.computeVertexNormals()

      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ff00, wireframe: true,
        transparent: true, opacity: 0.3
      })
      const threeMesh = new THREE.Mesh(geo, mat)

      const t = pose.transform
      threeMesh.position.set(t.position.x, t.position.y, t.position.z)
      threeMesh.quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w)

      scene.add(threeMesh)
      this.debugMeshes.set(mesh, threeMesh)
      this.roomMeshes.push({ xrMesh: mesh, threeMesh, pose })
    }
  }

  getRoomGeometries() {
    return this.roomMeshes.map(r => r.threeMesh.geometry)
  }
}