// main.js - Application entry point
import * as THREE from 'three';
import { SceneManager }    from './core/SceneManager.js';
import { SphereGenerator } from './core/SphereGenerator.js';
import { LevelManager }    from './core/LevelManager.js';
import { GrabSystem }      from './core/GrabSystem.js';
import { VRInput }         from './core/VRInput.js';
import { AudioManager }    from './core/AudioManager.js';
import { GunMode }         from './core/GunMode.js';
import { VRMode }          from './modes/VRMode.js';
import { ARMode }          from './modes/ARMode.js';
import { PCMode }          from './modes/PCMode.js';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const sceneManager = new SceneManager();
const scene  = sceneManager.scene;
const camera = sceneManager.camera;

// ─── Core Systems ─────────────────────────────────────────────────────────────

const audioManager = new AudioManager(camera);
const sphereGen    = new SphereGenerator(scene);
const levelManager = new LevelManager(scene, audioManager);

// Shared game-logic layer
const grabSystem = new GrabSystem(sceneManager, levelManager, audioManager, sphereGen);
const gunMode    = new GunMode(sceneManager, sphereGen, levelManager);
grabSystem.setGunMode(gunMode);

// VR input layer (XR controller events)
const vrInput = new VRInput(sceneManager, grabSystem);

// ─── Modes ───────────────────────────────────────────────────────────────────

const vrMode = new VRMode(sceneManager);
const arMode = new ARMode(sceneManager, levelManager, sphereGen);

// PC Mode
let pcMode = null;
const xrSupported = await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false);

function activatePCMode() {
  if (pcMode) return;
  sceneManager.enablePCMode();

  // Dùng cùng anchor logic như VR (build room trước để lấy wallAnchor)
  vrMode.enter();
  camera.position.set(0, 1.6, 1.5); // đứng phía trong room nhìn vào wall

  pcMode = new PCMode(sceneManager, grabSystem, gunMode);

  // Dùng vrMode.wallAnchor — thống nhất với VR mode (Bước 3)
  const anchorPos = vrMode.wallAnchor.clone();
  levelManager.buildColorCircle(anchorPos);
  const colorIndices = levelManager.getActiveSlotColorIndices();
  sphereGen.spawnForLevel(anchorPos, colorIndices, { radius: 1.0, heightRange: [0.8, 1.6] });

  document.getElementById('PCButton')?.remove();
  document.getElementById('instructions').innerHTML = `
    <h2>PC Controls</h2>
    <p>
      <span class="key">Click</span> canvas để bắt đầu · <span class="key">ESC</span> để thoát con trỏ<br/><br/>
      🖱 <span class="key">Chuột</span> nhìn xung quanh<br/>
      ⌨️ <span class="key">W A S D</span> di chuyển · <span class="key">Space</span> lên · <span class="key">C</span> xuống<br/>
      🖱 <span class="key">Click trái</span> tay trái grab · <span class="key">Click phải</span> tay phải grab<br/>
      🔫 <span class="key">Q</span> toggle Gun Mode · <span class="key">Click trái</span> bắn
    </p>`;
}

// Tự động bật nếu không có XR
if (!xrSupported) activatePCMode();

// Nút bấm thủ công
document.getElementById('PCButton')?.addEventListener('click', activatePCMode);
if (xrSupported) document.getElementById('PCButton').style.display = 'block';
else document.getElementById('PCButton').style.display = 'none';

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

    const anchor = vrMode.wallAnchor;
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
    vrInput.updateLocomotion(delta, 2.5);
    grabSystem.update(delta);
    gunMode.updateButtonInput();
    gunMode.update(delta);
  }

  if (activeMode === 'ar') {
    const refSpace = sceneManager.getReferenceSpace();
    arMode.update(frame, refSpace);
    grabSystem.update(delta);
    gunMode.updateButtonInput();
    gunMode.update(delta);
  }

  // PC Mode update
  if (pcMode) {
    pcMode.update(delta);
    grabSystem.update(delta);
    gunMode.update(delta);
  }

  levelManager.update(delta);

  if (!activeMode && !pcMode) {
    const t = timestamp * 0.0003;
    camera.position.x = Math.sin(t) * 3;
    camera.position.z = Math.cos(t) * 3;
    camera.lookAt(0, 0.5, 0);
  }

  sceneManager.render();
});

// ─── UI Builder ──────────────────────────────────────────────────────────────

function buildUI() {
  const overlay    = document.getElementById('ui-overlay');
  const modeLabel  = document.getElementById('mode-label');
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

const ui = buildUI();
ui.setMode('desktop');
ui.updateLevel(1, levelManager.getLevelCount());

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
})();
