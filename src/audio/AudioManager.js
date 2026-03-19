import { Howl, Howler } from 'howler'
import { SoundBank } from './SoundBank.js'

export class AudioManager {
  constructor() {
    this._sounds = new Map()   // name → Howl instance
    this._loaded = false

    // Howler global settings
    Howler.usingWebAudio = true
    // HRTF spatial audio
    if (Howler.ctx) {
      Howler.ctx.resume()
    }
  }

  // Preload tất cả sound trong SoundBank
  async loadAll() {
    const promises = Object.entries(SoundBank).map(([name, def]) => {
      return new Promise((resolve) => {
        const howl = new Howl({
          src: [def.path],
          volume: def.volume,
          html5: false,         // dùng Web Audio để có spatial
          onload: () => {
            console.log(`[Audio] Loaded: ${name}`)
            resolve()
          },
          onloaderror: (id, err) => {
            console.warn(`[Audio] Failed to load ${name}:`, err)
            resolve()  // không block game nếu thiếu file
          },
        })
        this._sounds.set(name, { howl, def })
      })
    })

    await Promise.all(promises)
    this._loaded = true
    console.log('[Audio] All sounds loaded')
  }

  // Phát sound non-spatial (UI, footstep...)
  play(name) {
    const entry = this._sounds.get(name)
    if (!entry) return

    const { howl, def } = entry
    const id = howl.play()
    // Random pitch
    if (def.rate[0] !== def.rate[1]) {
      const rate = def.rate[0] + Math.random() * (def.rate[1] - def.rate[0])
      howl.rate(rate, id)
    }
    return id
  }

  // Phát sound spatial tại vị trí 3D trong không gian
  // pos: THREE.Vector3 — world position của nguồn âm
  // listenerPos: THREE.Vector3 — vị trí đầu người chơi
  // listenerForward: THREE.Vector3 — hướng nhìn (normalized)
  playAt(name, pos, listenerPos, listenerForward) {
    const entry = this._sounds.get(name)
    if (!entry) return

    const { howl, def } = entry

    if (!def.spatial) {
      return this.play(name)
    }

    // Cập nhật listener position cho Howler
    Howler.pos(listenerPos.x, listenerPos.y, listenerPos.z)
    Howler.orientation(
      listenerForward.x, listenerForward.y, listenerForward.z,
      0, 1, 0  // up vector
    )

    const id = howl.play()

    // Set vị trí 3D của âm thanh
    howl.pos(pos.x, pos.y, pos.z, id)
    howl.pannerAttr({
      panningModel: 'HRTF',
      rolloffFactor: 1.5,
      refDistance: 1.0,
      maxDistance: 20.0,
      distanceModel: 'inverse',
    }, id)

    // Random pitch
    if (def.rate[0] !== def.rate[1]) {
      const rate = def.rate[0] + Math.random() * (def.rate[1] - def.rate[0])
      howl.rate(rate, id)
    }

    return id
  }

  // Ước tính reverb từ kích thước phòng (diện tích sàn m²)
  // Gọi 1 lần sau khi PlaneDetector sẵn sàng
  setRoomReverb(floorAreaSqM) {
    if (!Howler.ctx) return

    // Tạo ConvolverNode đơn giản từ impulse response tổng hợp
    const ctx = Howler.ctx
    const duration = Math.min(0.5 + floorAreaSqM * 0.02, 2.5)  // 0.5s–2.5s
    const decay = Math.max(0.1, 1 - floorAreaSqM * 0.01)

    const sampleRate = ctx.sampleRate
    const length = Math.floor(sampleRate * duration)
    const impulse = ctx.createBuffer(2, length, sampleRate)

    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay * 10)
      }
    }

    if (this._convolver) {
      this._convolver.disconnect()
    }

    this._convolver = ctx.createConvolver()
    this._convolver.buffer = impulse

    // Wet/dry mix
    const dry = ctx.createGain()
    const wet = ctx.createGain()
    dry.gain.value = 0.8
    wet.gain.value = Math.min(0.3, floorAreaSqM * 0.01)

    Howler.masterGain.connect(dry)
    Howler.masterGain.connect(this._convolver)
    this._convolver.connect(wet)
    dry.connect(ctx.destination)
    wet.connect(ctx.destination)

    console.log(`[Audio] Reverb set: duration=${duration.toFixed(2)}s, area=${floorAreaSqM}m²`)
  }

  // Tính diện tích sàn từ polygon của PlaneDetector
  // Gọi sau khi planeDetector.isReady()
  estimateRoomSizeAndSetReverb(planeDetector, frame, referenceSpace) {
    if (!planeDetector.floors.length) return

    let totalArea = 0
    for (const floor of planeDetector.floors) {
      const pose = frame.getPose(floor.planeSpace, referenceSpace)
      if (!pose) continue
      totalArea += this._polygonArea(floor.polygon)
    }

    if (totalArea > 0) {
      this.setRoomReverb(totalArea)
    }
  }

  _polygonArea(polygon) {
    // Shoelace formula trên XZ plane
    let area = 0
    const n = polygon.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += polygon[i].x * polygon[j].z
      area -= polygon[j].x * polygon[i].z
    }
    return Math.abs(area) / 2
  }
}