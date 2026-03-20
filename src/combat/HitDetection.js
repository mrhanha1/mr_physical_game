import * as THREE from 'three'

const _ray = new THREE.Raycaster()

export class HitDetection {
  constructor(enemies) {
    this.enemies = enemies  // array EnemyAI
  }
  setEnemies(enemies) {
    this.enemies = enemies
  }

  checkBullets(bullets) {
    const hits = []

    for (const bullet of bullets) {
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue

        // Check từng hitbox (head, body)
        for (const child of enemy.mesh.children) {
          if (!child.userData.hitZone) continue

          const box = new THREE.Box3().setFromObject(child)
          if (box.containsPoint(bullet.mesh.position)) {
            hits.push({ bullet, enemy, zone: child.userData.hitZone })
            break
          }
        }
      }
    }

    return hits
  }
}