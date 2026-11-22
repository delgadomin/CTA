import * as THREE from 'three';
import type { BuiltTerrainChunk } from './types';

const BORDER_LIFT_METERS = 0.15;

export function buildChunkBorderGeometry(chunk: BuiltTerrainChunk): THREE.BufferGeometry {
  const { samples, stepMeters, bounds, heights } = chunk;
  const segmentsPerEdge = samples - 1;
  const positions = new Float32Array(4 * segmentsPerEdge * 2 * 3);
  let offset = 0;

  const writeVertex = (x: number, z: number, sampleIndex: number): void => {
    positions[offset] = x;
    positions[offset + 1] = (heights[sampleIndex] ?? chunk.minimumHeight) + BORDER_LIFT_METERS;
    positions[offset + 2] = z;
    offset += 3;
  };

  for (let index = 0; index < segmentsPerEdge; index += 1) {
    const next = index + 1;
    const west = bounds.minX;
    const east = bounds.maxX;
    const south = bounds.minZ;
    const north = bounds.maxZ;
    writeVertex(west + index * stepMeters, south, index);
    writeVertex(west + next * stepMeters, south, next);
    writeVertex(west + index * stepMeters, north, (samples - 1) * samples + index);
    writeVertex(west + next * stepMeters, north, (samples - 1) * samples + next);
    writeVertex(west, south + index * stepMeters, index * samples);
    writeVertex(west, south + next * stepMeters, next * samples);
    writeVertex(east, south + index * stepMeters, index * samples + samples - 1);
    writeVertex(east, south + next * stepMeters, next * samples + samples - 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
