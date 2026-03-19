import * as THREE from 'three'

// Ray pointer từ controller phải, dùng để interact với VRUI panel
// Emit event 'select' khi trigger được bấm trên một target mesh

export class RayPointer {
  constructor(renderer, scene, controllerInput) {
    this.renderer = renderer
    this.scene = scene
    this.controllerInput = controllerInput

    this._raycaster = new THREE.Raycaster()
    this._targets = []   // mesh[] có thể click được

    this._lineMesh = this._buildLine()
    scene.add(this._lineMesh)

    // callback khi click target
    // onSelect(mesh) — mesh.userData.action sẽ do caller định nghĩa
    this.onSelect = null
  }

  addTarget(mesh) {
    this._targets.push(mesh)
  }

  removeTarget(mesh) {
    this._targets = this._targets.filter(t => t !== mesh)
  }

  clearTargets() {
    this._targets = []
  }

  // Gọi mỗi frame
  update() {
    const ctrl = this.renderer.xr.getController(1)  // right = index 1
    if (!ctrl) return

    // Ray từ controller phải
    const origin = new THREE.Vector3()
    const direction = new THREE.Vector3(0, 0, -1)
    ctrl.getWorldPosition(origin)
    direction.applyQuaternion(ctrl.quaternion)

    this._raycaster.set(origin, direction)

    // Cập nhật line visual
    const far = origin.clone().addScaledVector(direction, 3)
    const positions = this._lineMesh.geometry.attributes.position
    positions.setXYZ(0, origin.x, origin.y, origin.z)
    positions.setXYZ(1, far.x, far.y, far.z)
    positions.needsUpdate = true

    // Kiểm tra hit
    const hits = this._raycaster.intersectObjects(this._targets, false)
    const isHovering = hits.length > 0

    this._lineMesh.material.color.set(isHovering ? 0x00ffff : 0xffffff)
    this._lineMesh.material.opacity = isHovering ? 0.9 : 0.4

    // Trigger bấm → select
    for (const evt of this.controllerInput.getEvents()) {
      if (evt.action === 'shoot' && evt.hand === 'right' && hits.length > 0) {
        const target = hits[0].object
        console.log(`[RayPointer] Selected: ${target.userData.action}`)
        if (this.onSelect) this.onSelect(target)
      }
    }
  }

  setVisible(v) {
    this._lineMesh.visible = v
  }

  _buildLine() {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(6)  // 2 điểm × 3
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })

    return new THREE.Line(geo, mat)
  }
}