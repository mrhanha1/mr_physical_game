import * as THREE from 'three'

export class LightEstimator {
  constructor(dirLight, ambientLight) {
    this.dirLight     = dirLight
    this.ambientLight = ambientLight
    this.ready        = false
    this._xrLightProbe = null

    this._defaultDirColor     = dirLight.color.clone()
    this._defaultDirIntensity = dirLight.intensity
    this._defaultAmbColor     = ambientLight.color.clone()
    this._defaultAmbIntensity = ambientLight.intensity
  }

  async init(session) {
    if (!session.requestLightProbe) {
      console.warn('[LightEstimator] light-estimation không được hỗ trợ')
      return
    }
    try {
      this._xrLightProbe = await session.requestLightProbe()
      this.ready = true
      console.log('[LightEstimator] Light probe ready')
    } catch (e) {
      console.warn('[LightEstimator] requestLightProbe thất bại:', e)
    }
  }

  update(frame) {
    if (!this.ready || !this._xrLightProbe) return

    const estimate = frame.getLightEstimate(this._xrLightProbe)
    if (!estimate) return

    // Ambient từ spherical harmonics L0
    const sh = estimate.sphericalHarmonicsCoefficients
    if (sh && sh.length >= 3) {
      const r = Math.max(0, sh[0])
      const g = Math.max(0, sh[1])
      const b = Math.max(0, sh[2])
      const intensity = Math.sqrt(r * r + g * g + b * b)
      this.ambientLight.color.setRGB(
        intensity > 0 ? r / intensity : 1,
        intensity > 0 ? g / intensity : 1,
        intensity > 0 ? b / intensity : 1
      )
      this.ambientLight.intensity = Math.min(intensity * 3.5, 3.0)
    }

    // Directional
    const primary = estimate.primaryLightDirection
    const color   = estimate.primaryLightIntensity
    if (primary && color) {
      this.dirLight.position.set(-primary.x, -primary.y, -primary.z)
      this.dirLight.color.setRGB(color.r, color.g, color.b)
      const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
      this.dirLight.intensity = Math.min(lum * 2.0, 3.0)
    }
  }

  reset() {
    this.dirLight.color.copy(this._defaultDirColor)
    this.dirLight.intensity = this._defaultDirIntensity
    this.ambientLight.color.copy(this._defaultAmbColor)
    this.ambientLight.intensity = this._defaultAmbIntensity
  }
}