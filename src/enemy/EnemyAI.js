import * as THREE from 'three'

export class EnemyAI {
  constructor(position) {
    this.hp = 100
    this.maxHp = 100
    this.isDead = false

    // Body
    this.mesh = new THREE.Group()

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xcc3333 })
    )
    body.position.y = 0.7
    body.userData.hitZone = 'body'
    this.mesh.add(body)

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.15),
      new THREE.MeshStandardMaterial({ color: 0xff6666 })
    )
    head.position.y = 1.55
    head.userData.hitZone = 'head'
    this.mesh.add(head)

    this.mesh.position.copy(position)

    // HP bar (simple)
    this._hpBar = this._createHpBar()
    this.mesh.add(this._hpBar)
  }

  _createHpBar() {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    )
    bar.position.set(0, 1.9, 0)
    return bar
  }

  takeDamage(amount, zone = 'body') {
    if (this.isDead) return
    const dmg = zone === 'head' ? amount * 2 : amount
    this.hp = Math.max(0, this.hp - dmg)
    console.log(`[Enemy] Hit ${zone}! HP: ${this.hp}/${this.maxHp}`)

    // Flash đỏ
    this.mesh.children.forEach(c => {
      if (c.material) c.material.emissive?.set(0xff0000)
      setTimeout(() => c.material?.emissive?.set(0x000000), 150)
    })

    // Cập nhật HP bar scale
    this._hpBar.scale.x = this.hp / this.maxHp

    if (this.hp <= 0) this._die()
  }

  _die() {
    this.isDead = true
    this.mesh.rotation.z = Math.PI / 2  // ngã đơn giản
    console.log('[Enemy] Dead')
  }

  update(dt) {
    // Phase 8 sẽ thêm AI movement
    // HP bar luôn nhìn về camera (billboard đơn giản)
    this._hpBar.lookAt(0, this._hpBar.getWorldPosition(new THREE.Vector3()).y, 0)
  }
}