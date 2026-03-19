import * as THREE from 'three'

export class GestureDetector {
  constructor(handTracking) {
    this.ht = handTracking
    this.events = []
    this._punchCooldown = [0, 0]
  }

  update(dt) {
    this.events = []
    this._punchCooldown[0] -= dt
    this._punchCooldown[1] -= dt

    this.ht.hands.forEach((hand, i) => {
      if (!this.ht.isTracking[i]) return

      const vel = this.ht.getWristVelocity(i)
      const speed = vel.length()

      // PUNCH: velocity > 2 m/s
      if (speed > 2.0 && this._punchCooldown[i] <= 0) {
        this.events.push({
          gesture: 'PUNCH',
          hand: i === 0 ? 'left' : 'right',
          velocity: speed
        })
        this._punchCooldown[i] = 0.5
        console.log(`PUNCH detected, velocity: ${speed.toFixed(2)}m/s`)
      }

      // GRAB (pinch): index tip gần thumb tip
      const thumbTip = this.ht.getJointPosition(i, 'thumb-tip')
      const indexTip = this.ht.getJointPosition(i, 'index-finger-tip')
      if (thumbTip && indexTip) {
        const dist = thumbTip.distanceTo(indexTip)
        if (dist < 0.03) {
          this.events.push({ gesture: 'GRAB', hand: i === 0 ? 'left' : 'right' })
        }
      }

      // BLOCK: cả 2 tay wrist y cao hơn đầu (giả định đầu ~y=1.7)
      if (i === 1 && this.ht.isTracking[0] && this.ht.isTracking[1]) {
        const ly = this.ht.wristPositions[0].y
        const ry = this.ht.wristPositions[1].y
        if (ly > 1.5 && ry > 1.5) {
          this.events.push({ gesture: 'BLOCK', hand: 'both' })
        }
      }
    })
  }

  getEvents() {
    return this.events
  }
}