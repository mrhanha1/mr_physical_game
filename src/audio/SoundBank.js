// Định nghĩa toàn bộ sound assets
// path: đường dẫn tương đối từ /public hoặc /assets/sounds/
// spatial: có dùng HRTF 3D không
// volume: 0.0 - 1.0

export const SoundBank = {
  gunshot: {
    path: 'sounds/gunshot.mp3',
    spatial: true,
    volume: 0.9,
    rate: [0.95, 1.05],   // random pitch range [min, max]
  },
  reloadClick: {
    path: 'sounds/reload_click.mp3',
    spatial: true,
    volume: 0.7,
    rate: [1.0, 1.0],
  },
  punchImpact: {
    path: 'sounds/punch_impact.mp3',
    spatial: true,
    volume: 0.8,
    rate: [0.9, 1.1],
  },
  enemyGrowl: {
    path: 'sounds/enemy_growl.mp3',
    spatial: true,
    volume: 0.7,
    rate: [0.85, 1.15],
  },
  enemyDeath: {
    path: 'sounds/enemy_death.mp3',
    spatial: true,
    volume: 0.8,
    rate: [0.9, 1.0],
  },
  footstep: {
    path: 'sounds/footstep.mp3',
    spatial: false,
    volume: 0.4,
    rate: [0.9, 1.1],
  },
  bodyHit: {
    path: 'sounds/body_hit.mp3',
    spatial: true,
    volume: 0.6,
    rate: [0.95, 1.05],
  },
}