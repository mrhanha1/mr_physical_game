import * as THREE from 'three'
import { Renderer }        from './core/Renderer.js'
import { XRSession }       from './core/XRSession.js'
import { PhysicsWorld }    from './core/PhysicsWorld.js'
import { PlaneDetector }   from './world/PlaneDetector.js'
import { MeshDetector }    from './world/MeshDetector.js'
import { SceneManager }    from './world/SceneManager.js'
import { PlayerRig }       from './player/PlayerRig.js'
import { ControllerInput } from './player/ControllerInput.js'
import { Locomotion }      from './player/Locomotion.js'
import { HapticManager }   from './player/HapticManager.js'
import { HandTracking }    from './player/HandTracking.js'
import { GestureDetector } from './player/GestureDetector.js'
import { GlowHands }       from './player/GlowHands.js'
import { GunSystem }       from './combat/GunSystem.js'
import { BulletManager }   from './combat/BulletManager.js'
import { HitDetection }    from './combat/HitDetection.js'
import { MeleeSystem }     from './combat/MeleeSystem.js'
import { VRUI }            from './ui/VRUI.js'
import { WristHUD }        from './ui/WristHUD.js'
import { RayPointer }      from './ui/RayPointer.js'
import { GamePanel }       from './ui/GamePanel.js'
import { ComfortMenu }     from './ui/ComfortMenu.js'
import { Pistol }          from './weapons/Pistol.js'
import { EnemySpawner }    from './enemy/EnemySpawner.js'
import { AudioManager }    from './audio/AudioManager.js'
import { ScoreSystem }     from './game/ScoreSystem.js'
import { WaveManager, GameState } from './game/WaveManager.js'
import { DepthSensor }     from './core/DepthSensor.js'
import { LightEstimator }  from './core/LightEstimator.js'
import { updateOcclusionUniforms } from './core/OcclusionMaterial.js'

// ─── Core ─────────────────────────────────────────────────────────
const renderer  = new Renderer()
const xrSession = new XRSession(renderer)
const scene     = new THREE.Scene()
const camera    = new THREE.PerspectiveCamera()

const dirLight = new THREE.DirectionalLight(0xffffff, 1)
dirLight.position.set(1, 2, 1)
scene.add(dirLight)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

// ─── Phase 11 ─────────────────────────────────────────────────────
const depthSensor    = new DepthSensor()
const lightEstimator = new LightEstimator(dirLight, ambientLight)

// ─── World ────────────────────────────────────────────────────────
const sceneManager  = new SceneManager(scene)
const planeDetector = new PlaneDetector()
const meshDetector  = new MeshDetector()

// ─── Player ───────────────────────────────────────────────────────
const playerRig       = new PlayerRig(renderer.renderer, scene)
const controllerInput = new ControllerInput(renderer.renderer)
const locomotion      = new Locomotion(camera)
const haptic          = new HapticManager(renderer.renderer)
const handTracking    = new HandTracking(renderer.renderer, scene)
const gestureDetector = new GestureDetector(handTracking)
const glowHands       = new GlowHands(renderer.renderer, scene)   // phase 12

// ─── Physics ──────────────────────────────────────────────────────
const physics = new PhysicsWorld()
await physics.init()

// ─── Audio ────────────────────────────────────────────────────────
const audio = new AudioManager()
await audio.loadAll()

// ─── Combat ───────────────────────────────────────────────────────
const bulletManager = new BulletManager(scene)
const gunSystem     = new GunSystem(scene, physics, controllerInput, renderer.renderer)
const meleeSystem   = new MeleeSystem(renderer.renderer, scene)
const vrui          = new VRUI(scene)

const pistol = new Pistol()
// Súng sẽ được đặt vị trí thực sau khi vào AR (trong sessionstart)
gunSystem.addGun(pistol, new THREE.Vector3(0, 1.0, -0.5))

// ─── Enemy ────────────────────────────────────────────────────────
const enemySpawner = new EnemySpawner(scene, 20)
const hitDetection = new HitDetection([])

// ─── Game Logic ───────────────────────────────────────────────────
const scoreSystem = new ScoreSystem()
const waveManager = new WaveManager(enemySpawner, scoreSystem)

