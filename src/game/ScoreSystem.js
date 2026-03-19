const POINTS = {
  kill: 100,
  headshot: 150,    // thêm vào kill bonus
  combo3: 50,
  combo5: 150,
  combo10: 500,
}

const COMBO_WINDOW = 3.0  // giây giữa 2 kill để tính combo

export class ScoreSystem {
  constructor() {
    this.score = 0
    this.highScore = parseInt(localStorage.getItem('highScore') || '0')

    this._comboCount = 0
    this._comboTimer = 0

    // callback để UI lắng nghe
    this.onScoreChange = null   // (score, delta, label)
    this.onCombo = null         // (comboCount)
    this.onNewHighScore = null  // (score)
  }

  // zone: 'head' | 'body'
  registerKill(zone = 'body') {
    let delta = POINTS.kill
    let label = 'KILL'

    if (zone === 'head') {
      delta += POINTS.headshot
      label = 'HEADSHOT!'
    }

    // Combo
    this._comboCount++
    this._comboTimer = COMBO_WINDOW

    if (this._comboCount === 3)  { delta += POINTS.combo3;  label += ' COMBO x3' }
    if (this._comboCount === 5)  { delta += POINTS.combo5;  label += ' COMBO x5!' }
    if (this._comboCount >= 10)  { delta += POINTS.combo10; label += ' COMBO x10!!' }

    if (this._comboCount >= 3 && this.onCombo) this.onCombo(this._comboCount)

    this._addScore(delta, label)
  }

  update(dt) {
    if (this._comboTimer > 0) {
      this._comboTimer -= dt
      if (this._comboTimer <= 0) {
        this._comboCount = 0
      }
    }
  }

  reset() {
    this.score = 0
    this._comboCount = 0
    this._comboTimer = 0
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score
      localStorage.setItem('highScore', String(this.highScore))
      if (this.onNewHighScore) this.onNewHighScore(this.highScore)
    }
  }

  _addScore(delta, label) {
    this.score += delta
    console.log(`[Score] +${delta} ${label} → Total: ${this.score}`)
    if (this.onScoreChange) this.onScoreChange(this.score, delta, label)
  }
}