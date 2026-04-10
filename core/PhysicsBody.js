// core/PhysicsBody.js - Inertia/physics for released spheres
import * as THREE from 'three';

const BUFFER_SIZE  = 4;      // rolling frame buffer để smooth velocity
const GRAVITY      = -4.0;   // m/s²
const DAMPING      = 0.97;   // hệ số giảm tốc mỗi frame
const STOP_THRESH  = 0.02;   // dừng hẳn khi speed < ngưỡng này
const FLOOR_Y      = 0.05;   // sàn tối thiểu (tránh xuyên sàn)

export class PhysicsBody {
  /**
   * @param {THREE.Mesh} mesh
   * @param {THREE.Vector3} initialVelocity - vận tốc lúc thả (m/s)
   * @param {boolean} useGravity - chỉ sphere bắn từ súng mới dùng gravity
   */
  constructor(mesh, initialVelocity, useGravity = false) {
    this.mesh       = mesh;
    this.velocity   = initialVelocity.clone();
    this.useGravity = useGravity;
    this.active     = true;
  }

  update(delta) {
    if (!this.active) return;

    // Gravity - chỉ apply khi useGravity = true
    if (this.useGravity) {
      this.velocity.y += GRAVITY * delta;
    }

    // Damping
    this.velocity.multiplyScalar(DAMPING);

    // Move
    this.mesh.position.addScaledVector(this.velocity, delta);

    // Floor clamp
    if (this.mesh.position.y < FLOOR_Y) {
      this.mesh.position.y = FLOOR_Y;
      this.velocity.y *= -0.3; // bounce nhỏ
    }

    // Stop condition
    if (this.velocity.length() < STOP_THRESH) {
      this.velocity.set(0, 0, 0);
      this.active = false;
    }
  }
}

/**
 * VelocityTracker - gắn vào mỗi grab state để tính vận tốc
 * rolling buffer BUFFER_SIZE frame
 */
export class VelocityTracker {
  constructor() {
    this._buffer = []; // [{pos: Vector3, time: number}]
  }

  reset() {
    this._buffer = [];
  }

  record(position) {
    this._buffer.push({ pos: position.clone(), time: performance.now() });
    if (this._buffer.length > BUFFER_SIZE) this._buffer.shift();
  }

  /**
   * Trả về velocity trung bình (THREE.Vector3), tính từ buffer
   */
  compute() {
    if (this._buffer.length < 2) return new THREE.Vector3();

    const oldest = this._buffer[0];
    const newest = this._buffer[this._buffer.length - 1];
    const dt = (newest.time - oldest.time) / 1000; // ms → s

    if (dt < 0.001) return new THREE.Vector3();

    return newest.pos.clone().sub(oldest.pos).divideScalar(dt);
  }
}