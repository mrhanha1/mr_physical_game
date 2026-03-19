import * as THREE from 'three'

const HIT_RADIUS = 0.12       // m — sphere cast quanh nắm đấm
const MIN_VELOCITY = 1.5      // m/s — ngưỡng damage
const COMBO_WINDOW = 2.0      // giây
const COMBO_COUNT = 3

export class MeleeSystem {
  constructor(renderer, scene) {
    this.renderer = renderer

    this._prevPos = [new THREE.Vector3(), new THREE.Vector3()]
    this._velocity = [new THREE.Vector3(), new THREE.Vector3()]
    this._comboCounts = [0, 0]
    this._comboTimers = [0, 0]
    this._hitCooldown = [0, 0]
  }

  update(dt, enemies, haptic) {
    const session = this.renderer.xr.getSession()
    if (!session) return

    this._comboTimers[0] -= dt
    this._comboTimers[1] -= dt
    this._hitCooldown[0] -= dt
    this._hitCooldown[1] -= dt

    for (const source of session.inputSources) {
      const h = source.handedness
      const i = h === 'left' ? 0 : 1
      const ctrl = this.renderer.xr.getController(i)

      const currentPos = new THREE.Vector3()
      ctrl.getWorldPosition(currentPos)

      // Tính velocity
      this._velocity[i]
        .subVectors(currentPos, this._prevPos[i])
        .divideScalar(dt)
      this._prevPos[i].copy(currentPos)

      const speed = this._velocity[i].length()
      if (speed < MIN_VELOCITY || this._hitCooldown[i] > 0) continue

      // Sphere cast: kiểm tra enemy trong bán kính
      for (const enemy of enemies) {
        if (enemy.isDead) continue

        const dist = currentPos.distanceTo(enemy.mesh.position)
        if (dist > HIT_RADIUS + 0.5) continue  // 0.5 = approx enemy radius

        const damage = Math.round(speed * 8)
        enemy.takeDamage(damage, 'body')
        haptic.vibrate(h, 120, Math.min(speed / 5, 1))
        this._hitCooldown[i] = 0.3

        // Combo
        if (this._comboTimers[i] > 0) {
          this._comboCounts[i]++
        } else {
          this._comboCounts[i] = 1
        }
        this._comboTimers[i] = COMBO_WINDOW

        if (this._comboCounts[i] >= COMBO_COUNT) {
          console.log(`[Melee] COMBO x${this._comboCounts[i]}! Bonus damage`)
          enemy.takeDamage(damage * 2, 'body')
          this._comboCounts[i] = 0
        }

        console.log(`[Melee] PUNCH ${h} - speed: ${speed.toFixed(2)}m/s - dmg: ${damage}`)
        break
      }
    }
  }
}