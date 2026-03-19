export class AnchorManager {
  constructor() {
    this.anchors = new Map()  // anchor → Three.js object
  }

  async createAnchor(frame, pose, object) {
    if (!frame.createAnchor) return null
    
    try {
      const anchor = await frame.createAnchor(pose, referenceSpace)
      this.anchors.set(anchor, object)
      return anchor
    } catch (e) {
      console.warn('Anchor creation failed:', e)
      return null
    }
  }

  update(frame) {
    for (const [anchor, object] of this.anchors) {
      const pose = frame.getPose(anchor.anchorSpace, referenceSpace)
      if (!pose) continue
      const t = pose.transform
      object.position.set(t.position.x, t.position.y, t.position.z)
      object.quaternion.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w)
    }
  }

  deleteAnchor(anchor) {
    anchor.delete()
    this.anchors.delete(anchor)
  }
}