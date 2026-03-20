import * as THREE from 'three'

// ComfortMenu — panel 3D cài đặt comfort
// Mở bằng cách bấm giữ button B (right) hoặc Y (left)
// Dùng RayPointer để toggle các option

const DEFAULTS = {
  snapTurnSpeed: 45,       // độ mỗi snap
  vignetteEnabled: true,
  dominantHand: 'right',   // 'left' | 'right'
}

export class ComfortMenu {
  constructor(scene, renderer, locomotion) {
    this.scene      = scene
    this.renderer   = renderer
    this.locomotion = locomotion

    // Load từ localStorage
    this.settings = {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem('comfortSettings') || '{}')
    }

    this._applyAll()

    this.mesh    = null
    this._canvas = null
    this._ctx    = null
    this._texture = null
    this._buttons = []   // { mesh, action } cho RayPointer
    this.isOpen  = false

    this._build()
  }

  open(playerPos, camFwd) {
    this.isOpen = true
    this.mesh.visible = true
    this._redraw()
    // Đặt trước mặt player
    this.mesh.position.copy(playerPos).addScaledVector(camFwd, 0.9)
    this.mesh.position.y = playerPos.y + 0.15
    this.mesh.lookAt(playerPos)
  }

  close() {
    this.isOpen = false
    this.mesh.visible = false
  }

  toggle(playerPos, camFwd) {
    this.isOpen ? this.close() : this.open(playerPos, camFwd)
  }

  // Gọi từ RayPointer.onSelect
  handleAction(action) {
    switch (action) {
      case 'snapTurn_dec':
        this.settings.snapTurnSpeed = Math.max(15, this.settings.snapTurnSpeed - 15)
        break
      case 'snapTurn_inc':
        this.settings.snapTurnSpeed = Math.min(90, this.settings.snapTurnSpeed + 15)
        break
      case 'vignette_toggle':
        this.settings.vignetteEnabled = !this.settings.vignetteEnabled
        break
      case 'hand_left':
        this.settings.dominantHand = 'left'
        break
      case 'hand_right':
        this.settings.dominantHand = 'right'
        break
    }
    this._applyAll()
    this._save()
    this._redraw()
  }

  getButtons() {
    return this._buttons
  }

  // ── Private ──

  _applyAll() {
    if (this.locomotion?.setSnapAngle) {
      this.locomotion.setSnapAngle(this.settings.snapTurnSpeed)
    }
    if (this.locomotion?.setVignette) {
      this.locomotion.setVignette(this.settings.vignetteEnabled)
    }
  }

  _save() {
    localStorage.setItem('comfortSettings', JSON.stringify(this.settings))
  }

  _build() {
    const W = 400, H = 300
    this._canvas = document.createElement('canvas')
    this._canvas.width = W
    this._canvas.height = H
    this._ctx = this._canvas.getContext('2d')
    this._texture = new THREE.CanvasTexture(this._canvas)

    const mat = new THREE.MeshBasicMaterial({
      map: this._texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), mat)
    this.mesh.visible = false
    this.scene.add(this.mesh)

    // Tạo button hitboxes
    const btnDefs = [
      { action: 'snapTurn_dec',    x: -0.1, y:  0.08 },
      { action: 'snapTurn_inc',    x:  0.1, y:  0.08 },
      { action: 'vignette_toggle', x:  0.0, y:  0.0  },
      { action: 'hand_left',       x: -0.1, y: -0.08 },
      { action: 'hand_right',      x:  0.1, y: -0.08 },
    ]

    for (const def of btnDefs) {
      const btn = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.05),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
      )
      btn.position.set(def.x, def.y, 0.001)
      btn.userData.action = def.action
      this.mesh.add(btn)
      this._buttons.push(btn)
    }

    this._redraw()
  }

  _redraw() {
    const ctx = this._ctx
    const W = 400, H = 300
    ctx.clearRect(0, 0, W, H)

    // BG
    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    ctx.roundRect(0, 0, W, H, 16)
    ctx.fill()

    ctx.fillStyle = '#00ffcc'
    ctx.font = 'bold 22px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('COMFORT SETTINGS', W / 2, 36)

    // Snap turn
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px monospace'
    ctx.fillText(`Snap Turn: ${this.settings.snapTurnSpeed}°`, W / 2, 95)
    this._btn(ctx, '−', 110, 80)
    this._btn(ctx, '+', 290, 80)

    // Vignette
    const vOn = this.settings.vignetteEnabled
    ctx.fillText('Vignette', W / 2, 148)
    this._btn(ctx, vOn ? 'ON ✓' : 'OFF', W / 2, 162, vOn ? '#00ff88' : '#ff4444')

    // Dominant hand
    ctx.fillText('Dominant Hand', W / 2, 210)
    const dL = this.settings.dominantHand === 'left'
    const dR = this.settings.dominantHand === 'right'
    this._btn(ctx, dL ? 'LEFT ✓' : 'LEFT',   110, 224, dL ? '#00ff88' : '#888888')
    this._btn(ctx, dR ? 'RIGHT ✓' : 'RIGHT', 290, 224, dR ? '#00ff88' : '#888888')

    this._texture.needsUpdate = true
  }

  _btn(ctx, label, cx, cy, color = '#aaaaaa') {
    ctx.fillStyle = color
    ctx.font = 'bold 15px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, cy)
  }
}
//sua lai ten file
