import * as THREE from 'three'

import { Renderer }        from './core/Renderer.js'
import { XRSession }       from './core/XRSession.js'
import { PhysicsWorld }    from './core/PhysicsWorld.js'
import { DepthSensor }     from './core/DepthSensor.js'
import { GameMode, MODE }  from './core/GameMode.js'

import { PlaneDetector }    from './world/PlaneDetector.js'
import { MeshDetector }     from './world/MeshDetector.js'
import { SceneManager }     from './world/SceneManager.js'
import { FlatWorldBuilder } from './world/FlatWorldBuilder.js'

import { PlayerRig }       from './player/PlayerRig.js'
import { ControllerInput } from './player/ControllerInput.js'
import { HapticManager }   from './player/HapticManager.js'
import { HandTracking }    from './player/HandTracking.js'
import { Locomotion }      from './player/Locomotion.js'

import { SphereManager }    from './sphere/SphereManager.js'
import { SphereGrabSystem } from './sphere/SphereGrabSystem.js'

import { Pistol } from './weapons/Pistol.js'
import { Rifle }  from './weapons/Rifle.js'

import { AudioManager } from './audio/AudioManager.js'

import { WristHUD }   from './ui/WristHUD.js'
import { RayPointer } from './ui/RayPointer.js'
import { GamePanel }  from './ui/GamePanel.js'

// ── Debug log ─────────────────────────────────────────────────────────────
const _logDiv = document.createElement('div')
_logDiv.style.cssText = 'position:fixed;top:0;left:0;background:rgba(0,0,0,0.8);color:#0f0;font:14px monospace;padding:8px;z-index:9999;max-width:100vw;max-height:40vh;overflow:auto;pointer-events:none'
document.body.appendChild(_logDiv)
window.onerror   = (msg, src, line) => { _logDiv.innerHTML += `<div style="color:#f44">ERR L${line}: ${msg}</div>` }
console.error = (...a) => { _logDiv.innerHTML += `<div style="color:#f44">ERR: ${a.join(' ')}</div>` }
console.warn  = (...a) => { _logDiv.innerHTML += `<div style="color:#fa0">WARN: ${a.join(' ')}</div>` }

// ── Hệ thống chung ────────────────────────────────────────────────────────
const renderer      = new Renderer()
const scene         = new THREE.Scene()
const camera        = new THREE.PerspectiveCamera()

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(1, 2, 1)
scene.add(dirLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.6))

const physics = new PhysicsWorld()
await physics.init()

const audio = new AudioManager()
await audio.loadAll()

const sceneManager    = new SceneManager(scene)
const sphereManager   = new SphereManager(scene, physics)
const controllerInput = new ControllerInput(renderer.renderer)
const haptic          = new HapticManager(renderer.renderer)
const handTracking    = new HandTracking(renderer.renderer, scene)
const playerRig       = new PlayerRig(renderer.renderer, scene)
const locomotion      = new Locomotion(renderer.renderer)
const grabSystem      = new SphereGrabSystem(renderer.renderer, sphereManager, controllerInput, haptic, audio)

const weaponOpts = { renderer: renderer.renderer, scene, sphereManager, haptic, audio }
const pistol     = new Pistol(weaponOpts)
const rifle      = new Rifle(weaponOpts)

const wristHUD   = new WristHUD(scene, renderer.renderer)
const gamePanel  = new GamePanel(scene)
const rayPointer = new RayPointer(renderer.renderer, scene, controllerInput)

rayPointer.addTarget(gamePanel.startButton)
rayPointer.addTarget(gamePanel.restartButton)
rayPointer.onSelect = (mesh) => {
  if (mesh.userData.action === 'start' || mesh.userData.action === 'restart') {
    _spawnInitialSpheres()
    gamePanel.hide()
    rayPointer.setVisible(false)
  }
}

// ── XRSession (cả 2 mode đều dùng XR trên Quest) ─────────────────────────
// Không gọi init() ở đây vì GameMode chưa được set.
// xrSession.init() sẽ được gọi trong button handler SAU KHI GameMode.set().
const xrSession = new XRSession(renderer)

