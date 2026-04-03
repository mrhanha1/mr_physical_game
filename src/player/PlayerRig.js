import * as THREE from 'three'

export class PlayerRig {
  constructor(renderer, scene) {
    this.renderer = renderer
    this.scene    = scene

    this.controllers = [
      renderer.xr.getController(0),
      renderer.xr.getController(1)
    ]

    const gripGeo = new THREE.BoxGeometry(0.05, 0.05, 0.12)
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x888888 })

    this.controllers.forEach(ctrl => {
      ctrl.add(new THREE.Mesh(gripGeo, gripMat))
      scene.add(ctrl)
    })

    this._worldPos = new THREE.Vector3()
  }

  getControllerGrip(index) {
    return this.renderer.xr.getControllerGrip(index)
  }

  getPosition() {
    // getCamera() trả ArrayCamera — lấy camera con đầu tiên để có world position đúng
    const xrCam = this.renderer.xr.getCamera()
    const eye   = xrCam.cameras?.[0] ?? xrCam
    return eye.getWorldPosition(this._worldPos)
  }

  update() {}
}