import * as THREE from 'three'
import { Renderer } from './core/Renderer.js'
import { XRSession } from './core/XRSession.js'
import { PhysicsWorld } from './core/PhysicsWorld.js'
import { PlaneDetector } from './world/PlaneDetector.js'
import { MeshDetector } from './world/MeshDetector.js'
import { SceneManager } from './world/SceneManager.js'
import { PlayerRig } from './player/PlayerRig.js'
import { ControllerInput } from './player/ControllerInput.js'
import { Locomotion } from './player/Locomotion.js'
import { HapticManager } from './player/HapticManager.js'
import { HandTracking } from './player/HandTracking.js'
import { GestureDetector } from './player/GestureDetector.js'

// ─── Core ─────────────────────────────────────────────────────────
const renderer = new Renderer()
const xrSession = new XRSession(renderer)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera()

// Ánh sáng
const dirLight = new THREE.DirectionalLight(0xffffff, 1)
dirLight.position.set(1, 2, 1)
scene.add(dirLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.5))

// ─── World ────────────────────────────────────────────────────────
const sceneManager = new SceneManager(scene)
const planeDetector = new PlaneDetector()
const meshDetector = new MeshDetector()

// ─── Player ───────────────────────────────────────────────────────
const playerRig = new PlayerRig(renderer.renderer, scene)
const controllerInput = new ControllerInput(renderer.renderer)
const locomotion = new Locomotion(camera, [])
const haptic = new HapticManager(renderer.renderer)
const handTracking = new HandTracking(renderer.renderer, scene)
const gestureDetector = new GestureDetector(handTracking)

// ─── Physics ──────────────────────────────────────────────────────
const physics = new PhysicsWorld()
await physics.init()

// ─── XR Session ───────────────────────────────────────────────────
await xrSession.init()

// ─── Test objects ─────────────────────────────────────────────────
// Phase 0: hình lập phương xoay
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.2, 0.2),
  new THREE.MeshStandardMaterial({ color: 0x00ff88 })
)
cube.position.set(0, 1.5, -1)
scene.add(cube)

// Phase 1: hộp xanh đặt trên sàn
const floorBox = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.2, 0.2),
  new THREE.MeshStandardMaterial({ color: 0x0088ff })
)
floorBox.visible = false
scene.add(floorBox)

// ─── State ────────────────────────────────────────────────────────
let referenceSpace = null
let floorFound = false
let roomFed = false
let lastTime = 0

renderer.renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.renderer.xr.getSession()
  referenceSpace = await session.requestReferenceSpace('local-floor')
})

// ─── Vòng lặp duy nhất ────────────────────────────────────────────
renderer.renderer.setAnimationLoop((time, frame) => {
  const dt = Math.min((time - lastTime) / 1000, 0.1)
  lastTime = time

  cube.rotation.y += 0.01

  if (!frame || !referenceSpace) {
    renderer.render(scene, camera)
    return
  }

  // ── Phase 1 ──
  planeDetector.update(frame, referenceSpace, scene)
  meshDetector.update(frame, referenceSpace, scene)

  if (!floorFound && planeDetector.isReady()) {
    const floor = planeDetector.getFirstFloor()
    const pose = frame.getPose(floor.planeSpace, referenceSpace)
    if (pose) {
      floorBox.position.set(
        pose.transform.position.x,
        pose.transform.position.y + 0.1,
        pose.transform.position.z - 0.5
      )
      floorBox.visible = true
      floorFound = true
      console.log('[Phase1] Floor detected, box placed')
    }
  }

  // ── Phase 2 ──
  controllerInput.update(frame)
  const thumbX = controllerInput.getThumbstickX('right')
  locomotion.update(dt, thumbX)

  for (const evt of controllerInput.getEvents()) {
    console.log(`[INPUT] action: ${evt.action}, hand: ${evt.hand}`)

    if (evt.action === 'shoot') {
      haptic.vibrate(evt.hand, 80, 0.6)

      // Phase 4: spawn bóng vật lý khi bắn
      const spawnPos = camera.position.clone().add(new THREE.Vector3(0, -0.2, -0.3))
      const { mesh } = physics.spawnBall(spawnPos)
      scene.add(mesh)
    }
  }

  // ── Phase 3 ──
  handTracking.update(dt)
  gestureDetector.update(dt)

  for (const evt of gestureDetector.getEvents()) {
    console.log(`[GESTURE] ${evt.gesture} - ${evt.hand}`)
  }

  // ── Phase 4 ──
  if (!roomFed && meshDetector.getRoomGeometries().length > 0) {
    meshDetector.getRoomGeometries().forEach(geo => physics.addStaticMesh(geo))
    roomFed = true
    console.log('[Phase4] Room mesh fed to physics')
  }

  physics.step(dt)

  renderer.render(scene, camera)
})
// setTimeout(() => {
//   floorBox.position.set(0, 0.1, -0.5)
//   floorBox.visible = true
//   floorFound = true
//   console.log('[Phase1 MOCK] Box placed')
// }, 2000)