// ── State ─────────────────────────────────────────────────────────────────
let referenceSpace = null
let roomFed        = false
let lastTime       = 0
let elapsedTime    = 0
let gameStarted    = false
let spawnTimer     = 0

const SPAWN_INTERVAL  = 4.0
const SPAWN_MIN_COUNT = 5

// ── AR mode: world hệ thống ───────────────────────────────────────────────
let depthSensor   = null
let planeDetector = null
let meshDetector  = null

// ── Flat mode: world tĩnh ─────────────────────────────────────────────────
let flatWorld = null

// ═════════════════════════════════════════════════════════════════════════
// MODE SELECT (DOM overlay, trước khi vào XR)
// ═════════════════════════════════════════════════════════════════════════
function _buildModeSelectDOM() {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000c18;z-index:100;gap:20px;font-family:monospace;color:#00ffcc'
  overlay.innerHTML = `
    <div style="font-size:48px;font-weight:bold;letter-spacing:4px">MR COMBAT</div>
    <div style="font-size:18px;color:#aaa;margin-bottom:12px">Chọn chế độ chơi</div>
    <button id="btn-ar"   style="padding:16px 48px;font-size:20px;font-family:monospace;cursor:pointer;background:#0077cc;color:#fff;border:none;border-radius:10px">🥽  AR / Mixed Reality</button>
    <button id="btn-flat" style="padding:16px 48px;font-size:20px;font-family:monospace;cursor:pointer;background:#334;color:#ccc;border:1px solid #556;border-radius:10px">🏠  Flat (Joystick move)</button>
  `
  document.body.appendChild(overlay)

  document.getElementById('btn-ar').addEventListener('click', async () => {
    GameMode.set(MODE.AR)
    overlay.remove()
    await xrSession.init()
  })

  document.getElementById('btn-flat').addEventListener('click', async () => {
    GameMode.set(MODE.FLATSCREEN)
    overlay.remove()
    flatWorld = new FlatWorldBuilder(scene)
    flatWorld.build()
    physics.addFlatRoom()
    await xrSession.init() 
  })
}

// ═════════════════════════════════════════════════════════════════════════
// XR SESSION START
// ═════════════════════════════════════════════════════════════════════════
renderer.renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.renderer.xr.getSession()

  try {
    referenceSpace = await session.requestReferenceSpace('local-floor')
    console.log('[XR] local-floor ready')
  } catch (e) {
    console.error('[XR] local-floor failed:', e)
  }

  // Truyền base reference space cho Locomotion (để dùng getOffsetReferenceSpace)
  locomotion.setBaseReferenceSpace(referenceSpace)

  if (GameMode.isAR()) {
    depthSensor   = new DepthSensor()
    planeDetector = new PlaneDetector()
    meshDetector  = new MeshDetector()
    depthSensor.checkSupport(session)
  }

  gamePanel.showMenu(0)
  rayPointer.setVisible(true)
})

// ═════════════════════════════════════════════════════════════════════════
// SPAWN
// ═════════════════════════════════════════════════════════════════════════
function _spawnInFrontOfPlayer(count = 1) {
  // Dùng XR camera thực (không phải PerspectiveCamera mặc định có quaternion = identity)
  const xrCam = renderer.renderer.xr.getCamera()
  const eye   = xrCam.cameras?.[0] ?? xrCam
  const pos   = playerRig.getPosition()
  const fwd   = new THREE.Vector3(0, 0, -1).applyQuaternion(eye.quaternion)
  fwd.y = 0
  if (fwd.lengthSq() > 1e-6) fwd.normalize(); else fwd.set(0, 0, -1)

  const base = pos.clone().addScaledVector(fwd, 0.8)
  // Đảm bảo spawn trên sàn (tối thiểu 0.3m so với gốc world)
  base.y = Math.max(pos.y - 0.1, 0.3)

  for (let i = 0; i < count; i++) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      Math.random() * 0.2,
      (Math.random() - 0.5) * 0.4,
    )
    sphereManager.spawnSphere(base.clone().add(offset), 'RANDOM')
  }
}

