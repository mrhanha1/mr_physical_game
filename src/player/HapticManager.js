export class HapticManager {
  constructor(renderer) {
    this.renderer = renderer
  }

  vibrate(hand, duration = 100, intensity = 0.5) {
    const session = this.renderer.xr.getSession()
    if (!session) return

    for (const source of session.inputSources) {
      if (source.handedness === hand && source.gamepad?.hapticActuators?.[0]) {
        source.gamepad.hapticActuators[0].pulse(intensity, duration)
      }
    }
  }
}