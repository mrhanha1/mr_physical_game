import * as THREE from 'three'

export class DepthSensor {
  constructor() {
    this.depthInfo   = null
    this.texture     = null
    this.uvTransform = null
    this.ready       = false
  }

  checkSupport(session) {
    const supported = session.enabledFeatures?.includes('depth-sensing') ?? false
    if (!supported) {
      console.warn('[DepthSensor] depth-sensing không được hỗ trợ trên thiết bị này')
    }
    this.ready = supported
    return supported
  }

  update(frame, view, referenceSpace) {
    if (!this.ready) return

    try {
      const depthInfo = frame.getDepthInformation(view)
      if (!depthInfo) return

      this.depthInfo = depthInfo
      const { data, width, height } = depthInfo

      if (!this.texture) {
        this._initTexture(width, height)
      }

      const MAX_DEPTH = 8.0
      const pixels = this.texture.image.data
      for (let i = 0; i < data.length; i++) {
        pixels[i] = Math.min(data[i] / MAX_DEPTH, 1.0)
      }

      this.texture.needsUpdate = true
      this.uvTransform = depthInfo.normDepthBufferFromNormView.matrix
    } catch (e) {
      // Một số frame không có depth — bỏ qua
    }
  }

  _initTexture(width, height) {
    const data = new Float32Array(width * height)
    this.texture = new THREE.DataTexture(data, width, height, THREE.RedFormat, THREE.FloatType)
    this.texture.magFilter = THREE.NearestFilter
    this.texture.minFilter = THREE.NearestFilter
    console.log(`[DepthSensor] Texture init ${width}x${height}`)
  }
}