import * as THREE from 'three';
import type { RoadSurfaceStyle } from './types';

const ROAD_PALETTES: Record<Exclude<RoadSurfaceStyle, 'marking'>, readonly [number, number, number]> = {
  asphalt: [176, 181, 178],
  stone: [221, 202, 166],
  concrete: [211, 213, 204],
  earth: [183, 147, 109],
};

export function createRoadMaterials(): Map<RoadSurfaceStyle, THREE.MeshStandardMaterial> {
  const materials = new Map<RoadSurfaceStyle, THREE.MeshStandardMaterial>();
  for (const style of ['asphalt', 'stone', 'concrete', 'earth'] as const) {
    const texture = makeRoadTexture(style);
    materials.set(style, new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));
  }
  materials.set('marking', new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  return materials;
}

export function createRoadPropMaterial(kind: string): THREE.MeshStandardMaterial {
  const color = kind === 'traffic_signals' ? '#34443d' : kind === 'street_lamp' ? '#5c5b50' : kind === 'stop' ? '#ab443b' : '#d8d1bb';
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.12 });
}

function makeRoadTexture(style: Exclude<RoadSurfaceStyle, 'marking'>): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create procedural road texture.');
  const [red, green, blue] = ROAD_PALETTES[style];
  context.fillStyle = `rgb(${red} ${green} ${blue})`;
  context.fillRect(0, 0, 128, 128);
  let seed = style.length * 9187 + 41;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  if (style === 'stone') {
    context.strokeStyle = 'rgb(89 77 58 / 28%)';
    context.lineWidth = 2;
    for (let y = 0; y <= 128; y += 32) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(128, y); context.stroke();
    }
    for (let x = 0; x <= 128; x += 32) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 128); context.stroke();
    }
    for (let row = 0; row < 4; row += 1) {
      const offset = row % 2 ? 16 : 0;
      context.beginPath(); context.moveTo(offset, row * 32); context.lineTo(offset, (row + 1) * 32); context.stroke();
      context.beginPath(); context.moveTo(offset + 64, row * 32); context.lineTo(offset + 64, (row + 1) * 32); context.stroke();
    }
  }
  const count = style === 'earth' ? 600 : 420;
  for (let index = 0; index < count; index += 1) {
    const shade = random() > 0.5 ? 1 : -1;
    const alpha = 0.06 + random() * 0.16;
    const gray = shade > 0 ? 255 : 20;
    context.fillStyle = `rgb(${gray} ${gray} ${gray} / ${alpha})`;
    const size = 1 + random() * (style === 'earth' ? 2.8 : 1.6);
    context.fillRect(random() * 128, random() * 128, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
