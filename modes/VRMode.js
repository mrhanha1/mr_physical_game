// VRMode.js - Virtual Room + Locomotion
import * as THREE from 'three';

export class VRMode {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.room = null;
    this.isActive = false;
  }

  enter() {
    if (this.isActive) return;
    this.isActive = true;
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.04);
    this._buildRoom();
  }

  exit() {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.room) {
      this.scene.remove(this.room);
      this.room = null;
    }
  }

  _buildRoom() {
    const room = new THREE.Group();
    room.name = 'VirtualRoom';

    const roomW = 8, roomH = 4, roomD = 8;

    // Materials with different tones per face
    const faceMaterials = [
      this._wallMat(0x1a1a2e, 'right'),
      this._wallMat(0x16213e, 'left'),
      this._wallMat(0x0f3460, 'top'),
      this._wallMat(0x0a0a1a, 'bottom'),
      this._wallMat(0x1a1a2e, 'front'),
      this._wallMat(0x16213e, 'back'),
    ];

    const roomGeo = new THREE.BoxGeometry(roomW, roomH, roomD);
    const roomMesh = new THREE.Mesh(roomGeo, faceMaterials);
    roomMesh.receiveShadow = true;

    // Flip normals to render inside
    roomMesh.geometry.scale(-1, 1, 1);
    room.add(roomMesh);

    // Floor grid
    const gridHelper = new THREE.GridHelper(8, 16, 0x334477, 0x222244);
    gridHelper.position.y = -roomH / 2 + 0.01;
    room.add(gridHelper);

    // Floor (solid, receiveShadow)
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d0d1a,
      metalness: 0.3,
      roughness: 0.7,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -roomH / 2 + 0.01;
    floor.receiveShadow = true;
    room.add(floor);

    // Accent strip lights near ceiling
    this._addAccentLights(room, roomW, roomH, roomD);

    // Particle stars on walls
    this._addStarField(room, roomW, roomH, roomD);

    room.position.set(0, roomH / 2, 0);
    this.room = room;
    this.scene.add(room);
  }

  _wallMat(hexColor, face) {
    return new THREE.MeshPhongMaterial({
      color: hexColor,
      side: THREE.BackSide,
      shininess: 10,
    });
  }

  _addAccentLights(room, w, h, d) {
    const positions = [
      [-w / 2 + 0.1, h / 2 - 0.1, 0],
      [w / 2 - 0.1, h / 2 - 0.1, 0],
      [0, h / 2 - 0.1, -d / 2 + 0.1],
      [0, h / 2 - 0.1, d / 2 - 0.1],
    ];
    const colors = [0xff4488, 0x44aaff, 0x88ff44, 0xffaa44];

    positions.forEach(([x, y, z], i) => {
      // Glowing tube
      const tubeGeo = new THREE.CylinderGeometry(0.015, 0.015, w * 0.8, 8);
      const tubeMat = new THREE.MeshBasicMaterial({ color: colors[i] });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.set(x, y, z);
      tube.rotation.z = i < 2 ? 0 : Math.PI / 2;
      if (i >= 2) tube.rotation.y = Math.PI / 2;
      room.add(tube);

      // Point light
      const light = new THREE.PointLight(colors[i], 0.8, 5);
      light.position.set(x, y - 0.1, z);
      room.add(light);
    });
  }

  _addStarField(room, w, h, d) {
    const count = 300;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * w * 0.9;
      positions[i * 3 + 1] = (Math.random() - 0.5) * h * 0.9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * d * 0.9;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xaabbff,
      size: 0.015,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    });

    const stars = new THREE.Points(geo, mat);
    room.add(stars);
    this._stars = stars;
  }

  update(delta) {
    if (!this.isActive) return;
    // Slowly rotate stars
    if (this._stars) {
      this._stars.rotation.y += delta * 0.02;
    }
  }
}
