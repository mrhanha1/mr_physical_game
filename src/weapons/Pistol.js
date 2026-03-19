import * as THREE from 'three'

export class Pistol {
  constructor() {
    // Placeholder box thay GLB model (thay bằng GLTFLoader sau)
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.12, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    )
    this.mesh.visible = false

    this.ammo = 12
    this.maxAmmo = 12
    this.isHeld = false
    this.hand = null  // 'left' | 'right'

    // Điểm spawn đạn (đầu nòng)
    this.muzzle = new THREE.Object3D()
    this.muzzle.position.set(0, 0, -0.15)
    this.mesh.add(this.muzzle)
  }

  getMuzzleWorldPosition() {
    const pos = new THREE.Vector3()
    this.muzzle.getWorldPosition(pos)
    return pos
  }

  getMuzzleWorldDirection() {
    const dir = new THREE.Vector3()
    this.muzzle.getWorldDirection(dir)
    return dir.negate()
  }
}