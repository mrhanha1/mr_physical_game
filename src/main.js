import * as THREE from 'three'

// ── Core ──────────────────────────────────────────────────────────────────
import { Renderer }        from './core/Renderer.js'
import { XRSession }       from './core/XRSession.js'
import { PhysicsWorld }    from './core/PhysicsWorld.js'
import { DepthSensor }     from './core/DepthSensor.js'

// ── World ─────────────────────────────────────────────────────────────────
import { PlaneDetector }   from './world/PlaneDetector.js'
import { MeshDetector }    from './world/MeshDetector.js'
import { SceneManager }    from './world/SceneManager.js'

// ── Player ────────────────────────────────────────────────────────────────
import { PlayerRig }       from './player/PlayerRig.js'
import { ControllerInput } from './player/ControllerInput.js'
import { HapticManager }   from './player/HapticManager.js'
import { HandTracking }    from './player/HandTracking.js'
import { Locomotion }      from './player/Locomotion.js'

// ── Sphere ────────────────────────────────────────────────────────────────
import { SphereManager }   from './sphere/SphereManager.js'
import { SphereGrabSystem } from './sphere/SphereGrabSystem.js'

// ── Weapons ───────────────────────────────────────────────────────────────
import { Pistol }          from './weapons/Pistol.js'
import { Rifle }           from './weapons/Rifle.js'

// ── Audio ─────────────────────────────────────────────────────────────────
import { AudioManager }    from './audio/AudioManager.js'

// ── UI ────────────────────────────────────────────────────────────────────
import { WristHUD }        from './ui/WristHUD.js'
import { RayPointer }      from './ui/RayPointer.js'
import { GamePanel }       from './ui/GamePanel.js'

// ═════════════════════════════════════════════════════════════════════════
// KHỞI TẠO
// ═════════════════════════════════════════════════════════════════════════
const _logDiv = document.createElement('div')
_logDiv.style.cssText = 'position:fixed;top:0;left:0;background:rgba(0,0,0,0.8);color:#0f0;font:14px monospace;padding:8px;z-index:9999;max-width:100vw;max-height:40vh;overflow:auto;pointer-events:none'
document.body.appendChild(_logDiv)
window.onerror = (msg, src, line) => {
  _logDiv.innerHTML += `<div style="color:#f44">ERR L${line}: ${msg}</div>`
}
console.error = (...a) => { _logDiv.innerHTML += `<div style="color:#f44">ERR: ${a.join(' ')}</div>` }
console.warn  = (...a) => { _logDiv.innerHTML += `<div style="color:#fa0">WARN: ${a.join(' ')}</div>` }
// ── Core ──
const renderer  = new Renderer()
const xrSession = new XRSession(renderer)
const scene     = new THREE.Scene()
const camera    = new THREE.PerspectiveCamera()

// Ánh sáng cơ bản
const dirLight     = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(1, 2, 1)
scene.add(dirLight)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

// ── Depth + Light ──
const depthSensor    = new DepthSensor()

// ── World ──
const sceneManager  = new SceneManager(scene)
const planeDetector = new PlaneDetector()
const meshDetector  = new MeshDetector()

// ── Player ──
const playerRig       = new PlayerRig(renderer.renderer, scene)
const controllerInput = new ControllerInput(renderer.renderer)
const locomotion      = new Locomotion(camera)
const haptic          = new HapticManager(renderer.renderer)
const handTracking    = new HandTracking(renderer.renderer, scene)

// ── Physics ──
const physics = new PhysicsWorld()
await physics.init()

// ── Audio ──
const audio = new AudioManager()
await audio.loadAll()

// ── Sphere system ──
const sphereManager  = new SphereManager(scene, physics)
const grabSystem     = new SphereGrabSystem(
  renderer.renderer, sphereManager, controllerInput, haptic, audio
)

// ── Weapons ──
const weaponOpts = { renderer: renderer.renderer, scene, sphereManager, haptic, audio }
const pistol     = new Pistol(weaponOpts)
const rifle      = new Rifle(weaponOpts)

// ── UI ──
const wristHUD    = new WristHUD(scene, renderer.renderer)
const gamePanel   = new GamePanel(scene)
const rayPointer  = new RayPointer(renderer.renderer, scene, controllerInput)

// Đăng ký button targets cho ray pointer
rayPointer.addTarget(gamePanel.startButton)
rayPointer.addTarget(gamePanel.restartButton)

rayPointer.onSelect = (mesh) => {
  const action = mesh.userData.action
  if (action === 'start' || action === 'restart') {
    // Spawn một batch sphere ban đầu
    _spawnInitialSpheres()
    gamePanel.hide()
    rayPointer.setVisible(false)
  }
}

// ── Khởi động XR ──
await xrSession.init()

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

let referenceSpace  = null
let roomFed         = false
let lastTime        = 0
let elapsedTime     = 0
let gameStarted     = false

// Spawn mỗi N giây nếu scene ít sphere
const SPAWN_INTERVAL  = 4.0   // giây
const SPAWN_MIN_COUNT = 5     // spawn khi dưới ngưỡng này
let   spawnTimer      = 0

