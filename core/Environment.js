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
      { url: '/assets/floor.glb', position: [0, 0.01, 0], scale: 1, rotation: [0, 0, 0] },

      // --- Khu vực đông bắc: treeDry + tree1 ---
      { url: '/assets/treeDry.glb', position: [5, 0, -5], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/tree1.glb', position: [8.5, 0, -7.5], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [5.5, 0, -3.8], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [7.2, 0, -6.2], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/flowerRed.glb', position: [4.8, 0, -3.2], scale: 0.9, rotation: [0, 0, 0] },
      { url: '/assets/flowerWhite.glb', position: [6.2, 0, -3.5], scale: 1.2, rotation: [0, 0, 0] },

      // --- Khu vực đông nam: treeDry + treePine ---
      { url: '/assets/treeDry.glb', position: [6, 0, -7], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/treePine.glb', position: [8.5, 0, -4], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [7, 0, -5.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [6.5, 0, -8.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/flowerYellow.glb', position: [5.8, 0, -5], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/flowerPurple.glb', position: [7.5, 0, -4.5], scale: 1.4, rotation: [0, 0, 0] },

      // --- Khu vực tây: tree2 + tree1 ---
      { url: '/assets/tree2.glb', position: [-7, 0, -6], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/tree1.glb', position: [-8, 0, 0], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [-6, 0, -4.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [-7.5, 0, 1.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/redFlower.glb', position: [-5.5, 0, -3.8], scale: 1.3, rotation: [0, 0, 0] },
      { url: '/assets/flowerWhite.glb', position: [-6.8, 0, 2.2], scale: 0.8, rotation: [0, 0, 0] },

      // --- Khu vực tây bắc: tree2 + tree3 ---
      { url: '/assets/tree2.glb', position: [-5, 0, 3], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/tree3.glb', position: [-3, 0, 3.5], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [-6, 0, 4.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [-4, 0, 5.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/flowerPurple.glb', position: [-6.5, 0, 5.2], scale: 1.1, rotation: [0, 0, 0] },
      { url: '/assets/flowerYellow.glb', position: [-5, 0, 6.2], scale: 1.6, rotation: [0, 0, 0] },

      // --- Khu vực bắc: treePine + bush ---
      { url: '/assets/treePine.glb', position: [4, 0, 6], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/bush.glb', position: [2.5, 0, 7.5], scale: 0.5, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [3, 0, 8], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [5.5, 0, 7], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/redFlower.glb', position: [2.5, 0, 8.8], scale: 1.5, rotation: [0, 0, 0] },
      { url: '/assets/flowerRed.glb', position: [4.5, 0, 8.5], scale: 0.9, rotation: [0, 0, 0] },

      // --- Khu vực trung tâm (quanh Color Wheel) ---
      { url: '/assets/grasss.glb', position: [-2, 0, 1.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/grasss.glb', position: [2, 0, -1.5], scale: 2, rotation: [0, 0, 0] },
      { url: '/assets/flowerYellow.glb', position: [-2.8, 0, 0.8], scale: 1.2, rotation: [0, 0, 0] },
      { url: '/assets/flowerPurple.glb', position: [-1.5, 0, 2.5], scale: 0.8, rotation: [0, 0, 0] },
      { url: '/assets/flowerWhite.glb', position: [1.5, 0, -2.5], scale: 1.4, rotation: [0, 0, 0] },
      { url: '/assets/flowerRed.glb', position: [2.8, 0, -0.8], scale: 1.0, rotation: [0, 0, 0] },

          // --- Khu vực tường bắc (z = -10) ---
      { url: '/assets/bamboowall.glb', position: [0, 0, -10], scale: 1, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-8, 0, -9], scale: 1.2, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-4, 0, -9], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [0, 0, -9], scale: 1.3, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [4, 0, -9], scale: 1.1, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [8, 0, -9], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-6, 0, -7.5], scale: 1.4, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-2, 0, -7.5], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [2, 0, -7.5], scale: 1.2, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [6, 0, -7.5], scale: 0.9, rotation: [0, 0, 0] },

      // --- Khu vực tường nam (z = 10) ---
      { url: '/assets/bamboowall.glb', position: [0, 0, 10], scale: 1, rotation: [0, Math.PI, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-7, 0, 9], scale: 1.1, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-3, 0, 9], scale: 1.3, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [1, 0, 9], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [5, 0, 9], scale: 1.2, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [8.5, 0, 9], scale: 1.1, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-5, 0, 7.5], scale: 1.3, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-1, 0, 7.5], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [3, 0, 7.5], scale: 1.5, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [7, 0, 7.5], scale: 0.9, rotation: [0, 0, 0] },

      // --- Khu vực tường đông (x = 10) ---
      { url: '/assets/bamboowall.glb', position: [10, 0, 0], scale: 1, rotation: [0, -Math.PI / 2, 0] },
      { url: '/assets/bigBambooTree.glb', position: [9, 0, -8], scale: 1.2, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [9, 0, -4], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [9, 0, 0], scale: 1.3, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [9, 0, 4], scale: 1.1, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [9, 0, 8], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [7.5, 0, -6], scale: 1.2, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [7.5, 0, -2], scale: 1.4, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [7.5, 0, 2], scale: 0.9, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [7.5, 0, 6], scale: 1.1, rotation: [0, 0, 0] },

      // --- Khu vực tường tây (x = -10) ---
      { url: '/assets/bamboowall.glb', position: [-10, 0, 0], scale: 1, rotation: [0, Math.PI / 2, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-9, 0, -8], scale: 1.1, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-9, 0, -3], scale: 1.3, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-9, 0, 1], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-9, 0, 5], scale: 1.2, rotation: [0, 0, 0] },
      { url: '/assets/bigBambooTree.glb', position: [-9, 0, 8.5], scale: 1.1, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-7.5, 0, -6], scale: 1.0, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-7.5, 0, -1], scale: 1.3, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-7.5, 0, 3], scale: 1.5, rotation: [0, 0, 0] },
      { url: '/assets/smallBambooTree.glb', position: [-7.5, 0, 7], scale: 0.8, rotation: [0, 0, 0] },
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