import * as THREE from 'three'

// Hiển thị trên cổ tay trái — nhìn vào thấy HP + Ammo
// Gắn vào controller grip trái hoặc hand wrist joint

export class WristHUD {
  constructor(scene, renderer) {
    this.scene = scene
    this.renderer = renderer
    this.mesh = null
    this._canvas = null
    this._ctx = null
    this._texture = null

    this._hp = 100
    this._maxHp = 100
    this._ammo = 0
    this._maxAmmo = 0
    this._wave = 0

    this._build()
    this._attach()
  }

  setHP(hp, maxHp) {
    this._hp = hp
    this._maxHp = maxHp
    this._redraw()
  }

  setAmmo(current, max) {
    this._ammo = current
    this._maxAmmo = max
    this._redraw()
  }

  setWave(wave) {
    this._wave = wave
    this._redraw()
  }

  update() {
    if (!this.mesh) return

    // Chỉ hiện khi người chơi nhìn vào cổ tay (dot product)
    const cam = this.renderer.xr.getCamera()
    const wristPos = new THREE.Vector3()
    this.mesh.getWorldPosition(wristPos)

    const toWrist = wristPos.clone().sub(cam.position).normalize()
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)

    const dot = toWrist.dot(camForward)
    // Hiện khi đang nhìn gần về phía cổ tay (dot > 0.5 ~ trong 60°)
    this.mesh.visible = dot > 0.5
  }

  // ── Private ──

  _build() {
    const W = 256, H = 128
    this._canvas = document.createElement('canvas')
    this._canvas.width = W
    this._canvas.height = H
    this._ctx = this._canvas.getContext('2d')

    this._texture = new THREE.CanvasTexture(this._canvas)

    const geo = new THREE.PlaneGeometry(0.12, 0.06)
    const mat = new THREE.MeshBasicMaterial({
      map: this._texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.scene.add(this.mesh)
    this._redraw()
  }

  _attach() {
    // Gắn vào controller grip trái (index 0 = left trên Quest)
    const grip = this.renderer.xr.getControllerGrip(0)
    grip.add(this.mesh)
    // Offset: quay lên phía lưng bàn tay
    this.mesh.position.set(0, 0.03, -0.04)
    this.mesh.rotation.x = -Math.PI / 4
  }

  _redraw() {
    const ctx = this._ctx
    const W = this._canvas.width
    const H = this._canvas.height

    // Background
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.roundRect(0, 0, W, H, 12)
    ctx.fill()

    // HP bar
    const hpRatio = Math.max(0, this._hp / this._maxHp)
    const hpColor = hpRatio > 0.5 ? '#00ff88' : hpRatio > 0.25 ? '#ffaa00' : '#ff3300'

    ctx.fillStyle = '#333'
    ctx.fillRect(10, 10, W - 20, 22)
    ctx.fillStyle = hpColor
    ctx.fillRect(10, 10, (W - 20) * hpRatio, 22)

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px monospace'
    ctx.fillText(`HP  ${this._hp}/${this._maxHp}`, 14, 26)

    // Ammo
    ctx.fillStyle = '#aaddff'
    ctx.font = 'bold 28px monospace'
    ctx.fillText(`${this._ammo}`, 14, 72)
    ctx.fillStyle = '#778899'
    ctx.font = '16px monospace'
    ctx.fillText(`/ ${this._maxAmmo}`, 56, 72)
    ctx.fillStyle = '#aaaaaa'
    ctx.font = '12px monospace'
    ctx.fillText('AMMO', 14, 90)

    // Wave
    ctx.fillStyle = '#ffdd88'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`WAVE ${this._wave}`, W - 10, 26)
    ctx.textAlign = 'left'

    this._texture.needsUpdate = true
  }
}