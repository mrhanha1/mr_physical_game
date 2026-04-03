export class ControllerInput {
  constructor(renderer) {
    this.renderer = renderer
    this.events = []

    this._thumbstickX = [0, 0]
    this._thumbstickY = [0, 0]
    this._triggerVal  = [0, 0]
    this._gripVal     = [0, 0]
    this._btn5Prev    = [false, false]
  }

  update(frame) {
    const session = this.renderer.xr.getSession()
    if (!session) return
    this.events = []

    for (const source of session.inputSources) {
      const h   = source.handedness
      const gp  = source.gamepad
      if (!gp) continue
      const idx = h === 'left' ? 0 : 1

      const trigger = gp.buttons[0]?.value ?? 0
      if (trigger > 0.7 && this._triggerVal[idx] <= 0.7)
        this.events.push({ action: 'shoot', hand: h })
      this._triggerVal[idx] = trigger

      const grip = gp.buttons[1]?.value ?? 0
      if (grip > 0.7 && this._gripVal[idx] <= 0.7)
        this.events.push({ action: 'grab', hand: h })
      if (grip < 0.3 && this._gripVal[idx] >= 0.7)
        this.events.push({ action: 'release', hand: h })
      this._gripVal[idx] = grip

      this._thumbstickX[idx] = gp.axes[2] ?? 0
      this._thumbstickY[idx] = gp.axes[3] ?? 0

      if (gp.buttons[4]?.pressed)
        this.events.push({ action: 'reload', hand: h })

      const btn5 = gp.buttons[5]?.pressed ?? false
      if (btn5 && !this._btn5Prev[idx])
        this.events.push({ action: 'start_game', hand: h })
      this._btn5Prev[idx] = btn5
    }
  }

  getThumbstickX(hand) { return this._thumbstickX[hand === 'left' ? 0 : 1] }
  getThumbstickY(hand) { return this._thumbstickY[hand === 'left' ? 0 : 1] }
  getEvents()          { return this.events }
}