import * as THREE from 'three'

export class PlayerRig {
  constructor(renderer, scene) {
    this.renderer = renderer
    this.scene = scene
    
    // Controller meshes
    this.controllers = [
      renderer.xr.getController(0),
      renderer.xr.getController(1)
    ]
    
    const gripGeo = new THREE.BoxGeometry(0.05, 0.05, 0.12)
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x888888 })
    
    this.controllers.forEach(ctrl => {
      const mesh = new THREE.Mesh(gripGeo, gripMat)
      ctrl.add(mesh)
      scene.add(ctrl)
    })
  }

  getControllerGrip(index) {
    return this.renderer.xr.getControllerGrip(index)
  }
  getPosition() {
    // Lấy từ camera của XR session
    const cam = this.renderer.xr.getCamera()
    return cam.position  // world position của head
  }

  update() {
    // Pose tự động update qua WebXR, không cần làm thêm
  }
}