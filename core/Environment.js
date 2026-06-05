// Environment.js - Load GLB props vào scene. Không biết về mode.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Environment {
  constructor(scene) {
    this._scene  = scene;
    this._loader = new GLTFLoader();
    this.group   = new THREE.Group();
  }

  /**
   * Load tất cả GLB props và add vào scene.
   * @returns {Promise<void>}
   */
  build() {
    this._scene.add(this.group);

    const props = [
      // Thêm props vào đây theo định dạng:
      // { url: '/assets/ten_file.glb', position: [x, y, z], scale: s, rotation: [rx, ry, rz] },
      { url: '/assets/floor.glb', position: [0, 0.02, 0], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/treeDry.glb', position: [5, 0, 5], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/tree2.glb', position: [-5, 0, -5], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/grass.glb', position: [0, 0, 0], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/whiteFlower.glb', position: [0, 0, 0], scale: 1, rotation: [0, 0, 0] },
    ];

    const loads = props.map(({ url, position = [0,0,0], scale = 1, rotation = [0,0,0] }) =>
      this._loadGLB(url).then(obj => {
        obj.position.set(...position);
        obj.scale.setScalar(scale);
        obj.rotation.set(...rotation);
        this.group.add(obj);
      }).catch(err => console.warn(`[Environment] Failed to load ${url}:`, err))
    );

    return Promise.all(loads);
  }

  /** Xóa group khỏi scene và giải phóng geometry/material. */
  dispose() {
    this._scene.remove(this.group);
    this.group.traverse(obj => {
      obj.geometry?.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => m.dispose());
      }
    });
    this.group.clear();
  }

  _loadGLB(url) {
    return new Promise((resolve, reject) => {
      this._loader.load(url, gltf => resolve(gltf.scene), undefined, reject);
    });
  }
}