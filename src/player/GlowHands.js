import * as THREE from 'three'

// GlowHands — thêm glow sphere quanh cổ tay khi gesture được detect
// Gắn vào controller grip hoặc wrist joint

const GLOW_COLORS = {
  PUNCH:      0xff4400,
  CHOP:       0xff8800,
  BLOCK:      0x0088ff,
  GRAB:       0x00ff88,
  POWER_SLAM: 0xff00ff,
  default:    0xffffff,
}

const FADE_SPEED = 3.0   // opacity giảm mỗi giây

export class GlowHands {
  constructor(renderer, scene) {
    this.renderer = renderer
    this.scene    = scene

    this._glows = []  // [{ mesh, opacity, fadeRate }]

    // Tạo 2 glow sphere — left (0) và right (1)
    this._hands = [
      this._createGlowSphere(0),  // left
      this._createGlowSphere(1),  // right
    ]
  }

  // Gọi khi gesture được detect
  // hand: 'left' | 'right'
  // gesture: tên gesture string
  flash(hand, gesture = 'default') {
    const idx = hand === 'left' ? 0 : 1
    const color = GLOW_COLORS[gesture] ?? GLOW_COLORS.default
    const entry = this._hands[idx]
    entry.mat.color.setHex(color)
    entry.opacity = 1.0
  }

  // Gọi mỗi frame
  update(dt) {
    for (const entry of this._hands) {
      if (entry.opacity > 0) {
        entry.opacity = Math.max(0, entry.opacity - FADE_SPEED * dt)
        entry.mat.opacity = entry.opacity * 0.6
        entry.mesh.visible = entry.opacity > 0.01
      }
    }
  }

  // ── Private ──

  _createGlowSphere(controllerIndex) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.FrontSide,
    })

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      mat
    )
    mesh.visible = false

    // Gắn vào controller grip
    const grip = this.renderer.xr.getControllerGrip(controllerIndex)
    grip.add(mesh)

    return { mesh, mat, opacity: 0 }
  }
}