// ─── UI ───────────────────────────────────────────────────────────
const wristHUD    = new WristHUD(scene, renderer.renderer)
const gamePanel   = new GamePanel(scene)
const comfortMenu = new ComfortMenu(scene, renderer.renderer, locomotion)  // phase 12
const rayPointer  = new RayPointer(renderer.renderer, scene, controllerInput)

// Đăng ký tất cả button targets
rayPointer.addTarget(gamePanel.startButton)
rayPointer.addTarget(gamePanel.restartButton)
for (const btn of comfortMenu.getButtons()) rayPointer.addTarget(btn)

rayPointer.onSelect = (mesh) => {
  const action = mesh.userData.action
  if (action === 'start' || action === 'restart') {
    playerHP = MAX_HP
    wristHUD.setHP(playerHP, MAX_HP)
    waveManager.startGame()
    comfortMenu.close()
  } else {
    // Comfort menu actions
    comfortMenu.handleAction(action)
  }
}

// ─── Player State ─────────────────────────────────────────────────
let playerHP   = 100
const MAX_HP   = 100

// ─── WaveManager Callbacks ────────────────────────────────────────
waveManager.onStateChange = (state) => {
  if (state === GameState.PLAYING) {
    gamePanel.hide()
    rayPointer.setVisible(false)
  } else if (state === GameState.GAME_OVER) {
    rayPointer.setVisible(true)
    gamePanel.showGameOver(scoreSystem.score, scoreSystem.highScore)
  }
}

waveManager.onWaveStart = (waveNum) => {
  wristHUD.setWave(waveNum)
}

waveManager.onWaveEnd = (waveNum, breakSec) => {
  gamePanel.showWaveBreak(waveNum, breakSec, scoreSystem.score)
}

// ─── XR Session ───────────────────────────────────────────────────
await xrSession.init()

// ─── State Flags ──────────────────────────────────────────────────
let referenceSpace = null
let roomFed        = false
let spawnerInited  = false
let reverbSet      = false
let lastTime       = 0
let elapsedTime    = 0

gamePanel.showMenu(scoreSystem.highScore)
rayPointer.setVisible(true)

renderer.renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.renderer.xr.getSession()
  try {
    referenceSpace = await session.requestReferenceSpace('local-floor')
    console.log('[XR] local-floor reference space ready')
  } catch (e) {
    console.error('[XR] local-floor failed:', e)
  }

  depthSensor.checkSupport(session)
  lightEstimator.init(session)

  // Đặt súng trước mặt player sau khi vào AR
  // Chờ 1 frame để referenceSpace sẵn sàng
  setTimeout(() => {
    const cam = renderer.renderer.xr.getCamera()
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const pos = cam.position.clone().addScaledVector(fwd, 0.6)
    pos.y -= 0.3
    pistol.mesh.position.copy(pos)
    console.log('[Gun] Pistol placed at', pos)
  }, 500)
})

