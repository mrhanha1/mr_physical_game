// WaveManager — điều phối wave, break time, game state
// Phụ thuộc: EnemySpawner, ScoreSystem

export const GameState = {
  WAITING:    'WAITING',    // chờ Start
  SCANNING:   'SCANNING',   // đang quét phòng
  PLAYING:    'PLAYING',    // đang chơi
  WAVE_BREAK: 'WAVE_BREAK', // nghỉ giữa wave
  GAME_OVER:  'GAME_OVER',
}

const BREAK_DURATION = 10.0  // giây nghỉ giữa wave

// Cấu hình từng wave: { count, speedMult }
const WAVE_CONFIG = [
  { count: 3,  speedMult: 1.0 },  // wave 1
  { count: 5,  speedMult: 1.1 },  // wave 2
  { count: 7,  speedMult: 1.2 },  // wave 3
  { count: 9,  speedMult: 1.35 }, // wave 4
  { count: 12, speedMult: 1.5 },  // wave 5
  // wave 6+ → tự scale
]

function getWaveConfig(waveIndex) {
  if (waveIndex < WAVE_CONFIG.length) return WAVE_CONFIG[waveIndex]
  return {
    count: 12 + (waveIndex - WAVE_CONFIG.length + 1) * 3,
    speedMult: 1.5 + (waveIndex - WAVE_CONFIG.length + 1) * 0.1,
  }
}

export class WaveManager {
  constructor(enemySpawner, scoreSystem) {
    this.enemySpawner = enemySpawner
    this.scoreSystem = scoreSystem

    this.state = GameState.WAITING
    this.waveNumber = 0       // 1-indexed, 0 = belum mulai
    this._breakTimer = 0

    // Callbacks cho UI
    this.onStateChange = null   // (newState, data)
    this.onWaveStart   = null   // (waveNumber, config)
    this.onWaveEnd     = null   // (waveNumber, breakSeconds)
    this.onGameOver    = null   // (score, highScore)
  }

  // Gọi từ UI Start button
  startGame() {
    if (this.state !== GameState.WAITING && this.state !== GameState.GAME_OVER) return
    this.waveNumber = 0
    this.scoreSystem.reset()
    this._setState(GameState.PLAYING)
    this._startNextWave()
  }

  // Gọi mỗi frame
  // frame, referenceSpace, playerPos: để truyền cho EnemySpawner.spawn
  update(dt, frame, referenceSpace, playerPos, playerHP) {
    if (this.state === GameState.WAITING || this.state === GameState.SCANNING) return

    if (this.state === GameState.GAME_OVER) return

    if (this.state === GameState.WAVE_BREAK) {
      this._breakTimer -= dt
      if (this._breakTimer <= 0) {
        this._setState(GameState.PLAYING)
        this._startNextWave()
      }
      return
    }

    if (this.state === GameState.PLAYING) {
      this.scoreSystem.update(dt)

      // Player chết
      if (playerHP <= 0) {
        this._endGame()
        return
      }

      // Hết enemy → kết thúc wave
      if (this.enemySpawner.getActiveCount() === 0) {
        this._endWave(frame, referenceSpace, playerPos)
      }
    }
  }

  // Gọi từ HitDetection khi enemy chết để tính điểm
  registerKill(zone) {
    if (this.state !== GameState.PLAYING) return
    this.scoreSystem.registerKill(zone)
  }

  // ── Private ──

  _startNextWave() {
    this.waveNumber++
    const config = getWaveConfig(this.waveNumber - 1)

    // Áp speed multiplier cho tất cả enemy sẽ spawn
    this._pendingSpeedMult = config.speedMult

    console.log(`[Wave] Starting wave ${this.waveNumber}: ${config.count} enemies, speed x${config.speedMult}`)
    if (this.onWaveStart) this.onWaveStart(this.waveNumber, config)

    // Spawn — frame/referenceSpace/playerPos được truyền vào update,
    // nên spawn ngay lần update đầu tiên sau khi state = PLAYING
    // Dùng flag để spawn đúng 1 lần
    this._needsSpawn = true
    this._spawnConfig = config
  }

  // Gọi trong update khi state=PLAYING và _needsSpawn=true
  _doSpawnIfNeeded(frame, referenceSpace, playerPos) {
    if (!this._needsSpawn) return
    this._needsSpawn = false

    const config = this._spawnConfig
    const spawned = this.enemySpawner.spawn(config.count, frame, referenceSpace, playerPos)

    // Áp speed multiplier
    for (const enemy of spawned) {
      enemy.speed.patrol *= config.speedMult
      enemy.speed.aggro  *= config.speedMult
    }
  }

  _endWave(frame, referenceSpace, playerPos) {
    console.log(`[Wave] Wave ${this.waveNumber} cleared!`)
    this.scoreSystem.saveHighScore()

    if (this.onWaveEnd) this.onWaveEnd(this.waveNumber, BREAK_DURATION)

    this._breakTimer = BREAK_DURATION
    this._setState(GameState.WAVE_BREAK)
  }

  _endGame() {
    this.scoreSystem.saveHighScore()
    this._setState(GameState.GAME_OVER)
    console.log(`[Wave] Game Over. Score: ${this.scoreSystem.score}, High: ${this.scoreSystem.highScore}`)
    if (this.onGameOver) this.onGameOver(this.scoreSystem.score, this.scoreSystem.highScore)
  }

  _setState(newState) {
    this.state = newState
    if (this.onStateChange) this.onStateChange(newState, {
      wave: this.waveNumber,
      score: this.scoreSystem.score,
      breakTimer: this._breakTimer,
    })
  }
}

// Patch update để gọi _doSpawnIfNeeded
const _origUpdate = WaveManager.prototype.update
WaveManager.prototype.update = function(dt, frame, referenceSpace, playerPos, playerHP) {
  if (this.state === GameState.PLAYING) {
    this._doSpawnIfNeeded(frame, referenceSpace, playerPos)
  }
  _origUpdate.call(this, dt, frame, referenceSpace, playerPos, playerHP)
}