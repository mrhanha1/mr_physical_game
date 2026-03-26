import * as THREE from 'three'
import { WeaponBase } from './WeaponBase.js'

// ─── Pistol (Súng ngắn) ───────────────────────────────────────────────────
// • 1 tay cầm: right controller
// • Aim: hướng -Z của right controller grip (như chỉ tay về phía trước)
// • Muzzle velocity: ~12 m/s
// • Cooldown: 500ms (bắn không quá nhanh)
// • Sight: laser ngắn từ nòng ra 5m

export class Pistol extends WeaponBase {
  constructor(opts) {
    super({
      ...opts,
      soundKey:       'pistolShot',
      muzzleVelocity: 12,
      cooldownMs:     500,
    })

    this._fireHands = ['right']

    // Tạo mesh hình súng ngắn đơn giản
    this._buildMesh()
  }

  // ── Override ───────────────────────────────────────────────────────────────

  _updateAim(frame) {
    const session = this.renderer.xr.getSession()
    if (!session) return { held: false, aimDir: new THREE.Vector3(0, 0, -1), muzzlePos: new THREE.Vector3() }

    // Right controller grip (index 1 trên Quest)
    const grip = this.renderer.xr.getControllerGrip(1)
    if (!grip) return { held: false, aimDir: new THREE.Vector3(0, 0, -1), muzzlePos: new THREE.Vector3() }

    // Kiểm tra tay phải có đang hold súng (grip button >0.5)
    let rightGrip = 0
    for (const source of session.inputSources) {
      if (source.handedness === 'right' && source.gamepad) {
        rightGrip = source.gamepad.buttons[1]?.value ?? 0
      }
    }

    const held = rightGrip > 0.5

    // Gắn mesh súng vào grip
    if (held) {
      if (this.mesh.parent !== grip) {
        grip.add(this.mesh)
        // offset: súng nằm trong lòng bàn tay, nòng hướng về phía trước (-Z local)
        this.mesh.position.set(0, -0.03, -0.02)
        this.mesh.rotation.set(0, 0, 0)
      }
      this.mesh.visible = true
    } else {
      this.mesh.visible = false
    }

    // Aim direction: local -Z của grip → world direction
    const aimDir = new THREE.Vector3(0, 0, -1)
    aimDir.applyQuaternion(grip.quaternion).normalize()

    // Muzzle position: đầu nòng = vị trí grip + offset phía trước
    const muzzlePos = new THREE.Vector3()
    grip.getWorldPosition(muzzlePos)
    muzzlePos.addScaledVector(aimDir, 0.22)   // 22cm phía trước = đầu nòng

    return { held, aimDir, muzzlePos }
  }

  _fireHaptic() {
    this.haptic.vibrate('right', 80, 0.9)
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildMesh() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.07, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 })
    )
    body.position.set(0, 0, -0.07)

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 })
    )
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.02, -0.16)

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.09, 0.045),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.7 })
    )
    grip.position.set(0, -0.07, -0.04)
    grip.rotation.x = 0.2

    this.mesh.add(body, barrel, grip)
    this.mesh.visible = false
  }
}
