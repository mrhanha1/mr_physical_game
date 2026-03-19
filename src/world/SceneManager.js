import * as THREE from 'three'

export class SceneManager {
  constructor(scene) {
    this.scene = scene
    this.groups = {
      enemies: new THREE.Group(),
      weapons: new THREE.Group(),
      effects: new THREE.Group(),
      world: new THREE.Group()
    }
    Object.values(this.groups).forEach(g => scene.add(g))
  }

  add(object, group = 'world') {
    this.groups[group]?.add(object) ?? this.scene.add(object)
  }

  remove(object, group = 'world') {
    this.groups[group]?.remove(object) ?? this.scene.remove(object)
  }
}