function _spawnInitialSpheres() {
  if (GameMode.isAR() && planeDetector?.isReady()) {
    for (let i = 0; i < 6; i++) {
      const pos = planeDetector.getRandomPointOnFloor(
        renderer.renderer.xr.getFrame?.() ?? null, referenceSpace
      )
      if (pos) { pos.y += 0.15; sphereManager.spawnSphere(pos, 'RANDOM') }
      else _spawnInFrontOfPlayer(1)
    }
  } else {
    _spawnInFrontOfPlayer(6)
  }
  gameStarted = true
}

// ═════════════════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═════════════════════════════════════════════════════════════════════════
renderer.renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min((time - lastTime) / 1000, 0.1)
  lastTime  = time
  elapsedTime += dt

  if (!frame || !referenceSpace) {
    renderer.render(scene, camera)
    return
  }

  const playerPos = playerRig.getPosition()
  // Dùng XR camera để có forward direction đúng trong XR session
  const _xrCam = renderer.renderer.xr.getCamera()
  const _xrEye = _xrCam.cameras?.[0] ?? _xrCam
  const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(_xrEye.quaternion)

  // ── Input ──
  controllerInput.update(frame)
  for (const evt of controllerInput.getEvents()) {
    if (evt.action === 'start_game' && !gameStarted) {
      _spawnInitialSpheres()
      gamePanel.hide()
      rayPointer.setVisible(false)
    }
  }

  // ── Locomotion ──
  // AR: snap turn phải | Flat: smooth move trái
  // locomotion.update() trả về reference space mới nếu có dịch chuyển/xoay.
  // Phải cập nhật referenceSpace để tất cả frame queries sau dùng đúng giao điểm.
  const newRefSpace = locomotion.update(
    dt,
    controllerInput.getThumbstickX('right'),
    controllerInput.getThumbstickX('left'),
    controllerInput.getThumbstickY('left'),
  )
  if (newRefSpace) referenceSpace = newRefSpace

  // ── AR only: room detection ──
  if (GameMode.isAR()) {
    planeDetector.update(frame, referenceSpace, scene)
    meshDetector.update(frame, referenceSpace, scene)

    if (!roomFed && meshDetector.getRoomGeometries().length > 0) {
      meshDetector.getRoomGeometries().forEach(geo => physics.addStaticMesh(geo))
      roomFed = true
      console.log('[Physics] Room mesh fed')
    }

    const viewerPose = frame.getViewerPose(referenceSpace)
    if (viewerPose) depthSensor.update(frame, viewerPose.views[0], referenceSpace)
  }

  // ── Physics ──
  physics.step(dt)

  // ── Hand + Sphere + Weapon ──
  handTracking.update(dt)
  sphereManager.update()
  grabSystem.update(dt, frame)
  pistol.update(frame, dt, grabSystem)
  rifle.update(frame, dt, grabSystem)

  // ── Auto-spawn ──
  if (gameStarted) {
    spawnTimer += dt
    if (spawnTimer >= SPAWN_INTERVAL && sphereManager.count < SPAWN_MIN_COUNT) {
      spawnTimer = 0
      _spawnInFrontOfPlayer(2)
    }
  }

  // ── WristHUD ──
  const activePistol = pistol._isHeld ? pistol : null
  const activeRifle  = rifle._isHeld  ? rifle  : null
  const activeWeapon = activeRifle ?? activePistol
  wristHUD.setLeftHeld(grabSystem.getHeldByHand('left'))
  if (activeWeapon) {
    wristHUD.setGunState(activeWeapon === activeRifle ? 'Rifle' : 'Pistol', activeWeapon._chambered)
  } else {
    wristHUD.setGunState(null, null)
  }
  wristHUD.setTotalSpheres(sphereManager.count)
  wristHUD.update()

  // ── GamePanel + RayPointer ──
  if (gamePanel.mesh.visible) {
    gamePanel.mesh.position.copy(playerPos).addScaledVector(camFwd, 1.2)
    gamePanel.mesh.position.y = playerPos.y + 0.1
    gamePanel.mesh.lookAt(playerPos)
    rayPointer.update()
  }

  gamePanel.updateTime(elapsedTime)
  renderer.render(scene, camera)
})

// ── Entry point ───────────────────────────────────────────────────────────
_buildModeSelectDOM()