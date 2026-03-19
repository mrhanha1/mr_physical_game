import * as THREE from 'three'

const PICKUP_DISTANCE = 0.15  // mét

export class GunSystem {
  constructor(scene, physics, controllerInput, renderer) {
    this.scene = scene
    this.physics = physics
    this.controllerInput = controllerInput
    this.renderer = renderer

    this.guns = []       // danh sách súng trong scene
    this.heldGuns = {}   // { left: gun | null, right: gun | null }
  }

  addGun(gun, position) {
    gun.mesh.visible = true
    gun.mesh.position.copy(position)
    this.scene.add(gun.mesh)
    this.guns.push(gun)
  }

  update(frame, bulletManager) {
    const session = this.renderer.xr.getSession()
    if (!session) return

    for (const source of session.inputSources) {
      const h = source.handedness
      const gp = source.gamepad
      if (!gp) continue

      const ctrl = this.renderer.xr.getController(h === 'left' ? 0 : 1)
      const ctrlPos = new THREE.Vector3()
      ctrl.getWorldPosition(ctrlPos)

      // Pickup: grip xuống, tay gần súng
      const grip = gp.buttons[1]?.value ?? 0
      if (grip > 0.7 && !this.heldGuns[h]) {
        for (const gun of this.guns) {
          if (!gun.isHeld && ctrlPos.distanceTo(gun.mesh.position) < PICKUP_DISTANCE) {
            gun.isHeld = true
            gun.hand = h
            this.heldGuns[h] = gun
            ctrl.add(gun.mesh)
            gun.mesh.position.set(0, -0.05, -0.05)
            gun.mesh.rotation.set(0, 0, 0)
            console.log(`[Gun] Picked up with ${h} hand`)
            break
          }
        }
      }

      // Drop: grip nhả
      if (grip < 0.3 && this.heldGuns[h]) {
        const gun = this.heldGuns[h]
        const worldPos = new THREE.Vector3()
        gun.mesh.getWorldPosition(worldPos)
        ctrl.remove(gun.mesh)
        this.scene.add(gun.mesh)
        gun.mesh.position.copy(worldPos)
        gun.isHeld = false
        gun.hand = null
        this.heldGuns[h] = null
        console.log(`[Gun] Dropped`)
      }

      // Shoot: trigger, đang cầm súng, còn đạn
      const trigger = gp.buttons[0]?.value ?? 0
      const gun = this.heldGuns[h]
      if (trigger > 0.7 && gun && gun._triggerReady !== false) {
        gun._triggerReady = false
        if (gun.ammo > 0) {
          gun.ammo--
          bulletManager.spawn(
            gun.getMuzzleWorldPosition(),
            gun.getMuzzleWorldDirection()
          )
          console.log(`[Gun] Shot! Ammo: ${gun.ammo}/${gun.maxAmmo}`)
        } else {
          console.log('[Gun] Empty!')
        }
      }
      if (trigger < 0.3) gun && (gun._triggerReady = true)

      // Reload: button A/X
      if (gp.buttons[4]?.pressed && gun) {
        gun.ammo = gun.maxAmmo
        console.log('[Gun] Reloaded')
      }
    }
  }
}