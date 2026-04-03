import * as THREE from 'three'

export class GamePanel {
  constructor(scene) {
    this.scene = scene
    this.mesh = null
    this._canvas = null
    this._ctx = null
    this._texture = null

    // Hitbox buttons cho RayPointer — vô hình, chỉ dùng để detect ray
    this.startButton   = null
    this.restartButton = null

    this._build()
  }

  showMenu(highScore) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, 'MR COMBAT', '#00ffcc')
      this._center(ctx, 'Press B button to START', '#aaaaaa', 28, 155)
      this._center(ctx, `High Score: ${highScore}`, '#ffdd88', 26, 195)
      this._button(ctx, 'B = START', 256, 260, '#00cc66')
    })
    this.mesh.visible = true
    this.startButton.visible   = true
    this.restartButton.visible = false
  }

  showWaveBreak(waveNumber, secondsLeft, score) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, `WAVE ${waveNumber} CLEARED!`, '#00ff88')
      this._center(ctx, `Score: ${score}`, '#ffffff', 32, 175)
      this._center(ctx, `Next wave in ${Math.ceil(secondsLeft)}s`, '#ffaa00', 28, 225)
    })
    this.mesh.visible = true
    this.startButton.visible   = false
    this.restartButton.visible = false
  }

  showGameOver(score, highScore) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, 'GAME OVER', '#ff4444')
      this._center(ctx, `Score: ${score}`, '#ffffff', 36, 165)
      const isNew = score >= highScore
      this._center(ctx, isNew ? 'NEW HIGH SCORE!' : `Best: ${highScore}`, '#ffdd88', 26, 210)
      this._button(ctx, 'B = RESTART', 256, 270, '#cc4400')
    })
    this.mesh.visible = true
    this.startButton.visible   = false
    this.restartButton.visible = true
  }

  updateBreakTimer(secondsLeft, waveNumber, score) {
    this.showWaveBreak(waveNumber, secondsLeft, score)
  }

  hide() {
    this.mesh.visible          = false
    this.startButton.visible   = false
    this.restartButton.visible = false
  }

  updateTime(t) { /* no-op */ }

  // ── Private ──

  _build() {
    const W = 512, H = 320
    this._canvas = document.createElement('canvas')
    this._canvas.width  = W
    this._canvas.height = H
    this._ctx = this._canvas.getContext('2d')

    this._texture = new THREE.CanvasTexture(this._canvas)

    const mat = new THREE.MeshBasicMaterial({
      map: this._texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.375), mat)
    this.mesh.visible = false
    this.scene.add(this.mesh)

    this.actionButton = this._makeHitbox('start', new THREE.Vector3(0, -0.10, 0.002))
    this.mesh.add(this.actionButton)
    
    this.startButton = this.restartButton = this.actionButton
  }

  _makeHitbox(action, offset) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.065),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    )
    mesh.position.copy(offset)
    mesh.userData.action = action
    return mesh
  }

  _draw(fn) {
    fn(this._ctx)
    this._texture.needsUpdate = true
  }

  _bg(ctx) {
    ctx.clearRect(0, 0, 512, 320)
    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.roundRect(0, 0, 512, 320, 20)
    ctx.fill()
  }

  _title(ctx, text, color) {
    ctx.fillStyle  = color
    ctx.font       = 'bold 46px monospace'
    ctx.textAlign  = 'center'
    ctx.fillText(text, 256, 75)
  }

  _center(ctx, text, color, size, y) {
    ctx.fillStyle = color
    ctx.font      = `${size}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(text, 256, y)
  }

  // Vẽ nút trực tiếp lên canvas — khớp vị trí hitbox
  _button(ctx, label, cx, cy, color) {
    const W = 220, H = 54
    const x = cx - W / 2
    const y = cy - H / 2
    ctx.fillStyle = color
    ctx.roundRect(x, y, W, H, 10)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font      = 'bold 26px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, cy + 9)
  }
}