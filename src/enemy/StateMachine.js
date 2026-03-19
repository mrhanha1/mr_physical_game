export const EnemyState = {
  PATROL: 'PATROL',
  AGGRO: 'AGGRO',
  STAGGER: 'STAGGER',
  DIE: 'DIE',
}

export class StateMachine {
  constructor() {
    this.current = EnemyState.PATROL
    this.onChange = null  // callback(prev, next)

    this._staggerTimer = 0
    this._staggerDuration = 1.0  // giây

    // Ngưỡng damage liên tiếp để vào STAGGER
    this._staggerDamageThreshold = 30
    this._staggerDamageWindow = 0.5   // giây
    this._recentDamage = 0
    this._recentDamageTimer = 0
  }

  // Gọi mỗi frame
  // context = { hp, playerVisible, distToPlayer, dt }
  update(context) {
    const { hp, playerVisible, distToPlayer, dt } = context

    // DIE không thể thoát
    if (this.current === EnemyState.DIE) return

    // Đếm ngược stagger
    if (this.current === EnemyState.STAGGER) {
      this._staggerTimer -= dt
      if (this._staggerTimer <= 0) {
        this._transition(EnemyState.AGGRO)
      }
      return
    }

    // Decay recent damage counter
    if (this._recentDamageTimer > 0) {
      this._recentDamageTimer -= dt
      if (this._recentDamageTimer <= 0) {
        this._recentDamage = 0
      }
    }

    // HP về 0 → DIE
    if (hp <= 0) {
      this._transition(EnemyState.DIE)
      return
    }

    // PATROL ↔ AGGRO
    if (this.current === EnemyState.PATROL && playerVisible) {
      this._transition(EnemyState.AGGRO)
    } else if (this.current === EnemyState.AGGRO && !playerVisible && distToPlayer > 4) {
      this._transition(EnemyState.PATROL)
    }
  }

  // Gọi khi nhận damage — kiểm tra có vào STAGGER không
  registerDamage(amount) {
    if (this.current === EnemyState.DIE) return
    this._recentDamage += amount
    this._recentDamageTimer = this._staggerDamageWindow

    if (this._recentDamage >= this._staggerDamageThreshold) {
      this._recentDamage = 0
      this._recentDamageTimer = 0
      this._transition(EnemyState.STAGGER)
    }
  }

  _transition(next) {
    if (this.current === next) return
    const prev = this.current
    this.current = next

    if (next === EnemyState.STAGGER) {
      this._staggerTimer = this._staggerDuration
    }

    console.log(`[StateMachine] ${prev} → ${next}`)
    if (this.onChange) this.onChange(prev, next)
  }
}