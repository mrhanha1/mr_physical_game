// SphereGenerator.js - Color sphere spawning system
import * as THREE from 'three';

export const COLOR_PRESETS = [
  { name: 'Red',          hex: '#FF0000' },  // 0  - Primary RYB
  { name: 'Red-Orange',   hex: '#FF6600' },  // 1  - Tertiary
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

// Tier classification
const TIER2_SET = new Set([2, 6, 10]);
const TIER3_SET = new Set([1, 3, 5, 7, 9, 11]);

// Primary color indices và góc sector (radians) của vùng spawn tương ứng
// Đổi 3 giá trị này để thay đổi vị trí 3 khu vực spawn
const PRIMARY_SECTORS = [
  { colorIndex: 0, angle: Math.PI },        // Red    → phía sau anchor
  { colorIndex: 4, angle: Math.PI * 5 / 3 },// Yellow → phải-sau
  { colorIndex: 8, angle: Math.PI * 4 / 3 },// Blue   → trái-sau
];

const SECTOR_SPREAD = Math.PI / 3; // ±60° mỗi sector

export class SphereGenerator {
  constructor(scene) {
    this.scene = scene;
    this.activeSpheres = [];
    this.geometry = new THREE.SphereGeometry(0.06, 32, 32);
  }

  // ─── Sphere creation ──────────────────────────────────────────────────────

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

    const glowGeo = new THREE.SphereGeometry(0.07, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    sphere.add(new THREE.Mesh(glowGeo, glowMat));

    return sphere;
  }

  // ─── Spawn logic ──────────────────────────────────────────────────────────

  /**
   * Tính số sphere mỗi màu cơ bản cần spawn dựa vào slot indices đang active.
   * tier2 slot → 1 sphere/primary, tier3 slot → 2 sphere/primary.
   * @param {number[]} activeSlotIndices
   * @returns {number}
   */
  _countPerPrimary(activeSlotIndices) {
    let count = 0;
    for (const idx of activeSlotIndices) {
      if (TIER2_SET.has(idx)) count += 1;
      else if (TIER3_SET.has(idx)) count += 2;
    }
    return count;
  }

  /**
   * Tính vị trí ngẫu nhiên trong sector của một màu cơ bản.
   * @param {THREE.Vector3} spawnCenter - tâm vùng spawn (có thể khác anchor ColorCircle)
   * @param {number} sectorAngle - góc trung tâm sector (radians)
   * @param {number} radius
   * @param {number[]} heightRange
   * @returns {THREE.Vector3}
   */
  _sectorPosition(spawnCenter, sectorAngle, radius, heightRange) {
    const angle = sectorAngle + (Math.random() - 0.5) * 2 * SECTOR_SPREAD;
    const r = radius * (0.5 + Math.random() * 0.8);
    const h = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
    return new THREE.Vector3(
      spawnCenter.x + Math.cos(angle) * r,
      h,
      spawnCenter.z + Math.sin(angle) * r,
    );
  }

  /**
   * Spawn sphere cho một level.
   * Mỗi tier2 slot → 1 sphere mỗi primary. Mỗi tier3 slot → 2 sphere mỗi primary.
   * Sphere chia 3 khu vực theo màu cơ bản tương ứng.
   *
   * @param {THREE.Vector3} anchor       - vị trí ColorCircle (tham chiếu)
   * @param {number[]} activeSlotIndices - từ levelManager.getActiveSlotColorIndices()
   * @param {object}   options
   * @param {number}            [options.radius=1.2]
   * @param {number[]}          [options.heightRange=[0.8,1.8]]
   * @param {THREE.Vector3}     [options.spawnCenter]  - override tâm spawn, mặc định = anchor
   * @param {boolean}           [options.clearPrevious=true]
   */
  spawnForLevel(anchor, activeSlotIndices, options = {}) {
    const {
      radius = 1.2,
      heightRange = [0.8, 1.8],
      spawnCenter = anchor,
      clearPrevious = true,
    } = options;

    if (clearPrevious) this.clearAll();

    const countPerPrimary = this._countPerPrimary(activeSlotIndices);
    if (countPerPrimary === 0) return this.activeSpheres;

    for (const { colorIndex, angle } of PRIMARY_SECTORS) {
      for (let i = 0; i < countPerPrimary; i++) {
        const sphere = this._createSphere(colorIndex);
        sphere.position.copy(this._sectorPosition(spawnCenter, angle, radius, heightRange));
        this.scene.add(sphere);
        this.activeSpheres.push(sphere);
      }
    }

    return this.activeSpheres;
  }

  // ─── Management ───────────────────────────────────────────────────────────

  /** Xóa sphere khỏi scene và activeSpheres, giải phóng material. */
  removeSphere(sphere) {
    const idx = this.activeSpheres.indexOf(sphere);
    if (idx !== -1) this.activeSpheres.splice(idx, 1);
    this.scene.remove(sphere);
    sphere.material?.dispose();
  }

  clearAll() {
    for (const s of [...this.activeSpheres]) this.scene.remove(s);
    this.activeSpheres = [];
  }

  getActiveSpheres() {
    return this.activeSpheres;
  }
}