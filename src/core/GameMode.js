// ── GameMode.js ──────────────────────────────────────────────────────────
// Singleton lưu mode hiện tại. Import ở bất kỳ file nào cần kiểm tra mode.
// Set TRƯỚC khi khởi tạo các hệ thống khác.

export const MODE = {
  AR:         'ar',
  FLATSCREEN: 'flatscreen',
}

class GameModeManager {
  constructor() {
    this._mode = null   // null = chưa chọn
  }

  set(mode) {
    if (!Object.values(MODE).includes(mode)) {
      console.error(`[GameMode] Unknown mode: ${mode}`)
      return
    }
    this._mode = mode
    console.log(`[GameMode] Mode set: ${mode}`)
  }

  get current() { return this._mode }

  isAR()         { return this._mode === MODE.AR }
  isFlatscreen() { return this._mode === MODE.FLATSCREEN }
  isSet()        { return this._mode !== null }
}

export const GameMode = new GameModeManager()