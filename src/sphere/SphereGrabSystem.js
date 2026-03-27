import * as THREE from 'three'
import { SphereState } from './SphereManager.js'

// ─── SphereGrabSystem ──────────────────────────────────────────────────────
// Xử lý nhặt / thả / ném sphere bằng grip controller của Meta Quest 3.
//
// Cơ chế:
//  • Nhặt  : grip > 0.7 + có sphere FREE trong vòng 0.18m → gắn sphere vào tay
//  • Thả   : grip < 0.3 + đang cầm sphere → release với velocity ≈ 0
//  • Ném   : grip < 0.3 + tốc độ tay > THROW_THRESHOLD → apply throw velocity
//
// Trick Rapier "kinematic hold":
//  Không switch body type (không được runtime).
//  Thay vào đó khi held:
//    - setGravityScale(0)
//    - setLinearVelocity(0,0,0) + setAngularVelocity(0,0,0) mỗi frame
//    - teleport position theo tay bằng setTranslation

const THROW_THRESHOLD   = 1.2   // m/s — tốc độ tay tối thiểu để coi là ném
const THROW_SCALE       = 1.8   // nhân tốc độ để ném cảm giác mạnh hơn thực tế
const GRAB_RADIUS       = 0.18  // m
const HISTORY_FRAMES    = 5     // số frame lưu velocity history

