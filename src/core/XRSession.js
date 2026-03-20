export class XRSession {
  constructor(renderer) {
    this.renderer = renderer
    this.session = null
  }

  async init() {
    console.log('[XR] Checking support...')
    const supported = await navigator.xr?.isSessionSupported('immersive-ar')
    console.log('[XR] immersive-ar supported:', supported)

    if (!supported) {
      alert('WebXR immersive-ar không được hỗ trợ trên thiết bị này')
      return
    }

    const btn = document.getElementById('enter-ar')
    if (!btn) {
      console.error('[XR] Button #enter-ar not found!')
      return
    }

    console.log('[XR] Button found, waiting for click...')
    btn.addEventListener('click', () => {
      console.log('[XR] Button clicked!')
      this.startSession()
    })
  }

  async startSession() {
    console.log('[XR] Requesting session...')
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: [
          'plane-detection',
          'mesh-detection',
          'hand-tracking',
          'anchors',
          'depth-sensing',
          'light-estimation',
        ],
        depthSensing: {
          usagePreference: ['cpu-optimized'],
          dataFormatPreference: ['luminance-alpha'],
        }
      })

      console.log('[XR] Session granted:', session)
      await this.renderer.renderer.xr.setSession(session)
      console.log('[XR] Session set on renderer')

      document.getElementById('enter-ar').style.display = 'none'

      session.addEventListener('end', () => {
        console.log('[XR] Session ended')
        document.getElementById('enter-ar').style.display = 'block'
      })

    } catch (e) {
      console.error('[XR] startSession failed:', e.name, e.message)
      alert('XR Error: ' + e.name + ' - ' + e.message)
    }
  }
}