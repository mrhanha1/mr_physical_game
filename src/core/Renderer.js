import * as THREE from 'three'

export class Renderer {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true  // transparent để thấy passthrough
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.xr.enabled = true
    this.renderer.setClearAlpha(0)  // background hoàn toàn trong suốt
    document.body.appendChild(this.renderer.domElement)
  }

  get xr() { return this.renderer.xr }
  
  render(scene, camera) {
    this.renderer.render(scene, camera)
  }
}