import * as THREE from 'three'

// ── GamePanel.js ──────────────────────────────────────────────────────────
// Thêm: showModeSelect() — màn chọn AR / Flatscreen trước khi vào game.
// Callback onModeSelect(mode) để main.js lắng nghe.
// Các method còn lại giữ nguyên.

export class GamePanel {
  constructor(scene) {
    this.scene  = scene
    this.mesh   = null
    this._canvas  = null
    this._ctx     = null
    this._texture = null

    this.startButton   = null
    this.restartButton = null
    this.arButton      = null
    this.flatButton    = null

    // Callback — gán từ bên ngoài
    this.onModeSelect = null   // (mode: 'ar' | 'flatscreen') => void

    this._build()
  }

  // ── Màn chọn mode (hiện đầu tiên, trước XR session) ─────────────────
  showModeSelect() {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, 'GEM BONG MAU', '#00ffcc')
      this._center(ctx, 'Chọn chế độ chơi', '#aaaaaa', 26, 150)
      this._button(ctx, '🥽  AR / Mixed Reality', 256, 215, '#0077cc')
      this._button(ctx, '🖥️  Flatscreen',         256, 282, '#445566')
    })
    this.mesh.visible        = true
    this.arButton.visible    = true
    this.flatButton.visible  = true
    this.startButton.visible = false
    this.restartButton.visible = false
  }

  // ── Menu Start/Restart (sau khi đã chọn mode) ────────────────────────
  showMenu(highScore) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, 'GEM BONG MAU', '#00ffcc')
      this._center(ctx, 'Press B button to START', '#aaaaaa', 28, 155)
      this._center(ctx, `High Score: ${highScore}`, '#ffdd88', 26, 195)
      this._button(ctx, 'B = START', 256, 260, '#00cc66')
    })
    this.mesh.visible          = true
    this.startButton.visible   = true
    this.restartButton.visible = false
    this.arButton.visible      = false
    this.flatButton.visible    = false
  }

  showWaveBreak(waveNumber, secondsLeft, score) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, `WAVE ${waveNumber} CLEARED!`, '#00ff88')
      this._center(ctx, `Score: ${score}`, '#ffffff', 32, 175)
      this._center(ctx, `Next wave in ${Math.ceil(secondsLeft)}s`, '#ffaa00', 28, 225)
    })
    this.mesh.visible          = true
    this.startButton.visible   = false
    this.restartButton.visible = false
    this.arButton.visible      = false
    this.flatButton.visible    = false
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
    this.mesh.visible          = true
    this.startButton.visible   = false
    this.restartButton.visible = true
    this.arButton.visible      = false
    this.flatButton.visible    = false
  }

  updateBreakTimer(secondsLeft, waveNumber, score) {
    this.showWaveBreak(waveNumber, secondsLeft, score)
  }

  hide() {
    this.mesh.visible          = false
    this.startButton.visible   = false
    this.restartButton.visible = false
    this.arButton.visible      = false
    this.flatButton.visible    = false
  }

  updateTime(t) { /* no-op */ }

  // ── Private ──────────────────────────────────────────────────────────

  _build() {
    const W = 512, H = 340
    this._canvas        = document.createElement('canvas')
    this._canvas.width  = W
    this._canvas.height = H
    this._ctx           = this._canvas.getContext('2d')
    this._texture       = new THREE.CanvasTexture(this._canvas)

    const mat = new THREE.MeshBasicMaterial({
      map: this._texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    this.mesh         = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), mat)
    this.mesh.visible = false
    this.scene.add(this.mesh)

    // Hitbox: nút Start/Restart (dùng chung 1 hitbox, đổi action theo context)
    this.actionButton  = this._makeHitbox('start',   new THREE.Vector3(0, -0.10, 0.002))
    this.mesh.add(this.actionButton)
    this.startButton   = this.actionButton
    this.restartButton = this.actionButton

    // Hitbox: nút AR (trên)
    this.arButton = this._makeHitbox('ar', new THREE.Vector3(0, 0.02, 0.002))
    this.arButton.scale.set(1.8, 1.2, 1)   // rộng hơn nút thường
    this.mesh.add(this.arButton)

    // Hitbox: nút Flatscreen (dưới)
    this.flatButton = this._makeHitbox('flatscreen', new THREE.Vector3(0, -0.08, 0.002))
    this.flatButton.scale.set(1.8, 1.2, 1)
    this.mesh.add(this.flatButton)

    // Ẩn tất cả ban đầu
    this.actionButton.visible = false
    this.arButton.visible     = false
    this.flatButton.visible   = false
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
    ctx.clearRect(0, 0, 512, 340)
    ctx.fillStyle = 'rgba(0,0,0,0.88)'
    ctx.roundRect(0, 0, 512, 340, 20)
    ctx.fill()
  }

  _title(ctx, text, color) {
    ctx.fillStyle = color
    ctx.font      = 'bold 46px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(text, 256, 75)
  }

  _center(ctx, text, color, size, y) {
    ctx.fillStyle = color
    ctx.font      = `${size}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(text, 256, y)
  }

  _button(ctx, label, cx, cy, color) {
    const W = 320, H = 54
    const x = cx - W / 2
    const y = cy - H / 2
    ctx.fillStyle = color
    ctx.roundRect(x, y, W, H, 10)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font      = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, cy + 9)
  }
}