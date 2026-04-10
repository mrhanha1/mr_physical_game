// LevelManager.js - Color Circle slot system
import * as THREE from 'three';
import { COLOR_PRESETS } from './SphereGenerator.js';

// Level definitions: each level specifies which secondary/tertiary colors are active
const LEVELS = [
  {
    // Level 1 - Just secondaries (3 slots to fill)
    name: 'Level 1 — Secondaries',
    slotColorIndices: [2, 6, 10], // Yellow, Cyan, Magenta
    description: 'Fill the secondary colors: Yellow, Cyan, Magenta',
  },
  {
    // Level 2 - Two tertiaries added
    name: 'Level 2 — Warm Tertiaries',
    slotColorIndices: [2, 6, 10, 1, 3], // + Orange, Chartreuse
    description: 'Warm tertiaries added: Orange, Chartreuse',
  },
  {
    // Level 3 - All 9 non-primary slots
    name: 'Level 3 — Full Wheel',
    slotColorIndices: [1, 2, 3, 5, 6, 7, 9, 10, 11],
    description: 'Complete the full color wheel!',
  },
];

// Primary slot positions (fixed, pre-colored) at 0°/120°/240°
const PRIMARY_INDICES = [0, 4, 8]; // Red, Green, Blue

export class LevelManager {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audio = audioManager;
    this._pendingAnimations = [];
    this._winAnim = null;
    this._winDelay = null;
    this.currentLevelIndex = 0;
    this.colorCircle = null; // current Group
    this.slots = []; // { mesh, expectedColorIndex, filled }
    this.onLevelComplete = null; // callback
    this.circleRadius = 0.55;
    this.circleAnchor = new THREE.Vector3(0, 0.1, -1.5);
  }

  getCurrentLevel() {
    return LEVELS[Math.min(this.currentLevelIndex, LEVELS.length - 1)];
  }

  getLevelCount() {
    return LEVELS.length;
  }

  buildColorCircle(position) {
    if (this.colorCircle) {
      this.scene.remove(this.colorCircle);
    }
    this.slots = [];

    const level = this.getCurrentLevel();
    this.circleAnchor.copy(position);

    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.x = Math.PI / 2;
    group.name = 'ColorCircle';

    const ringGeo = new THREE.TorusGeometry(this.circleRadius + 0.04, 0.015, 16, 100);
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0x334466,
      metalness: 0.5,
      roughness: 0.3,
      emissive: 0x1122aa,
      emissiveIntensity: 0.3,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const totalSlots = 12;
    const activeSlotIndices = new Set(level.slotColorIndices);
    const primarySet = new Set(PRIMARY_INDICES);

    for (let i = 0; i < totalSlots; i++) {
      const angleRad = (i / totalSlots) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angleRad) * this.circleRadius;
      const z = Math.sin(angleRad) * this.circleRadius;

      const colorIndex = i;
      const isPrimary = primarySet.has(colorIndex);
      const isActive = activeSlotIndices.has(colorIndex);

      if (isPrimary) {
        this._addPrimarySlot(group, x, z, colorIndex, angleRad);
      } else if (isActive) {
        const slotMesh = this._addEmptySlot(group, x, z, colorIndex, angleRad);
        this.slots.push({
          mesh: slotMesh,
          expectedColorIndex: colorIndex,
          position: new THREE.Vector3(x, 0, z).add(position),
          filled: false,
        });
      } else {
        this._addInactiveSlot(group, x, z);
      }
    }

    this._addCenterLabel(group, level.name);

    this.colorCircle = group;
    this.scene.add(group);

    return group;
  }

  _addPrimarySlot(parent, x, z, colorIndex, angle) {
    const preset = COLOR_PRESETS[colorIndex];
    const color = new THREE.Color(preset.hex);

    const geo = new THREE.CylinderGeometry(0.07, 0.07, 0.015, 32);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 1.0,
    });
    const disc = new THREE.Mesh(geo, mat);
    disc.position.set(x, 0.01, z);
    disc.castShadow = true;
    disc.userData.isPrimary = true;
    parent.add(disc);

    this._addSlotLabel(parent, preset.name, x, 0.05, z);
  }

  _addEmptySlot(parent, x, z, colorIndex, angle) {
    const preset = COLOR_PRESETS[colorIndex];
    const color = new THREE.Color(preset.hex);

    const ringGeo = new THREE.TorusGeometry(0.065, 0.008, 16, 64);
    const ringMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.7,
    });
    const slotRing = new THREE.Mesh(ringGeo, ringMat);
    slotRing.rotation.x = Math.PI / 2;

    const ghostGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.008, 32);
    const ghostMat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      emissive: color,
      emissiveIntensity: 0.05,
    });
    const ghost = new THREE.Mesh(ghostGeo, ghostMat);

    const slotGroup = new THREE.Group();
    slotGroup.add(slotRing);
    slotGroup.add(ghost);
    slotGroup.userData.isSlot = true;
    slotGroup.userData.expectedColorIndex = colorIndex;
    slotGroup.userData.filled = false;
    slotGroup.position.set(x, 0.005, z);

    slotRing.position.set(0, 0, 0);
    ghost.position.set(0, 0, 0);

    parent.add(slotGroup);

    return slotGroup;
  }

  _addInactiveSlot(parent, x, z) {
    const geo = new THREE.CircleGeometry(0.05, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x222233,
      transparent: true,
      opacity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.001, z);
    parent.add(mesh);
  }

  _addCenterLabel(parent, text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, 512, 128);

    ctx.fillStyle = '#99aaff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const labelGeo = new THREE.PlaneGeometry(0.5, 0.12);
    const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.set(0, 0.02, 0);
    parent.add(labelMesh);
  }

  _addSlotLabel(parent, text, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.12, 0.03);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z - 0.1);
    parent.add(mesh);
  }

  checkDrop(sphere, worldPos) {
    const DISTANCE_THRESHOLD = 0.15;
    let bestSlot = null;
    let bestDist = Infinity;

    for (const slot of this.slots) {
      if (slot.filled) continue;

      const slotWorld = new THREE.Vector3();
      slot.mesh.getWorldPosition(slotWorld);

      const dist = worldPos.distanceTo(slotWorld);
      if (dist < DISTANCE_THRESHOLD && dist < bestDist) {
        bestDist = dist;
        bestSlot = slot;
      }
    }

    if (!bestSlot) return null;

    const colorMatch = sphere.userData.colorIndex === bestSlot.expectedColorIndex;
    return { slot: bestSlot, colorMatch, distance: bestDist };
  }

  fillSlot(slot, sphere) {
    slot.filled = true;
    sphere.userData.isLocked = true;
    sphere.visible = false;

    const localPos = slot.mesh.position.clone();

    const preset = COLOR_PRESETS[slot.expectedColorIndex];
    const color = new THREE.Color(preset.hex);
    const fillGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.015, 32);
    const fillMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 1.0,
    });
    const fillDisc = new THREE.Mesh(fillGeo, fillMat);
    fillDisc.position.copy(localPos);

    this.colorCircle.remove(slot.mesh);
    this.colorCircle.add(fillDisc);

    this._animateFill(fillDisc, color);

    if (this.slots.every((s) => s.filled)) {
      this._winDelay = 1.0;
    }
  }

  _animateFill(disc, color) {
    disc.scale.set(0.1, 0.1, 0.1);
    this._pendingAnimations.push({ disc, color, elapsed: 0, duration: 0.4 });
  }

  _onWin() {
    console.log(`Level ${this.currentLevelIndex + 1} complete!`);
    this._winAnim = { elapsed: 0, duration: 1.5 };
  }

  nextLevel() {
    this.currentLevelIndex = Math.min(this.currentLevelIndex + 1, LEVELS.length - 1);
  }

  reset() {
    this.currentLevelIndex = 0;
    if (this.colorCircle) {
      this.scene.remove(this.colorCircle);
      this.colorCircle = null;
    }
    this.slots = [];
    this._pendingAnimations = [];
    this._winAnim = null;
    this._winDelay = null;
  }

  getCircleAnchor() {
    return this.circleAnchor.clone();
  }

  getActiveSlotColorIndices() {
    return this.getCurrentLevel().slotColorIndices;
  }

  update(delta) {
    if (this.colorCircle) {
      this.colorCircle.rotation.y += delta * 0.05;
    }

    this._pendingAnimations = this._pendingAnimations.filter(anim => {
      anim.elapsed += delta;
      const t = Math.min(anim.elapsed / anim.duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      anim.disc.scale.set(ease, ease, ease);
      anim.disc.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * Math.PI);
      return t < 1;
    });

    if (this._winDelay !== null) {
      this._winDelay -= delta;
      if (this._winDelay <= 0) {
        this._winDelay = null;
        this._onWin();
      }
    }

    if (this._winAnim) {
      this._winAnim.elapsed += delta;
      const t = this._winAnim.elapsed / this._winAnim.duration;
      if (this.colorCircle) {
        this.colorCircle.scale.setScalar(1 + 0.05 * Math.sin(t * Math.PI * 6));
      }
      if (t >= 1) {
        this._winAnim = null;
        if (this.colorCircle) this.colorCircle.scale.setScalar(1);
        if (this.onLevelComplete) this.onLevelComplete(this.currentLevelIndex);
      }
    }
  }
}