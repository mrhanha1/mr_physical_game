import * as THREE from 'three'
import { StateMachine, EnemyState } from './StateMachine.js'

const _v3 = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _right = new THREE.Vector3()
const _left = new THREE.Vector3()

export class EnemyAI {
  constructor(position, scene) {
    this.scene = scene
    this.hp = 100
    this.maxHp = 100
    this.isDead = false
    this.isActive = true

    // AI
    this.stateMachine = new StateMachine()
    this.stateMachine.onChange = (prev, next) => this._onStateChange(prev, next)

    this.speed = { patrol: 0.8, aggro: 1.5 }
    this.currentWaypoint = null
    this.velocity = new THREE.Vector3()

    // Stuck detection
    this._stuckTimer = 0
    this._lastPosition = new THREE.Vector3()
    this._frameCounter = 0  // LOS check throttle

    // Damage tracking (cho player)
    this.touchDamage = 10
    this._touchCooldown = 0
    this.onDeath = null  // callback(position, material)

    // ── Mesh — sphere đơn giản ──
    this.mesh = new THREE.Group()

    this._sphereMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 })
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 16),
      this._sphereMat
    )
    sphere.position.y = 0.9
    sphere.userData.hitZone = 'body'
    this.mesh.add(sphere)

    // Alias cho hit detection (head = cùng sphere, headshot nếu ray hit phần trên)
    this._bodyMat = this._sphereMat
    this._headMat = this._sphereMat

    this._hpBar = this._createHpBar()
    this.mesh.add(this._hpBar)

    this.mesh.position.copy(position)
    scene.add(this.mesh)
  }

  // ── Public API ──

  takeDamage(amount, zone = 'body') {
    if (this.isDead) return
    const dmg = zone === 'head' ? amount * 2 : amount
    this.hp = Math.max(0, this.hp - dmg)

    this.stateMachine.registerDamage(dmg)
    this._flashRed()
    this._hpBar.scale.x = this.hp / this.maxHp

    console.log(`[Enemy] Hit ${zone}! HP: ${this.hp}/${this.maxHp}`)
  }

  // dt: delta time giây
  // playerPos: THREE.Vector3
  // physicsWorld: PhysicsWorld instance (có castRay)
  // waypointFn: () => THREE.Vector3 | null  — lấy random point trên floor
  update(dt, playerPos, physicsWorld, waypointFn) {
    if (this.isDead || !this.isActive) return

    this._frameCounter++
    this._touchCooldown = Math.max(0, this._touchCooldown - dt)

    // LOS check mỗi 3 frame
    let playerVisible = false
    if (physicsWorld && this._frameCounter % 3 === 0) {
      playerVisible = this._checkLOS(playerPos, physicsWorld)
      this._cachedPlayerVisible = playerVisible
    } else {
      playerVisible = this._cachedPlayerVisible ?? false
    }

    const distToPlayer = this.mesh.position.distanceTo(playerPos)

    // Cập nhật state machine
    this.stateMachine.update({
      hp: this.hp,
      playerVisible,
      distToPlayer,
      dt,
    })

    const state = this.stateMachine.current

    if (state === EnemyState.PATROL) {
      this._doPatrol(dt, physicsWorld, waypointFn)
    } else if (state === EnemyState.AGGRO) {
      this._doAggro(dt, playerPos, distToPlayer, physicsWorld)
    } else if (state === EnemyState.STAGGER) {
      // đứng yên, velocity = 0
      this.velocity.set(0, 0, 0)
    } else if (state === EnemyState.DIE) {
      if (!this.isDead) this._die()
      return
    }

    // Apply velocity
    this.mesh.position.addScaledVector(this.velocity, dt)

    // HP bar billboard
    this._hpBar.lookAt(
      playerPos.x,
      this._hpBar.getWorldPosition(_v3).y,
      playerPos.z
    )
  }

  reset(position) {
    this.hp = this.maxHp
    this.isDead = false
    this.isActive = true
    this.velocity.set(0, 0, 0)
    this.currentWaypoint = null
    this._stuckTimer = 0
    this._frameCounter = 0
    this._cachedPlayerVisible = false
    this._touchCooldown = 0
    this.stateMachine.current = EnemyState.PATROL

    this._hpBar.scale.x = 1
    this.mesh.rotation.set(0, 0, 0)
    this.mesh.position.copy(position)
    this.mesh.visible = true
  }

  dispose() {
    this.scene.remove(this.mesh)
  }

  // ── Private ──

  _doPatrol(dt, physicsWorld, waypointFn) {
    // Lấy waypoint mới nếu chưa có hoặc đã đến
    if (!this.currentWaypoint || this.mesh.position.distanceTo(this.currentWaypoint) < 0.3) {
      const wp = waypointFn ? waypointFn() : null
      if (wp) {
        this.currentWaypoint = wp.clone()
        this._lastPosition.copy(this.mesh.position)
        this._stuckTimer = 0
      } else {
        this.velocity.set(0, 0, 0)
        return
      }
    }

    // Stuck check
    this._stuckTimer += dt
    if (this._stuckTimer > 1.5) {
      const moved = this.mesh.position.distanceTo(this._lastPosition)
      if (moved < 0.05) {
        // Stuck → random redirect
        this.currentWaypoint = null
      }
      this._stuckTimer = 0
      this._lastPosition.copy(this.mesh.position)
    }

    this._steerToward(this.currentWaypoint, this.speed.patrol, physicsWorld)
  }

  _doAggro(dt, playerPos, distToPlayer, physicsWorld) {
    // Chạm vào player → deal damage
    if (distToPlayer < 0.6 && this._touchCooldown <= 0) {
      this._touchCooldown = 1.0
      // Emit event để main.js / PlayerRig xử lý
      this.mesh.dispatchEvent({ type: 'touchDamage', damage: this.touchDamage })
    }

    this._steerToward(playerPos, this.speed.aggro, physicsWorld)
  }

  // Steering với obstacle avoidance 3-ray
  _steerToward(target, speed, physicsWorld) {
    _dir.subVectors(target, this.mesh.position).setY(0).normalize()

    if (physicsWorld) {
      const origin = { x: this.mesh.position.x, y: this.mesh.position.y + 0.5, z: this.mesh.position.z }

      const straight = this._rayBlocked(origin, { x: _dir.x, y: _dir.y, z: _dir.z }, physicsWorld, 0.6)

      if (straight) {
        // Thử trái / phải 30°
        _right.copy(_dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 6)
        _left.copy(_dir).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 6)

        const blockedRight = this._rayBlocked(origin, { x: _right.x, y: 0, z: _right.z }, physicsWorld, 0.6)
        const blockedLeft = this._rayBlocked(origin, { x: _left.x, y: 0, z: _left.z }, physicsWorld, 0.6)

        if (!blockedRight) {
          _dir.copy(_right)
        } else if (!blockedLeft) {
          _dir.copy(_left)
        } else {
          // Cả 3 blocked → quay ngược + random nhỏ
          _dir.negate()
          _dir.x += (Math.random() - 0.5) * 0.5
          _dir.normalize()
        }
      }
    }

    // Face hướng di chuyển
    if (_dir.lengthSq() > 0.01) {
      const angle = Math.atan2(_dir.x, _dir.z)
      this.mesh.rotation.y = angle
    }

    this.velocity.set(_dir.x * speed, 0, _dir.z * speed)
  }

  _rayBlocked(origin, direction, physicsWorld, maxToi) {
    const hit = physicsWorld.castRay(origin, direction, maxToi)
    return hit !== null
  }

  _checkLOS(playerPos, physicsWorld) {
    const origin = {
      x: this.mesh.position.x,
      y: this.mesh.position.y + 1.0,
      z: this.mesh.position.z,
    }
    _v3.subVectors(playerPos, this.mesh.position).normalize()
    const direction = { x: _v3.x, y: _v3.y, z: _v3.z }
    const dist = this.mesh.position.distanceTo(playerPos)

    // Nếu ray hit trước khi đến player → bị che
    const hit = physicsWorld.castRay(origin, direction, dist - 0.2)
    return hit === null
  }

  _onStateChange(prev, next) {
    if (next === EnemyState.AGGRO) {
      this._bodyMat.color.set(0xff2200)
    } else if (next === EnemyState.PATROL) {
      this._bodyMat.color.set(0xcc3333)
    } else if (next === EnemyState.STAGGER) {
      this._bodyMat.color.set(0xffaa00)
    }
  }

  _die() {
    this.isDead = true
    this.velocity.set(0, 0, 0)
    this.mesh.visible = false
    console.log('[Enemy] Dead')
    // Truyền material để Ragdoll clone màu, position để biết nơi rớt
    if (this.onDeath) this.onDeath(this.mesh.position.clone(), this._sphereMat)
  }

  _flashRed() {
    this._bodyMat.emissive?.set(0xff0000)
    this._headMat.emissive?.set(0xff0000)
    setTimeout(() => {
      this._bodyMat.emissive?.set(0x000000)
      this._headMat.emissive?.set(0x000000)
    }, 150)
  }

  _createHpBar() {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    )
    bar.position.set(0, 1.9, 0)
    return bar
  }
}