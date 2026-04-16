// SceneManager.js - Core scene, camera, WebXR renderer
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class SceneManager {
  constructor() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    // Fog for depth
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.05);

    // Camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
    this.camera.position.set(0, 1.6, 3);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    document.body.appendChild(this.renderer.domElement);

    // Lighting
    this._setupLighting();

    // Controllers
    this.controllers = [];
    this.controllerGrips = [];
    this._setupControllers();

    // Current mode
    this.currentMode = null; // 'vr' | 'ar'
    this._vrButton = null;
    this._arButton = null;
    this.isPCMode = false;

    // Resize handler
    window.addEventListener('resize', () => this._onResize());
  }

  _setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    // Hemisphere light
    const hemi = new THREE.HemisphereLight(0x8080ff, 0x804020, 0.4);
    this.scene.add(hemi);

    // Directional (main)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.01;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    this.scene.add(dirLight);

    // Point light for color accent
    const pointLight = new THREE.PointLight(0x6644ff, 1.5, 10);
    pointLight.position.set(-3, 3, -3);
    this.scene.add(pointLight);
  }

  _setupControllers() {
    this.scene.add(this.camera);
    const factory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
      // Ray controller
      const controller = this.renderer.xr.getController(i);
      controller.userData.index = i;
      this.scene.add(controller);
      this.controllers.push(controller);

      // Visual ray line
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.5 })
      );
      line.name = 'ray';
      line.scale.z = 0.5;
      controller.add(line);

      // Grip (hand model)
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(factory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  /**
   * Set up VR and AR buttons, returning DOM elements.
   * Called by modes after session is configured.
   */
  setupVRButton(sessionInit = {}) {
    const btn = VRButton.createButton(this.renderer, {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
      ...sessionInit,
    });
    document.body.appendChild(btn);
    this._vrButton = btn;
    return btn;
  }

  setupARButton(sessionInit = {}) {
    const btn = ARButton.createButton(this.renderer, {
      requiredFeatures: ['hit-test', 'local-floor'],
      optionalFeatures: ['anchors', 'mesh-detection'],
      ...sessionInit,
    });
    document.body.appendChild(btn);
    this._arButton = btn;
    return btn;
  }

  getController(index) {
    return this.controllers[index];
  }

  getControllerGrip(index) {
    return this.controllerGrips[index];
  }

  onXRSessionStart(callback) {
    this.renderer.xr.addEventListener('sessionstart', callback);
  }

  onXRSessionEnd(callback) {
    this.renderer.xr.addEventListener('sessionend', callback);
  }

  isXRPresenting() {
    return this.renderer.xr.isPresenting;
  }

  getReferenceSpace() {
    return this.renderer.xr.getReferenceSpace();
  }

  getFrame() {
    return this.renderer.xr.getFrame?.() ?? null;
  }

  setAnimationLoop(callback) {
    this.renderer.setAnimationLoop(callback);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  enablePCMode() {
    this.isPCMode = true;
    this.renderer.xr.enabled = false;
  }
}
