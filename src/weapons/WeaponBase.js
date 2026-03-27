import * as THREE from 'three'
import { SphereState } from '../sphere/SphereManager.js'

// ─── WeaponBase ────────────────────────────────────────────────────────────
// Base class cho súng ngắn và súng trường.
// Quy ước:
//  - Muzzle velocity (m/s) × aimDirection → initial velocity của sphere
//  - Gravity xử lý bởi Rapier (-9.81 m/s²)
//  - Sight line: đường thẳng từ muzzle theo aimDir, visualized bằng Line helper

export class WeaponBase {
  /**
   * @param {object} opts
   * @param {THREE.WebGLRenderer} opts.renderer
   * @param {THREE.Scene} opts.scene
   * @param {import('../sphere/SphereManager.js').SphereManager} opts.sphereManager
   * @param {import('../player/HapticManager.js').HapticManager} opts.haptic
   * @param {import('../audio/AudioManager.js').AudioManager} opts.audio
   * @param {string} opts.soundKey - key âm thanh bắn trong SoundBank
   * @param {number} opts.muzzleVelocity - m/s
   * @param {number} opts.cooldownMs - cooldown giữa các phát bắn (ms)
   */
  constructor({ renderer, scene, sphereManager, haptic, audio, soundKey, muzzleVelocity, cooldownMs }) {
    this.renderer      = renderer
    this.scene         = scene
    this.sphereManager = sphereManager
    this.haptic        = haptic
    this.audio         = audio
    this.soundKey      = soundKey
    this.muzzleVelocity = muzzleVelocity
    this.cooldownMs    = cooldownMs

    // Sphere đã nạp vào buồng đạn
    this._chambered    = null

    // Trạng thái cò trigger (edge trigger)
    this._triggerPrev  = { right: 0 }

    // Cooldown
    this._lastFiredAt  = 0

    // Mesh súng (subclass tạo + gắn vào đây)
    this.mesh          = new THREE.Group()
    scene.add(this.mesh)

    // Sight line helper (hiện khi cầm súng)
    this._sightLine    = this._buildSightLine()
    scene.add(this._sightLine)
    this._sightLine.visible = false

    // Aim direction tính ở mỗi frame (subclass update)
    this._aimDir       = new THREE.Vector3(0, 0, -1)
    this._muzzlePos    = new THREE.Vector3()

    // Grip đang cầm
    this._isHeld       = false
  }

  // ── Abstract-ish — subclass MUST override ─────────────────────────────────

  /** Cập nhật vị trí mesh súng + aim direction. Trả về {held, aimDir, muzzlePos}. */
  _updateAim(frame) { throw new Error('_updateAim() not implemented') }

  /** Haptic pattern khi bắn. */
  _fireHaptic() {}

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * Gọi mỗi frame.
   * @param {XRFrame} frame
   * @param {number} dt
   * @param {import('../sphere/SphereGrabSystem.js').SphereGrabSystem} grabSystem
   */
  update(frame, dt, grabSystem) {
    if (!frame) return

    // Cập nhật aim (position mesh, aimDir, muzzlePos)
    const { held, aimDir, muzzlePos } = this._updateAim(frame)
    this._isHeld = held

    if (held) {
      this._aimDir.copy(aimDir)
      this._muzzlePos.copy(muzzlePos)

      // Hiện sight line
      this._sightLine.visible = true
      this._updateSightLine(muzzlePos, aimDir)

      // Cố gắng nạp sphere từ tay cầm (nếu chamber trống)
      if (!this._chambered) {
        this._tryLoad(grabSystem, frame)
      }

      // Kiểm tra trigger để bắn
      this._checkFire(frame)
    } else {
      this._sightLine.visible = false
      this.mesh.visible       = false
    }
  }

  /** True nếu buồng đạn có sphere */
  get isLoaded() { return this._chambered !== null }

  // ── Protected helpers ─────────────────────────────────────────────────────