// ─── XR Frame Loop ────────────────────────────────────────────────
renderer.renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min((time - lastTime) / 1000, 0.1)
  lastTime = time
  elapsedTime += dt

  if (!frame || !referenceSpace) {
    renderer.render(scene, camera)
    return
  }

  const playerPos = playerRig.getPosition()
  const camFwd    = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)

  // ── Phase 1 ──
  planeDetector.update(frame, referenceSpace, scene)
  meshDetector.update(frame, referenceSpace, scene)

  // ── Phase 2 ──
  controllerInput.update(frame)
  locomotion.update(dt, controllerInput.getThumbstickX('right'))

  for (const evt of controllerInput.getEvents()) {
    if (evt.action === 'shoot') haptic.vibrate(evt.hand, 80, 0.6)
    // Phase 12: mở comfort menu bằng button B/Y (action 'menu')
    if (evt.action === 'menu') comfortMenu.toggle(playerPos, camFwd)
  }

  // ── Phase 3 ──
  handTracking.update(dt)
  gestureDetector.update(dt)

  // Phase 12: glow khi detect gesture
  for (const evt of gestureDetector.getEvents()) {
    glowHands.flash(evt.hand, evt.gesture)
  }
  glowHands.update(dt)

  // ── Phase 4 ──
  if (!roomFed && meshDetector.getRoomGeometries().length > 0) {
    meshDetector.getRoomGeometries().forEach(geo => physics.addStaticMesh(geo))
    roomFed = true
  }
  physics.step(dt)

  // ── Phase 11 — Depth + Light ──
  const viewerPose = frame.getViewerPose(referenceSpace)
  if (viewerPose) {
    depthSensor.update(frame, viewerPose.views[0], referenceSpace)
    lightEstimator.update(frame)
  }

  // ── Spawner init (phase 8/9) ──
  if (!spawnerInited && roomFed && planeDetector.isReady()) {
    enemySpawner.init(planeDetector, physics, audio)
    spawnerInited = true
    if (!reverbSet) {
      audio.estimateRoomSizeAndSetReverb(planeDetector, frame, referenceSpace)
      reverbSet = true
    }
  }

  // ── Phase 5/6/7 — Combat ──
  gunSystem.update(frame, bulletManager)
  bulletManager.update(dt)

  const activeEnemies = enemySpawner.getActiveEnemies()
  hitDetection.setEnemies(activeEnemies)

  const hits = hitDetection.checkBullets(bulletManager.getBullets())
  for (const { bullet, enemy, zone } of hits) {
    enemy.takeDamage(25, zone)
    if (enemy.isDead) waveManager.registerKill(zone)
    audio.playAt('gunshot', bullet.mesh.position, playerPos, camFwd)
    audio.playAt('bodyHit', enemy.mesh.position,  playerPos, camFwd)
    bulletManager.bullets.splice(bulletManager.bullets.indexOf(bullet), 1)
    scene.remove(bullet.mesh)
  }

  const meleeHits = meleeSystem.update(dt, activeEnemies, haptic)
  if (Array.isArray(meleeHits)) {
    for (const { enemy, zone } of meleeHits) {
      if (enemy.isDead) waveManager.registerKill(zone)
      audio.playAt('punchImpact', enemy.mesh.position, playerPos, camFwd)
    }
  }

  // Touch damage từ enemy
  for (const enemy of activeEnemies) {
    if (enemy.pendingTouchDamage) {
      playerHP = Math.max(0, playerHP - enemy.pendingTouchDamage)
      enemy.pendingTouchDamage = 0
      haptic.vibrate('left', 200, 1.0)
      haptic.vibrate('right', 200, 1.0)
      wristHUD.setHP(playerHP, MAX_HP)
    }
  }

  // ── Phase 10 — Wave + HUD ──
  if (spawnerInited) {
    enemySpawner.update(dt, playerPos, frame, referenceSpace)
    waveManager.update(dt, frame, referenceSpace, playerPos, playerHP)

    if (waveManager.state === GameState.WAVE_BREAK) {
      gamePanel.updateBreakTimer(waveManager._breakTimer, waveManager.waveNumber, scoreSystem.score)
    }

    // Phase 11 — occlusion uniforms
    if (depthSensor.ready) {
      for (const enemy of activeEnemies) {
        updateOcclusionUniforms(enemy._sphereMat, depthSensor)
      }
    }
  }

  // Ammo HUD
  const heldGun = gunSystem.getHeldGun?.()
  if (heldGun) wristHUD.setAmmo(heldGun.ammo, heldGun.maxAmmo)

  wristHUD.update()

  // Phase 12 — hologram time update
  gamePanel.updateTime(elapsedTime)

  // GamePanel nổi trước mặt player
  if (gamePanel.mesh.visible) {
    gamePanel.mesh.position.copy(playerPos).addScaledVector(camFwd, 1.2)
    gamePanel.mesh.position.y = playerPos.y + 0.1
    gamePanel.mesh.lookAt(playerPos)
    rayPointer.update()
  }

  // ComfortMenu ray pointer khi đang mở
  if (comfortMenu.isOpen) {
    rayPointer.setVisible(true)
    rayPointer.update()
  }

  renderer.render(scene, camera)
})