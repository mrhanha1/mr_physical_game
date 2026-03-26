import * as THREE from 'three'

// ─── Sphere Type Definitions ───────────────────────────────────────────────
// Mỗi type định nghĩa material properties; có thể thêm tùy ý sau.
// radius: bán kính sphere (m)
// restitution: độ nảy Rapier (0-1)
// friction: ma sát Rapier (0-1)
// mass: khối lượng (kg) ảnh hưởng đến cách Rapier tính động năng

export const SPHERE_TYPES = {
  RED: {
    name: 'Red',
    color: 0xff2222,
    emissive: 0x330000,
    metalness: 0.2,
    roughness: 0.5,
    radius: 0.05,
    restitution: 0.6,
    friction: 0.5,
    mass: 0.2,
  },
  BLUE: {
    name: 'Blue',
    color: 0x2255ff,
    emissive: 0x000033,
    metalness: 0.4,
    roughness: 0.3,
    radius: 0.05,
    restitution: 0.5,
    friction: 0.4,
    mass: 0.2,
  },
  GOLD: {
    name: 'Gold',
    color: 0xffcc00,
    emissive: 0x221100,
    metalness: 0.9,
    roughness: 0.1,
    radius: 0.05,
    restitution: 0.4,
    friction: 0.3,
    mass: 0.35,    // nặng hơn
  },
  GREEN: {
    name: 'Green',
    color: 0x22dd55,
    emissive: 0x001100,
    metalness: 0.1,
    roughness: 0.7,
    radius: 0.05,
    restitution: 0.7,  // nảy nhiều nhất
    friction: 0.6,
    mass: 0.15,
  },
  PURPLE: {
    name: 'Purple',
    color: 0xaa22ff,
    emissive: 0x110022,
    metalness: 0.6,
    roughness: 0.2,
    radius: 0.06,  // to hơn
    restitution: 0.5,
    friction: 0.4,
    mass: 0.3,
  },
  GLASS: {
    name: 'Glass',
    color: 0xaaddff,
    emissive: 0x000000,
    metalness: 0.0,
    roughness: 0.0,
    transparent: true,
    opacity: 0.55,
    radius: 0.055,
    restitution: 0.35,  // ít nảy (dễ vỡ cảm giác)
    friction: 0.2,
    mass: 0.1,
  },
}

// Mảng để random nhanh
export const SPHERE_TYPE_KEYS = Object.keys(SPHERE_TYPES)

// Tạo THREE.MeshStandardMaterial từ type definition
export function createSphereMaterial(typeDef) {
  return new THREE.MeshStandardMaterial({
    color: typeDef.color,
    emissive: typeDef.emissive ?? 0x000000,
    metalness: typeDef.metalness,
    roughness: typeDef.roughness,
    transparent: typeDef.transparent ?? false,
    opacity: typeDef.opacity ?? 1.0,
  })
}

// Lấy random type
export function randomSphereType() {
  const key = SPHERE_TYPE_KEYS[Math.floor(Math.random() * SPHERE_TYPE_KEYS.length)]
  return { key, def: SPHERE_TYPES[key] }
}