export class SphereGrabSystem {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {import('./SphereManager.js').SphereManager} sphereManager
   * @param {import('../player/ControllerInput.js').ControllerInput} controllerInput
   * @param {import('../player/HapticManager.js').HapticManager} haptic
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   */
  constructor(renderer, sphereManager, controllerInput, haptic, audio) {
    this.renderer      = renderer
    this.sphereManager = sphereManager
    this.input         = controllerInput
    this.haptic        = haptic
    this.audio         = audio

    // Sphere đang được cầm mỗi tay: { data, offset }
    this._held = { left: null, right: null }

    // Lịch sử vị trí tay để tính throw velocity
    this._handHistory = {
      left:  [],   // [{pos: THREE.Vector3, time: number}]
      right: [],
    }

    // Trạng thái grip liên tục
    this._gripVal = { left: 0, right: 0 }

    // tmp vectors (tránh GC)
    this._tmpPos   = new THREE.Vector3()
    this._tmpVel   = new THREE.Vector3()
    this._zeroVec3 = { x: 0, y: 0, z: 0 }
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * Gọi mỗi frame trong animation loop.
   * @param {number} dt - delta time (s)
   * @param {XRFrame} frame
   */
  update(dt, frame) {
    const session = this.renderer.xr.getSession()
    if (!session) return

    for (const source of session.inputSources) {
      const hand = source.handedness    // 'left' | 'right'
      if (hand === 'none') continue
      const gp = source.gamepad
      if (!gp) continue

      const gripVal   = gp.buttons[1]?.value ?? 0
      const prevGrip  = this._gripVal[hand] ?? 0
      this._gripVal[hand] = gripVal

      // Lấy world position của controller grip
      const controllers = [
        this.renderer.xr.getControllerGrip(0),
        this.renderer.xr.getControllerGrip(1),
      ]
      const gripObj = controllers.find(c => c.inputSource?.handedness === hand)
      if (!gripObj) continue
      gripObj.getWorldPosition(this._tmpPos)
      const handPos = this._tmpPos.clone()

      // Cập nhật lịch sử vị trí tay
      this._pushHistory(hand, handPos)

      // ── Nhặt ──
      if (gripVal > 0.7 && prevGrip <= 0.7 && !this._held[hand]) {
        const sphere = this.sphereManager.findNearestFree(handPos, GRAB_RADIUS)
        if (sphere) {
          this._grabSphere(hand, sphere, gripObj)
        }
      }

      // ── Update vị trí sphere đang cầm ──
      if (this._held[hand]) {
        this._updateHeldPosition(hand, gripObj)
      }

      // ── Thả / Ném ──
      if (gripVal < 0.3 && prevGrip >= 0.3 && this._held[hand]) {
        const throwVelocity = this._computeThrowVelocity(hand)
        this._releaseSphere(hand, throwVelocity)
      }
    }
  }

  /**
   * Sphere nào đang được tay phải cầm (để WeaponBase kiểm tra)
   */
  getHeldByHand(hand) {
    return this._held[hand]?.data ?? null
  }

  /**
   * Tách sphere khỏi tay (được gọi khi nạp vào súng).
   * @param {string} hand
   * @returns {object|null} sphereData
   */
  detachForWeapon(hand) {
    const held = this._held[hand]
    if (!held) return null

    const { data, gripObj } = held
    // Gỡ mesh khỏi grip group
    if (data.mesh.parent === gripObj) gripObj.remove(data.mesh)
    this.sphereManager.scene.add(data.mesh)

    data.state  = SphereState.LOADED_IN_WEAPON
    data.heldBy = null

    // Restore gravity để WeaponBase quyết định tiếp
    data.body.setGravityScale(1.0, true)

    this._held[hand] = null
    return data
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _grabSphere(hand, sphereData, gripObj) {
    const { body, mesh } = sphereData

    // Kinematic trick: zero gravity + high damping
    body.setGravityScale(0.0, true)
    body.setLinearDamping(20)
    body.setAngularDamping(20)
    body.setLinVel(this._zeroVec3, true)
    body.setAngVel(this._zeroVec3, true)

    // Gắn mesh vào group của controller grip (nhìn tự nhiên hơn)
    const worldPos = new THREE.Vector3()
    mesh.getWorldPosition(worldPos)
    gripObj.worldToLocal(worldPos)     // convert sang local space của grip
    this.sphereManager.scene.remove(mesh)
    gripObj.add(mesh)
    mesh.position.copy(worldPos)
    mesh.position.y += 0.01           // offset nhỏ lên trên lòng bàn tay

    sphereData.state  = SphereState.HELD
    sphereData.heldBy = hand

    this._held[hand] = { data: sphereData, gripObj }

    // Feedback
    this.haptic.vibrate(hand, 60, 0.5)
    this.audio?.play('spherePickup')

    console.log(`[Grab] ${hand} hand grabbed ${sphereData.typeKey}`)
  }

  _updateHeldPosition(hand, gripObj) {
    const { data } = this._held[hand]
    const body     = data.body

    // Tính world position của mesh (đang là child của grip)
    const worldPos = new THREE.Vector3()
    data.mesh.getWorldPosition(worldPos)

    // Teleport Rapier body tới vị trí đó
    body.setTranslation({ x: worldPos.x, y: worldPos.y, z: worldPos.z }, true)
    body.setLinVel(this._zeroVec3, true)
    body.setAngVel(this._zeroVec3, true)
  }

  _releaseSphere(hand, throwVelocity) {
    const { data, gripObj } = this._held[hand]
    const { body, mesh }    = data

    // Tách mesh khỏi grip → trả về scene
    const worldPos = new THREE.Vector3()
    mesh.getWorldPosition(worldPos)
    gripObj.remove(mesh)
    this.sphereManager.scene.add(mesh)
    mesh.position.copy(worldPos)

    // Restore physics
    body.setGravityScale(1.0, true)
    body.setLinearDamping(0.05)
    body.setAngularDamping(0.3)

    const speed = throwVelocity.length()
    if (speed > THROW_THRESHOLD) {
      // Ném
      const v = throwVelocity.multiplyScalar(THROW_SCALE)
      body.setLinVel({ x: v.x, y: v.y, z: v.z }, true)
      this.haptic.vibrate(hand, 100, 0.8)
      this.audio?.play('sphereThrow')
      console.log(`[Grab] ${hand} threw at ${speed.toFixed(2)} m/s`)
    } else {
      // Thả nhẹ
      body.setLinVel(this._zeroVec3, true)
      this.audio?.play('sphereDrop')
    }

    data.state  = SphereState.FREE
    data.heldBy = null
    this._held[hand] = null
  }

  _pushHistory(hand, pos) {
    const hist = this._handHistory[hand]
    hist.push({ pos: pos.clone(), time: performance.now() })
    if (hist.length > HISTORY_FRAMES) hist.shift()
  }

  _computeThrowVelocity(hand) {
    const hist = this._handHistory[hand]
    if (hist.length < 2) return new THREE.Vector3()

    const newest = hist[hist.length - 1]
    const oldest = hist[0]
    const dt     = (newest.time - oldest.time) / 1000   // s

    if (dt < 0.001) return new THREE.Vector3()

    return newest.pos.clone().sub(oldest.pos).divideScalar(dt)
  }
}
