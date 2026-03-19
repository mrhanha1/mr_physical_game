export class XRSession {
  constructor(renderer) {
    this.renderer = renderer
    this.session = null
  }

  async init() {
    const supported = await navigator.xr?.isSessionSupported('immersive-ar')
    if (!supported) {
      alert('WebXR immersive-ar không được hỗ trợ trên thiết bị này')
      return
    }

    document.getElementById('enter-ar').addEventListener('click', () => {
      this.startSession()
    })
  }

  async startSession() {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor', 'bounded-floor'],
      optionalFeatures: [
        'plane-detection',
        'mesh-detection',
        'hand-tracking',
        'anchors',
        'depth-sensing',
        'light-estimation'
      ]
    })

    this.session = session
    this.renderer.xr.setSession(session)
    document.getElementById('enter-ar').style.display = 'none'

    session.addEventListener('end', () => {
      document.getElementById('enter-ar').style.display = 'block'
    })
  }
}