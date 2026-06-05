// SphereGenerator.js - Color sphere spawning system
import * as THREE from 'three';

// 12 HSL preset colors, 30° steps
export const COLOR_PRESETS = [
  { name: 'Red',          hex: '#FF0000' },  // 0  - Primary RYB
  { name: 'Red-Orange',   hex: '#FF4000' },  // 1  - Tertiary
  { name: 'Orange',       hex: '#FF8000' },  // 2  - Secondary
  { name: 'Yellow-Orange',hex: '#FFAA00' },  // 3  - Tertiary
  { name: 'Yellow',       hex: '#FFFF00' },  // 4  - Primary RYB
  { name: 'Yellow-Green', hex: '#80CC00' },  // 5  - Tertiary
  { name: 'Green',        hex: '#00AA00' },  // 6  - Secondary
  { name: 'Blue-Green',   hex: '#007755' },  // 7  - Tertiary
  { name: 'Blue',         hex: '#0000FF' },  // 8  - Primary RYB
  { name: 'Blue-Violet',  hex: '#4400CC' },  // 9  - Tertiary
  { name: 'Violet',       hex: '#8800AA' },  // 10 - Secondary
  { name: 'Red-Violet',   hex: '#CC0055' },  // 11 - Tertiary
];

export class SphereGenerator {
  constructor(scene) {
    this.scene = scene;
    this.activeSpheres = [];

    // Shared geometry/materials for instancing
    this.geometry = new THREE.SphereGeometry(0.06, 32, 32);
  }

  /**
   * Create a sphere for a given color preset index.
   * @param {number} colorIndex - index into COLOR_PRESETS
   * @returns {THREE.Mesh}
   */
  _createSphere(colorIndex) {
    const preset = COLOR_PRESETS[colorIndex];
    const color = new THREE.Color(preset.hex);

    const material = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.0,
      roughness: 0.1,
      transmission: 0.0,
      emissive: color,
      emissiveIntensity: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    const sphere = new THREE.Mesh(this.geometry, material);
    sphere.castShadow = true;
    sphere.userData.color = preset.hex;
    sphere.userData.colorIndex = colorIndex;
    sphere.userData.colorName = preset.name;
    sphere.userData.isColorSphere = true;
    sphere.userData.isGrabbed = false;
    sphere.userData.isLocked = false;

    // Outline glow via second mesh
    const glowGeo = new THREE.SphereGeometry(0.07, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    sphere.add(glow);

    return sphere;
  }

  /**
   * Spawn a batch of spheres around an anchor position for a level.
   * @param {THREE.Vector3} anchor - center position (e.g. ColorCircle position)
   * @param {number[]} colorIndices - which colors to spawn
   * @param {object} options
   */
  spawnForLevel(anchor, colorIndices, options = {}) {
    const {
      radius = 1.2,
      heightRange = [0.8, 1.8],
      clearPrevious = true,
    } = options;

    if (clearPrevious) this.clearAll();

    for (const idx of colorIndices) {
      const sphere = this._createSphere(idx);

      // Random position in a hemisphere around anchor
      const angle = Math.random() * Math.PI * 2;
      const r = radius * (0.5 + Math.random() * 0.8);
      const h = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);

      sphere.position.set(
        anchor.x + Math.cos(angle) * r,
        h,
        anchor.z + Math.sin(angle) * r
      );

      this.scene.add(sphere);
      this.activeSpheres.push(sphere);
    }

    return this.activeSpheres;
  }

  /**
   * Remove a sphere from scene and tracked list.
   */
  removeSphere(sphere) {
    const idx = this.activeSpheres.indexOf(sphere);
    if (idx !== -1) this.activeSpheres.splice(idx, 1);
    this.scene.remove(sphere);
    sphere.geometry?.dispose();
    sphere.material?.dispose();
  }

  clearAll() {
    for (const s of [...this.activeSpheres]) {
      this.scene.remove(s);
    }
    this.activeSpheres = [];
  }

  getActiveSpheres() {
    return this.activeSpheres;
  }
}
