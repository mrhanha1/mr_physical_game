import * as THREE from 'three'

// 25 joint names theo WebXR Hand API spec
const JOINTS = [
  'wrist',
  'thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip',
  'index-finger-metacarpal','index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate','index-finger-phalanx-distal','index-finger-tip',
  'middle-finger-metacarpal','middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate','middle-finger-phalanx-distal','middle-finger-tip',
  'ring-finger-metacarpal','ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate','ring-finger-phalanx-distal','ring-finger-tip',
  'pinky-finger-metacarpal','pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate','pinky-finger-phalanx-distal','pinky-finger-tip'
]

export class HandTracking {
  constructor(renderer, scene) {
    this.hands = [
      renderer.xr.getHand(0),
      renderer.xr.getHand(1)
    ]

    const geo = new THREE.SphereGeometry(0.008)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffccaa })

    this.hands.forEach(hand => {
      // Tạo sphere nhỏ cho mỗi joint
      JOINTS.forEach(name => {
        const sphere = new THREE.Mesh(geo, mat)
        hand.add(sphere)
      })
      scene.add(hand)
    })

    this.wristPositions = [new THREE.Vector3(), new THREE.Vector3()]
    this.wristVelocities = [new THREE.Vector3(), new THREE.Vector3()]
    this._prevWrist = [new THREE.Vector3(), new THREE.Vector3()]
    this.isTracking = [false, false]
  }

  update(dt) {
    this.hands.forEach((hand, i) => {
      const wrist = hand.joints?.['wrist']
      if (!wrist) { this.isTracking[i] = false; return }

      this.isTracking[i] = true
      const pos = wrist.position

      this.wristVelocities[i]
        .subVectors(pos, this._prevWrist[i])
        .divideScalar(dt)

      this._prevWrist[i].copy(pos)
      this.wristPositions[i].copy(pos)
    })
  }

  getWristVelocity(handIndex) {
    return this.wristVelocities[handIndex]
  }

  getJointPosition(handIndex, jointName) {
    return this.hands[handIndex].joints?.[jointName]?.position
  }
}