// Vị trí spawn trước mặt player (fallback khi không có plane)
function _spawnInFrontOfPlayer(count = 1) {
  const cam    = renderer.renderer.xr.getCamera()
  const fwd    = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
  fwd.y = 0; fwd.normalize()
  const base   = cam.position.clone().addScaledVector(fwd, 0.6)
  base.y = cam.position.y - 0.3   // hơi thấp hơn tầm mắt

  for (let i = 0; i < count; i++) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      Math.random() * 0.3,
      (Math.random() - 0.5) * 0.4,
    )
    sphereManager.spawnSphere(base.clone().add(offset), 'RANDOM')
  }
}

function _spawnInitialSpheres() {
  if (planeDetector.isReady()) {
    // Spawn trên sàn/bàn
    for (let i = 0; i < 6; i++) {
      const pos = planeDetector.getRandomPointOnFloor(
        renderer.renderer.xr.getFrame?.() ?? null, referenceSpace
      )
      if (pos) {
        pos.y += 0.15  // hơi lơ lửng để rơi xuống
        sphereManager.spawnSphere(pos, 'RANDOM')
      } else {
        _spawnInFrontOfPlayer(1)
      }
    }
  } else {
    _spawnInFrontOfPlayer(6)
  }
  gameStarted = true
}

// ── Show UI trước khi vào AR ──
gamePanel.showMenu(0)
rayPointer.setVisible(false)

// ─── XR Session Start ─────────────────────────────────────────────────────
renderer.renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.renderer.xr.getSession()

  try {
    referenceSpace = await session.requestReferenceSpace('local-floor')
    console.log('[XR] local-floor reference space ready')
  } catch (e) {
    console.error('[XR] local-floor failed:', e)
  }

  depthSensor.checkSupport(session)

  // Hiển thị panel + ray pointer
  gamePanel.showMenu(0)
  rayPointer.setVisible(true)
})

// ═════════════════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═════════════════════════════════════════════════════════════════════════

renderer.renderer.setAnimationLoop((time, frame) => {
  const dt    = Math.min((time - lastTime) / 1000, 0.1)
  lastTime    = time
  elapsedTime += dt

  if (!frame || !referenceSpace) {
    renderer.render(scene, camera)
    return
  }

  const playerPos = playerRig.getPosition()
  const camFwd    = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)

  // ── Room detection ──
  planeDetector.update(frame, referenceSpace, scene)
  meshDetector.update(frame, referenceSpace, scene)

  // Feed room mesh vào physics (chỉ 1 lần)
  if (!roomFed && meshDetector.getRoomGeometries().length > 0) {
    meshDetector.getRoomGeometries().forEach(geo => physics.addStaticMesh(geo))
    roomFed = true
    console.log('[Physics] Room mesh fed')
  }
  // ── Input ──
  controllerInput.update(frame)
  for (const evt of controllerInput.getEvents()) {
    if (evt.action === 'start_game' && !gameStarted) {
      _spawnInitialSpheres()   // đã set gameStarted = true bên trong
      gamePanel.hide()
      rayPointer.setVisible(false)
    }
  }

  locomotion.update(dt, controllerInput.getThumbstickX('right'))

  // ── Depth + Light ──
  const viewerPose = frame.getViewerPose(referenceSpace)
  if (viewerPose) {
    depthSensor.update(frame, viewerPose.views[0], referenceSpace)
  }

  // ── Hand tracking ──
  handTracking.update(dt)

  // ── Physics ──
  physics.step(dt)

  // ── Sphere system ──
  sphereManager.update()
  grabSystem.update(dt, frame)

  // ── Weapons ──
  pistol.update(frame, dt, grabSystem)
  rifle.update(frame, dt, grabSystem)

  // ── Auto-spawn spheres khi game đã bắt đầu ──
  if (gameStarted) {
    spawnTimer += dt
    if (spawnTimer >= SPAWN_INTERVAL && sphereManager.count < SPAWN_MIN_COUNT) {
      spawnTimer = 0
      _spawnInFrontOfPlayer(2)
    }
  }

  // ── WristHUD update ──
  const leftHeld  = grabSystem.getHeldByHand('left')
  const rightHeld = grabSystem.getHeldByHand('right')

  wristHUD.setLeftHeld(leftHeld)

  // Xác định súng nào đang được cầm + update gun state
  // Pistol = right hand, Rifle = cả 2 tay
  const activePistol = pistol._isHeld ? pistol : null
  const activeRifle  = rifle._isHeld  ? rifle  : null
  const activeWeapon = activeRifle ?? activePistol

  if (activeWeapon) {
    const name = activeWeapon === activeRifle ? 'Rifle' : 'Pistol'
    wristHUD.setGunState(name, activeWeapon._chambered)
  } else {
    wristHUD.setGunState(null, null)
  }

  wristHUD.setTotalSpheres(sphereManager.count)
  wristHUD.update()

  const showRay = gamePanel.mesh.visible
  if (showRay) {
    if (gamePanel.mesh.visible) {
      gamePanel.mesh.position.copy(playerPos).addScaledVector(camFwd, 1.2)
      gamePanel.mesh.position.y = playerPos.y + 0.1
      gamePanel.mesh.lookAt(playerPos)
    }
    rayPointer.update()
  }

  // ── Occlusion uniforms cho depth sensor ──
  // (Cập nhật cho sphere meshes nếu cần)

  // Hologram time
  gamePanel.updateTime(elapsedTime)

  renderer.render(scene, camera)
})