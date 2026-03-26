import * as THREE from 'three'

// ─── WristHUD ──────────────────────────────────────────────────────────────
// Hiển thị trên cổ tay trái của người chơi.
// Nội dung:
//   • Tay trái : có đang cầm sphere không + loại sphere
//   • Tay phải : trạng thái súng (EMPTY / LOADED + loại sphere)
//   • Bên dưới : tổng số sphere trong scene
//
// Hiển thị khi nhìn vào cổ tay (dot product > 0.5)

export class WristHUD {
  constructor(scene, renderer) {
    this.scene    = scene
    this.renderer = renderer
    this.mesh     = null

    this._canvas  = null
    this._ctx     = null
    this._texture = null

    // State cần render
    this._leftHeld      = null    // { typeKey } | null
    this._rightHeld     = null    // null (cầm súng ko show)
    this._gunState      = 'EMPTY' // 'EMPTY' | 'LOADED'
    this._gunType       = null    // typeKey trong chamber
    this._gunName       = ''      // 'Pistol' | 'Rifle'
    this._totalSpheres  = 0
    this._activeGun     = null    // 'Pistol' | 'Rifle' | null

    this._build()
    this._attach()
  }

  // ── Setters ───────────────────────────────────────────────────────────────

  setLeftHeld(sphereData) {
    this._leftHeld = sphereData
    this._redraw()
  }

  setGunState(gunName, chamberedSphereData) {
    this._activeGun  = gunName
    this._gunState   = chamberedSphereData ? 'LOADED' : 'EMPTY'
    this._gunType    = chamberedSphereData?.typeKey ?? null
    this._redraw()
  }

  setTotalSpheres(count) {
    this._totalSpheres = count
    this._redraw()
  }

  // ── Update (gọi mỗi frame) ────────────────────────────────────────────────

  update() {
    if (!this.mesh) return
    const cam      = this.renderer.xr.getCamera()
    const wristPos = new THREE.Vector3()
    this.mesh.getWorldPosition(wristPos)

    const toWrist  = wristPos.clone().sub(cam.position).normalize()
    const camFwd   = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)

    this.mesh.visible = toWrist.dot(camFwd) > 0.5
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _build() {
    const W = 300, H = 150
    this._canvas = document.createElement('canvas')
    this._canvas.width  = W
    this._canvas.height = H
    this._ctx    = this._canvas.getContext('2d')

    this._texture = new THREE.CanvasTexture(this._canvas)

    const geo = new THREE.PlaneGeometry(0.15, 0.075)
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
    // Gắn vào left controller grip (index 0 = left trên Quest)
    const grip = this.renderer.xr.getControllerGrip(0)
    grip.add(this.mesh)
    this.mesh.position.set(0, 0.03, -0.04)
    this.mesh.rotation.x = -Math.PI / 4
  }

  _redraw() {
    const ctx = this._ctx
    const W   = this._canvas.width
    const H   = this._canvas.height

    // Background
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(5, 10, 20, 0.85)'
    this._roundRect(ctx, 0, 0, W, H, 14)
    ctx.fill()

    // Border glow
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)'
    ctx.lineWidth   = 2
    this._roundRect(ctx, 1, 1, W - 2, H - 2, 13)
    ctx.stroke()

    // ── Tay trái ──────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font      = '10px monospace'
    ctx.fillText('LEFT HAND', 10, 18)

    if (this._leftHeld) {
      ctx.fillStyle = '#00ffcc'
      ctx.font      = 'bold 15px monospace'
      ctx.fillText(`● ${this._leftHeld.typeKey}`, 10, 40)
    } else {
      ctx.fillStyle = '#556677'
      ctx.font      = '13px monospace'
      ctx.fillText('empty', 10, 40)
    }

    // Divider
    ctx.strokeStyle = 'rgba(0,200,255,0.2)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(W / 2, 8)
    ctx.lineTo(W / 2, H - 10)
    ctx.stroke()

    // ── Súng (right) ──────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font      = '10px monospace'
    ctx.fillText(this._activeGun ? this._activeGun.toUpperCase() : 'GUN', W / 2 + 10, 18)

    if (this._activeGun) {
      const color = this._gunState === 'LOADED' ? '#ffcc00' : '#ff4444'
      ctx.fillStyle = color
      ctx.font      = 'bold 14px monospace'
      ctx.fillText(this._gunState, W / 2 + 10, 38)

      if (this._gunType) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font      = '11px monospace'
        ctx.fillText(this._gunType, W / 2 + 10, 56)
      }
    } else {
      ctx.fillStyle = '#556677'
      ctx.font      = '12px monospace'
      ctx.fillText('no weapon', W / 2 + 10, 40)
    }

    // ── Bottom bar: total spheres ──────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,200,255,0.15)'
    ctx.fillRect(0, H - 30, W, 30)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font      = '11px monospace'
    ctx.fillText(`SPHERES IN SCENE: ${this._totalSpheres}`, 12, H - 11)

    this._texture.needsUpdate = true
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }
}