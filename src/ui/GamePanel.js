import * as THREE from 'three'
import { GameState } from '../game/WaveManager.js'
import hologramVert from '../shaders/hologram.vert?raw'
import hologramFrag from '../shaders/hologram.frag?raw'

// Panel 3D nổi trước mặt người chơi
// Hiển thị: menu start, wave info, score, break countdown, game over

export class GamePanel {
  constructor(scene) {
    this.scene = scene
    this.mesh = null
    this._canvas = null
    this._ctx = null
    this._texture = null

    // Button hitbox cho RayPointer
    this.startButton = null
    this.restartButton = null

    this._build()
  }

  // ── Show modes ──

  showMenu(highScore) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, 'MR COMBAT', '#00ffcc')
      this._center(ctx, 'Point your ray at START', '#aaaaaa', 36, 160)
      this._center(ctx, `High Score: ${highScore}`, '#ffdd88', 28, 220)
    })
    this._positionInFront()
    this.mesh.visible = true
    this.startButton.visible = true
    this.restartButton.visible = false
  }

  showWaveBreak(waveNumber, secondsLeft, score) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, `WAVE ${waveNumber} CLEARED!`, '#00ff88')
      this._center(ctx, `Score: ${score}`, '#ffffff', 32, 170)
      this._center(ctx, `Next wave in ${Math.ceil(secondsLeft)}s`, '#ffaa00', 28, 220)
    })
    this._positionInFront()
    this.mesh.visible = true
    this.startButton.visible = false
    this.restartButton.visible = false
  }

  showGameOver(score, highScore) {
    this._draw(ctx => {
      this._bg(ctx)
      this._title(ctx, 'GAME OVER', '#ff4444')
      this._center(ctx, `Score: ${score}`, '#ffffff', 36, 170)
      const isNew = score >= highScore
      this._center(ctx, isNew ? `NEW HIGH SCORE!` : `High Score: ${highScore}`, '#ffdd88', 26, 215)
    })
    this._positionInFront()
    this.mesh.visible = true
    this.startButton.visible = false
    this.restartButton.visible = true
  }

  showScorePopup(delta, label, worldPos) {
    // Floating text — separate small plane
    // Simplified: chỉ log, WristHUD đã có score display
    console.log(`[Score popup] +${delta} ${label}`)
  }

  updateBreakTimer(secondsLeft, waveNumber, score) {
    this.showWaveBreak(waveNumber, secondsLeft, score)
  }

  hide() {
    this.mesh.visible = false
    this.startButton.visible = false
    this.restartButton.visible = false
  }

  // ── Private ──

  _build() {
    const W = 512, H = 320
    this._canvas = document.createElement('canvas')
    this._canvas.width = W
    this._canvas.height = H
    this._ctx = this._canvas.getContext('2d')

    this._texture = new THREE.CanvasTexture(this._canvas)

    const geo = new THREE.PlaneGeometry(0.6, 0.375)
    this._hologramMat = new THREE.ShaderMaterial({
      vertexShader: hologramVert,
      fragmentShader: hologramFrag,
      uniforms: {
        uMap:     { value: this._texture },
        uTime:    { value: 0 },
        uOpacity: { value: 0.95 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(geo, this._hologramMat)
    this.mesh.visible = false
    this.scene.add(this.mesh)

    // Button hitbox meshes (invisible, cho RayPointer)
    this.startButton = this._makeButton('start', new THREE.Vector3(0, -0.08, 0.001))
    this.restartButton = this._makeButton('restart', new THREE.Vector3(0, -0.08, 0.001))
    this.mesh.add(this.startButton)
    this.mesh.add(this.restartButton)
    this.startButton.visible = false
    this.restartButton.visible = false
  }

  _makeButton(action, offset) {
    const geo = new THREE.PlaneGeometry(0.24, 0.07)
    const mat = new THREE.MeshBasicMaterial({
      color: action === 'start' ? 0x00cc66 : 0xcc4400,
      transparent: true, opacity: 0.85,
      side: THREE.DoubleSide,
    })
    const btn = new THREE.Mesh(geo, mat)
    btn.position.copy(offset)
    btn.userData.action = action
    return btn
  }

  _positionInFront() {
    // Sẽ được main.js cập nhật vị trí trước mặt player mỗi frame khi visible
  }

  // Gọi mỗi frame để animate hologram
  updateTime(t) {
    if (this._hologramMat) this._hologramMat.uniforms.uTime.value = t
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
    ctx.fillStyle = color
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(text, 256, 80)
  }

  _center(ctx, text, color, size, y) {
    ctx.fillStyle = color
    ctx.font = `${size}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(text, 256, y)
  }
}