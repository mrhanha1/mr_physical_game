import * as THREE from 'three'

// OcclusionMaterial — wrap ShaderMaterial dùng occlusion shader
// Áp lên mesh enemy để tay thật có thể che enemy ảo

import occlusionVert from '../shaders/occlusion.vert?raw'
import occlusionFrag from '../shaders/occlusion.frag?raw'

export function createOcclusionMaterial(baseColor = 0xcc3333) {
  return new THREE.ShaderMaterial({
    vertexShader: occlusionVert,
    fragmentShader: occlusionFrag,
    uniforms: {
      uDepthTexture:     { value: null },
      uDepthUvTransform: { value: new THREE.Matrix4() },
      uRawValueToMeters: { value: 1.0 },
      uAlpha:            { value: 1.0 },
      // Base color dùng cho fragment visibility (override gl_FragColor bên ngoài)
      diffuse:           { value: new THREE.Color(baseColor) },
    },
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
  })
}

// Cập nhật uniforms từ DepthSensor mỗi frame
// material: ShaderMaterial từ createOcclusionMaterial
// depthSensor: DepthSensor instance
export function updateOcclusionUniforms(material, depthSensor) {
  if (!depthSensor.ready || !depthSensor.texture) return

  material.uniforms.uDepthTexture.value = depthSensor.texture

  if (depthSensor.uvTransform) {
    material.uniforms.uDepthUvTransform.value.fromArray(depthSensor.uvTransform)
  }

  if (depthSensor.depthInfo?.rawValueToMeters) {
    material.uniforms.uRawValueToMeters.value = depthSensor.depthInfo.rawValueToMeters
  }
}