  /**
   * Bắn sphere trong chamber.
   * @param {string[]} hapticHands - tay nào rung
   */
  _fire(hapticHands = ['right']) {
    const now = performance.now()
    if (now - this._lastFiredAt < this.cooldownMs) return
    if (!this._chambered) return

    const sphere = this._chambered
    this._chambered = null

    // Đặt sphere ra khỏi nòng súng
    sphere.state = SphereState.FREE
    const pos    = this._muzzlePos.clone().addScaledVector(this._aimDir, 0.05)
    sphere.mesh.position.copy(pos)

    // Apply velocity vật lý lên Rapier body
    sphere.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true)
    sphere.body.setGravityScale(1.0, true)
    sphere.body.setLinearDamping(0.02)
    sphere.body.setAngularDamping(0.1)

    const v = this._aimDir.clone().multiplyScalar(this.muzzleVelocity)
    sphere.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true)

    // Xoay theo hướng bay
    const randomSpin = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 20 }
    sphere.body.setAngvel(randomSpin, true)

    this._lastFiredAt = now

    // Feedback
    for (const hand of hapticHands) this.haptic.vibrate(hand, 80, 0.9)
    this.audio?.play(this.soundKey)

    console.log(`[Weapon] Fired ${sphere.typeKey} at ${this.muzzleVelocity} m/s`)
  }

  /**  Cố nạp sphere từ grab system (tay đang cầm gần nòng). Subclass gọi. */
  _tryLoad(grabSystem, frame) {
    // Tìm sphere FREE gần mozzle nhất (radius nhỏ)
    const nearby = this.sphereManager.findNearestFreeForLoad(this._muzzlePos, 0.14)
    if (nearby) {
      this._loadSphere(nearby)
      return
    }

    // Hoặc lấy từ tay trái đang cầm
    const leftHeld = grabSystem.getHeldByHand('left')
    if (leftHeld) {
      const fromLeft = grabSystem.detachForWeapon('left')
      if (fromLeft) {
        this._loadSphere(fromLeft)
      }
    }
  }

  _loadSphere(sphereData) {
    sphereData.state  = SphereState.LOADED_IN_WEAPON
    sphereData.heldBy = null

    // Ẩn sphere + tắt physics (gravity 0, dừng velocity)
    sphereData.body.setGravityScale(0, true)
    sphereData.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    sphereData.body.setAngvel({ x: 0, y: 0, z: 0 }, true)

    // Hiện sphere nhỏ trong buồng đạn (gắn vào chamber point trên mesh súng)
    this.mesh.add(sphereData.mesh)
    sphereData.mesh.position.set(0, 0.02, -0.08)   // offset vào trong súng
    sphereData.mesh.scale.setScalar(0.6)            // nhỏ lại khi trong buồng

    this._chambered = sphereData
    this.audio?.play('sphereLoad')
    console.log(`[Weapon] Loaded ${sphereData.typeKey}`)
  }

  /** Đọc trigger + gọi _fire nếu đủ điều kiện. Subclass override nếu cần thêm điều kiện. */
  _checkFire(frame) {
    const session = this.renderer.xr.getSession()
    if (!session) return

    for (const source of session.inputSources) {
      if (source.handedness !== 'right') continue
      const gp = source.gamepad
      if (!gp) continue

      const trigVal = gp.buttons[0]?.value ?? 0
      const prev    = this._triggerPrev.right

      // Edge trigger: từ < 0.8 lên > 0.8
      if (trigVal > 0.8 && prev <= 0.8) {
        this._fire(this._fireHands)
      }
      this._triggerPrev.right = trigVal
    }
  }

  // ── Sight line ─────────────────────────────────────────────────────────────

  _buildSightLine() {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(6)     // 2 điểm × 3
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    return new THREE.Line(geo, mat)
  }

  _updateSightLine(muzzlePos, aimDir) {
    const far  = muzzlePos.clone().addScaledVector(aimDir, 5)
    const attr = this._sightLine.geometry.attributes.position
    attr.setXYZ(0, muzzlePos.x, muzzlePos.y, muzzlePos.z)
    attr.setXYZ(1, far.x, far.y, far.z)
    attr.needsUpdate = true
  }
}
