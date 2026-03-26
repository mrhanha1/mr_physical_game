// SoundBank — định nghĩa toàn bộ sound assets cho Sphere Physics Game
// path: đường dẫn từ /public/sounds/
// spatial: dùng HRTF 3D positioning
// volume: 0.0–1.0
// rate: [min, max] pitch range ngẫu nhiên

export const SoundBank = {
  // ── Sphere interactions ──────────────────────────────────────────────────
  spherePickup: {
    path: 'sounds/sphere_pickup.mp3',
    spatial: false,
    volume: 0.6,
    rate: [0.95, 1.05],
  },
  sphereDrop: {
    path: 'sounds/sphere_drop.mp3',
    spatial: true,
    volume: 0.5,
    rate: [0.9, 1.1],
  },
  sphereThrow: {
    path: 'sounds/sphere_throw.mp3',
    spatial: false,
    volume: 0.7,
    rate: [0.9, 1.05],
  },
  sphereBounce: {
    path: 'sounds/sphere_bounce.mp3',
    spatial: true,
    volume: 0.55,
    rate: [0.85, 1.15],
  },
  sphereLoad: {
    path: 'sounds/sphere_load.mp3',
    spatial: false,
    volume: 0.65,
    rate: [0.95, 1.05],
  },

  // ── Weapons ──────────────────────────────────────────────────────────────
  pistolShot: {
    path: 'sounds/pistol_shot.mp3',
    spatial: false,
    volume: 0.9,
    rate: [0.95, 1.05],
  },
  rifleShot: {
    path: 'sounds/rifle_shot.mp3',
    spatial: false,
    volume: 1.0,
    rate: [0.92, 1.02],
  },
  weaponGrab: {
    path: 'sounds/weapon_grab.mp3',
    spatial: false,
    volume: 0.5,
    rate: [1.0, 1.0],
  },

  // ── UI / Ambient ──────────────────────────────────────────────────────────
  uiClick: {
    path: 'sounds/ui_click.mp3',
    spatial: false,
    volume: 0.4,
    rate: [1.0, 1.0],
  },
}