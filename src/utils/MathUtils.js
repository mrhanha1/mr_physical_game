import * as THREE from 'three'

export function randomOnPlane(planePose, spread = 1) {
  return new THREE.Vector3(
    planePose.position.x + (Math.random() - 0.5) * spread,
    planePose.position.y,
    planePose.position.z + (Math.random() - 0.5) * spread
  )
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}