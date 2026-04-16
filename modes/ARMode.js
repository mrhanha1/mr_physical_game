// ARMode.js - Hit-test + anchor-based AR mode
import * as THREE from 'three';

export class ARMode {
  constructor(sceneManager, levelManager, sphereGenerator) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.levelManager = levelManager;
    this.sphereGenerator = sphereGenerator;

    this.isActive = false;
    this.hitTestSource = null;
    this.hitTestSourceRequested = false;
    this.circleAnchored = false;
    this.anchorPosition = new THREE.Vector3();

    // Reticle for hit-test indicator
    this.reticle = this._createReticle();
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // Tap to place handler
    this._onSelect = this._onSelect.bind(this);
  }

  enter() {
    if (this.isActive) return;
    this.isActive = true;

    // Transparent background for passthrough
    this.sceneManager.renderer.setClearAlpha(0);
    this.sceneManager.scene.background = null;
    this.sceneManager.scene.fog = null;

    this.reticle.visible = false;
    this.hitTestSourceRequested = false;
    this.hitTestSource = null;
    this.circleAnchored = false;

    // Bind select (tap) for placing the circle
    const controller = this.sceneManager.getController(0);
    controller.addEventListener('select', this._onSelect);

    this._refSpace = null;
    const session = this.sceneManager.renderer.xr.getSession();
    session.requestReferenceSpace('local-floor').then(rs => {
      this._refSpace = rs;
    });
  }

  exit() {
    if (!this.isActive) return;
    this.isActive = false;

    this.reticle.visible = false;
    this.sceneManager.renderer.setClearAlpha(1);

    // Stop hit-test
    if (this.hitTestSource) {
      this.hitTestSource.cancel();
      this.hitTestSource = null;
    }
    this.hitTestSourceRequested = false;

    const controller = this.sceneManager.getController(0);
    controller.removeEventListener('select', this._onSelect);
  }

  _createReticle() {
    const reticle = new THREE.Group();

    // Outer ring
    const ringGeo = new THREE.TorusGeometry(0.12, 0.008, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x44aaff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    reticle.add(ring);

    // Center dot
    const dotGeo = new THREE.CircleGeometry(0.02, 32);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = -Math.PI / 2;
    reticle.add(dot);

    // Pulse animation via scale
    reticle.userData.pulsePhase = 0;
    reticle.matrixAutoUpdate = false;

    return reticle;
  }

  _onSelect() {
    if (!this.reticle.visible || this.circleAnchored) return;

    // Extract position from reticle matrix
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(this.reticle.matrix);

    this.anchorPosition.copy(pos);
    this.circleAnchored = true;
    this.reticle.visible = false;

    // Build ColorCircle at floor position
    this.levelManager.buildColorCircle(pos);

    // Spawn spheres around anchor
    const colorIndices = this.levelManager.getActiveSlotColorIndices();
    this.sphereGenerator.spawnForLevel(pos, colorIndices, {
      radius: 0.8,
      heightRange: [0.5, 1.4],
    });
  }

  /**
   * Main update loop — handles hit-test.
   * @param {XRFrame} frame
   * @param {XRReferenceSpace} referenceSpace
   */
  update(frame, referenceSpace) {
    if (!this.isActive || !frame) return;

    const refSpace = this._refSpace;
    if (!refSpace) return; // chờ cho đến khi có
    const pose = hit.getPose(refSpace);

    const session = frame.session;

    // Request hit-test source once
    if (!this.hitTestSourceRequested) {
      this.hitTestSourceRequested = true;
      session
        .requestReferenceSpace('viewer')
        .then((viewerSpace) => {
          return session.requestHitTestSource({ space: viewerSpace });
        })
        .then((source) => {
          this.hitTestSource = source;
        })
        .catch((err) => {
          console.warn('ARMode: hit-test source error', err);
        });
    }

    if (!this.hitTestSource || this.circleAnchored || !this._refSpace) {
      return;
    }

    const hitTestResults = frame.getHitTestResults(this.hitTestSource);

    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(this._refSpace); // ← dùng _refSpace thay vì tham số referenceSpace

      this.reticle.visible = true;
      this.reticle.matrix.fromArray(pose.transform.matrix);
      this.reticle.matrixWorldNeedsUpdate = true;

      const t = performance.now() * 0.003;
      const s = 1 + 0.08 * Math.sin(t * 3);
      this.reticle.matrix.scale(new THREE.Vector3(s, s, s));
    } else {
      this.reticle.visible = false;
    }
  }

  resetAnchor() {
    this.circleAnchored = false;
    this.reticle.visible = false;
  }
}
