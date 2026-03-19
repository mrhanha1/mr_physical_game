export class ControllerInput {
  constructor(renderer) {
    this.session = null
    this.events = []  // queue các action event
    this.renderer = renderer

    this._thumbstickX = [0, 0]
    this._triggerVal = [0, 0]
    this._gripVal = [0, 0]
  }

  update(frame) {
    const session = this.renderer.xr.getSession()
    if (!session) return

    this.events = []

    for (const source of session.inputSources) {
      const h = source.handedness  // 'left' | 'right'
      const gp = source.gamepad
      if (!gp) continue

      const idx = h === 'left' ? 0 : 1

      // Trigger
      const trigger = gp.buttons[0]?.value ?? 0
      if (trigger > 0.7 && this._triggerVal[idx] <= 0.7)
        this.events.push({ action: 'shoot', hand: h })
      this._triggerVal[idx] = trigger

      // Grip
      const grip = gp.buttons[1]?.value ?? 0
      if (grip > 0.7 && this._gripVal[idx] <= 0.7)
        this.events.push({ action: 'grab', hand: h })
      if (grip < 0.3 && this._gripVal[idx] >= 0.7)
        this.events.push({ action: 'release', hand: h })
      this._gripVal[idx] = grip

      // Thumbstick
      this._thumbstickX[idx] = gp.axes[2] ?? 0

      // Button A (right) / X (left)
      if (gp.buttons[4]?.pressed)
        this.events.push({ action: 'reload', hand: h })
    }
  }

  getThumbstickX(hand) {
    return this._thumbstickX[hand === 'left' ? 0 : 1]
  }

  getEvents() {
    return this.events
  }
}