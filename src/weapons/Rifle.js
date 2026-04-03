import * as THREE from 'three'
import { WeaponBase } from './WeaponBase.js'

// ─── Rifle (Súng trường) ───────────────────────────────────────────────────
// • 2 tay cầm: right cầm cò (trigger), left cầm foregrip (stabilize)
// • Aim: weighted average hướng 2 tay → stable hơn pistol
// • Muzzle velocity: ~22 m/s (mạnh hơn pistol)
// • Cooldown: 800ms
// • Condition: chỉ bắn khi 2 tay gần nhau (khoảng cách < 0.65m)
//   → buộc người chơi cầm đúng tư thế 2 tay
// • Sight: laser dài hơn từ nòng

const TWO_HAND_MAX_DIST = 0.65    // m — khoảng cách tối đa giữa 2 tay khi cầm

export class Rifle extends WeaponBase {
  constructor(opts) {
    super({
      ...opts,
      soundKey:       'rifleShot',
      muzzleVelocity: 22,
      cooldownMs:     800,
    })

    this._fireHands = ['left', 'right']

    // Lưu riêng aim direction được smoothed
    this._smoothedAimDir = new THREE.Vector3(0, 0, -1)

    this._buildMesh()
  }

  // ── Override ───────────────────────────────────────────────────────────────

  _updateAim(frame) {
    const session = this.renderer.xr.getSession()
    if (!session) return { held: false, aimDir: this._smoothedAimDir, muzzlePos: new THREE.Vector3() }

    const leftGrip  = this.renderer.xr.getControllerGrip(0)
    const rightGrip = this.renderer.xr.getControllerGrip(1)
    if (!leftGrip || !rightGrip) return { held: false, aimDir: this._smoothedAimDir, muzzlePos: new THREE.Vector3() }

    // Đọc grip values
    let leftGripVal = 0, rightGripVal = 0
    for (const source of session.inputSources) {
      const gp = source.gamepad
      if (!gp) continue
      if (source.handedness === 'left')  leftGripVal  = gp.buttons[1]?.value ?? 0
      if (source.handedness === 'right') rightGripVal = gp.buttons[1]?.value ?? 0
    }

    // Cả 2 tay phải cầm
    const bothHeld = rightGripVal > 0.5 && leftGripVal > 0.5

    // Khoảng cách 2 tay
    const leftPos  = new THREE.Vector3()
    const rightPos = new THREE.Vector3()
    leftGrip.getWorldPosition(leftPos)
    rightGrip.getWorldPosition(rightPos)
    const handsDist = leftPos.distanceTo(rightPos)

    const held = bothHeld && handsDist < TWO_HAND_MAX_DIST

    if (held) {
      // Gắn mesh vào right grip (right = cầm cò)
      if (this.mesh.parent !== rightGrip) {
        rightGrip.add(this.mesh)
        this.mesh.position.set(0, -0.02, -0.1)
        this.mesh.rotation.set(0, 0, 0)
      }
      this.mesh.visible = true

      // ── Aim bằng average hướng 2 tay ──
      // Hướng right controller
      const rightAim = new THREE.Vector3(0, 0, -1).applyQuaternion(rightGrip.quaternion)
      // Vector từ right grip → left grip (foregrip direction)
      const forwardVec = leftPos.clone().sub(rightPos).normalize().negate()

      // Weighted blend: right = 0.6, foregrip direction = 0.4
      const rawAim = rightAim.clone().lerp(forwardVec, 0.4).normalize()

      // Smooth aim qua 60% mỗi frame để giảm jitter
      this._smoothedAimDir.lerp(rawAim, 0.6).normalize()

      // Muzzle ở đầu nòng = right grip + aimDir * 0.45m (nòng dài hơn)
      const muzzlePos = new THREE.Vector3()
      rightGrip.getWorldPosition(muzzlePos)
      muzzlePos.addScaledVector(this._smoothedAimDir, 0.45)

      return { held, aimDir: this._smoothedAimDir.clone(), muzzlePos }

    } else {
      this.mesh.visible = false
      return { held: false, aimDir: this._smoothedAimDir.clone(), muzzlePos: new THREE.Vector3() }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildMesh() {
    // Body chính súng trường
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.055, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.4 })
    )
    body.position.set(0, 0, -0.15)

    // Nòng súng
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x0d0d0d, metalness: 0.95, roughness: 0.1 })
    )
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.025, -0.35)

    // Cổ báng (pistol grip phía sau)
    const pistolGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.085, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0a, metalness: 0.1, roughness: 0.9 })
    )
    pistolGrip.position.set(0, -0.065, 0.06)
    pistolGrip.rotation.x = 0.25

    // Foregrip (tay trái cầm)
    const foreGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.07, 0.038),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0a, metalness: 0.1, roughness: 0.9 })
    )
    foreGrip.position.set(0, -0.05, -0.28)
    foreGrip.rotation.x = 0.15

    // Stock (báng súng)
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.05, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.6 })
    )
    stock.position.set(0, -0.01, 0.17)

    // Scope đơn giản
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 })
    )
    scope.rotation.x = Math.PI / 2
    scope.position.set(0, 0.045, -0.1)

    this.mesh.add(body, barrel, pistolGrip, foreGrip, stock, scope)
    this.mesh.visible = false
  }
}
