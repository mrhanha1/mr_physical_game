// core/BulletSystem.js - Quản lý physics và lifecycle của bullet sphere
import * as THREE from 'three';
import { PhysicsBody } from './PhysicsBody.js';

export class BulletSystem {
  constructor(scene, sphereGenerator, levelManager, grabSystem) {
    this.scene           = scene;
    this.sphereGenerator = sphereGenerator;
    this.levelManager    = levelManager;
    this.grabSystem      = grabSystem;
    this.physicsBodies   = [];
  }

  /**
   * Thêm sphere vừa bắn vào simulation.
   * @param {THREE.Mesh} sphere
   * @param {THREE.Vector3} velocity
   */
  addBullet(sphere, velocity) {
    this.physicsBodies.push(new PhysicsBody(sphere, velocity, true));
    this.sphereGenerator.activeSpheres.push(sphere);
  }

  /**
   * Simulate physics + check drop + cleanup mỗi frame.
   * @param {number} delta
   * @param {Function} onCorrect  callback(mesh) khi trúng đúng slot
   */
  update(delta, onCorrect) {
    const worldPos = new THREE.Vector3();

    this.physicsBodies = this.physicsBodies.filter((body) => {
      body.update(delta);

      if (body.active) {
        body.mesh.getWorldPosition(worldPos);
        const result = this.levelManager.checkDrop(body.mesh, worldPos);
        if (result) {
          if (result.colorMatch) {
            this.levelManager.fillSlot(result.slot, body.mesh);
            this.scene.remove(body.mesh);
            this.sphereGenerator.activeSpheres =
              this.sphereGenerator.activeSpheres.filter(s => s !== body.mesh);
            if (onCorrect) onCorrect(body.mesh);
          } else {
            const bounceVel = body.velocity.clone()
              .reflect(new THREE.Vector3(0, 1, 0))
              .multiplyScalar(0.4);
            this.grabSystem.handOffToPhysics(body.mesh, bounceVel);
          }
          return false;
        }
      }

      if (body.mesh.position.y < -2) {
        this.scene.remove(body.mesh);
        this.sphereGenerator.activeSpheres =
          this.sphereGenerator.activeSpheres.filter(s => s !== body.mesh);
        return false;
      }
      return body.active;
    });
  }
}