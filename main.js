// main.js - Application entry point
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { SphereGenerator } from './core/SphereGenerator.js';
import { LevelManager } from './core/LevelManager.js';
import { Interaction } from './core/Interaction.js';
import { AudioManager } from './core/AudioManager.js';
import { GunMode } from './core/GunMode.js';
import { VRMode } from './modes/VRMode.js';
import { ARMode } from './modes/ARMode.js';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const sceneManager = new SceneManager();
const scene = sceneManager.scene;
const camera = sceneManager.camera;

// ─── Core Systems ─────────────────────────────────────────────────────────────

const audioManager  = new AudioManager(camera);
const sphereGen     = new SphereGenerator(scene);
const levelManager  = new LevelManager(scene, audioManager);
const interaction   = new Interaction(sceneManager, levelManager, audioManager, sphereGen);
const gunMode       = new GunMode(sceneManager, sphereGen, levelManager);

interaction.setGunMode(gunMode);

// ─── Modes ───────────────────────────────────────────────────────────────────

const vrMode = new VRMode(sceneManager);
const arMode = new ARMode(sceneManager, levelManager, sphereGen);

// ─── UI Overlay ──────────────────────────────────────────────────────────────

const ui = buildUI();

// ─── Session Lifecycle ───────────────────────────────────────────────────────

let activeMode = null; // 'vr' | 'ar' | null

sceneManager.onXRSessionStart(() => {
  const session = sceneManager.renderer.xr.getSession();

  if (session.__colorWheelMode === 'ar') {
    activeMode = 'ar';
    vrMode.exit();
    arMode.enter();
    ui.setMode('ar');
  } else {
    activeMode = 'vr';
    arMode.exit();
    vrMode.enter();
    ui.setMode('vr');

    const anchor = new THREE.Vector3(0, 0, -1.5);
    levelManager.buildColorCircle(anchor);
    const colorIndices = levelManager.getActiveSlotColorIndices();
    sphereGen.spawnForLevel(anchor, colorIndices, {
      radius: 1.2,
      heightRange: [0.9, 1.8],
    });
  }
});

sceneManager.onXRSessionEnd(() => {
  activeMode = null;
  vrMode.exit();
  arMode.exit();
  levelManager.reset();
  sphereGen.clearAll();

  // Reset gun mode khi thoát session
  if (gunMode.isActive) gunMode.toggle();
  ui.setMode('desktop');
});

// ─── Level Progress ───────────────────────────────────────────────────────────

levelManager.onLevelComplete = (completedIndex) => {
  ui.showLevelComplete(completedIndex + 1);

  setTimeout(() => {
    levelManager.nextLevel();
    sphereGen.clearAll();

    const anchor = levelManager.getCircleAnchor();
    levelManager.buildColorCircle(anchor);
    const colorIndices = levelManager.getActiveSlotColorIndices();

    sphereGen.spawnForLevel(anchor, colorIndices, {
      radius: activeMode === 'ar' ? 0.8 : 1.2,
      heightRange: activeMode === 'ar' ? [0.5, 1.4] : [0.9, 1.8],
    });

    if (activeMode === 'ar') arMode.resetAnchor();

    ui.hideLevelComplete();
    ui.updateLevel(levelManager.currentLevelIndex + 1, levelManager.getLevelCount());
  }, 2500);
};

// ─── Add ambient audio object to scene ───────────────────────────────────────

setTimeout(() => {
  const ambientObj = audioManager.getAmbientObject();
  if (ambientObj) scene.add(ambientObj);
}, 1500);

// ─── Render Loop ─────────────────────────────────────────────────────────────

const clock = new THREE.Clock();

sceneManager.setAnimationLoop((timestamp, frame) => {
  const delta = Math.min(clock.getDelta(), 0.05);

  if (activeMode === 'vr') {
    vrMode.update(delta);
    interaction.updateLocomotion(delta, 2.5);
    interaction.update(delta);
    gunMode.updateButtonInput();
    gunMode.update(delta);
  }

  if (activeMode === 'ar') {
    const refSpace = sceneManager.getReferenceSpace();
    arMode.update(frame, refSpace);
    interaction.update(delta);
    gunMode.updateButtonInput();
    gunMode.update(delta);
  }

  levelManager.update(delta);

  if (!activeMode) {
    const t = timestamp * 0.0003;
    camera.position.x = Math.sin(t) * 3;
    camera.position.z = Math.cos(t) * 3;
    camera.lookAt(0, 0.5, 0);
  }

  sceneManager.render();
});

// ─── UI Builder ──────────────────────────────────────────────────────────────

function buildUI() {
  const overlay = document.getElementById('ui-overlay');
  const modeLabel = document.getElementById('mode-label');
  const levelLabel = document.getElementById('level-label');
  const levelBanner = document.getElementById('level-banner');
  const progressBar = document.getElementById('progress-bar-fill');

  return {
    setMode(mode) {
      modeLabel.textContent = mode === 'vr' ? '🥽 VR Mode' : mode === 'ar' ? '📱 AR Mode' : '🖥 Desktop Preview';
      modeLabel.className = `mode-badge mode-${mode}`;
    },
    updateLevel(current, total) {
      levelLabel.textContent = `Level ${current} / ${total}`;
      progressBar.style.width = `${((current - 1) / total) * 100}%`;
    },
    showLevelComplete(levelNum) {
      levelBanner.textContent = `✨ Level ${levelNum} Complete!`;
      levelBanner.classList.add('show');
    },
    hideLevelComplete() {
      levelBanner.classList.remove('show');
    },
  };
}

// ─── VR/AR Button Tag ─────────────────────────────────────────────────────────

(function patchButtons() {
  const vrBtn = sceneManager.setupVRButton();
  vrBtn.addEventListener('click', () => {
    const xr = sceneManager.renderer.xr;
    xr.addEventListener(
      'sessionstart',
      () => {
        const s = xr.getSession();
        if (s) s.__colorWheelMode = 'vr';
      },
      { once: true }
    );
  });

  const arBtn = sceneManager.setupARButton();
  arBtn.addEventListener('click', () => {
    const xr = sceneManager.renderer.xr;
    xr.addEventListener(
      'sessionstart',
      () => {
        const s = xr.getSession();
        if (s) s.__colorWheelMode = 'ar';
      },
      { once: true }
    );
  });

  const uiRef = buildUI();
  uiRef.setMode('desktop');
  uiRef.updateLevel(1, levelManager.getLevelCount());
})();

// ─── Desktop mouse drag (flat-screen fallback) ────────────────────────────────

(function setupDesktopDrag() {
  const canvas = sceneManager.renderer.domElement;
  let isDragging = false;
  let lastMouse = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || activeMode) return;
    const dx = (e.clientX - lastMouse.x) * 0.005;
    camera.position.x = Math.sin(clock.getElapsedTime() * 0.3 + dx) * 3;
    camera.position.z = Math.cos(clock.getElapsedTime() * 0.3 + dx) * 3;
    lastMouse = { x: e.clientX, y: e.clientY };
  });
})();