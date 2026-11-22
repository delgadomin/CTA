import { GROUND_COLORS, classifyGround, type GroundMaterial } from './materials';
import type { BuiltTerrainChunk, ChunkFeature, RawTerrainChunk, TerrainLodData } from './types';

const LOD_STEPS = [1, 2, 4] as const;
const SKIRT_DEPTH_METERS = 4;

function pointInsidePolygon(x: number, z: number, points: ChunkFeature['points']): boolean {
  if (!points || points.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const current = points[index];
    const prior = points[previous];
    if (!current || !prior) continue;
    const crosses = (current[1] > z) !== (prior[1] > z)
      && x < ((prior[0] - current[0]) * (z - current[1])) / (prior[1] - current[1] || Number.EPSILON) + current[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function materialAt(x: number, z: number, surfaces: readonly ChunkFeature[]): GroundMaterial {
  for (const surface of surfaces) {
    if (pointInsidePolygon(x, z, surface.points)) return classifyGround(surface.kind, surface.value, surface.surface);
  }
  return 'grass';
}

function perimeter(size: number): number[] {
  const result: number[] = [];
  for (let column = 0; column < size; column += 1) result.push(column);
  for (let row = 1; row < size; row += 1) result.push(row * size + size - 1);
  for (let column = size - 2; column >= 0; column -= 1) result.push((size - 1) * size + column);
  for (let row = size - 2; row > 0; row -= 1) result.push(row * size);
  return result;
}

function buildLod(chunk: RawTerrainChunk, heights: Float32Array, surfaces: readonly ChunkFeature[], level: number, sampleStep: number): TerrainLodData {
  const size = (chunk.terrain.samples - 1) / sampleStep + 1;
  if (!Number.isInteger(size) || size < 2) throw new Error(`Terrain sample count is incompatible with LOD ${level}.`);
  const vertexCount = size * size;
  const edge = perimeter(size);
  const positions = new Float32Array((vertexCount + edge.length) * 3);
  const normals = new Float32Array((vertexCount + edge.length) * 3);
  const colors = new Float32Array((vertexCount + edge.length) * 3);
  const indices = new Uint32Array((size - 1) * (size - 1) * 6 + edge.length * 6);
  const spacing = chunk.terrain.stepMeters * sampleStep;

  for (let row = 0; row < size; row += 1) {
    const sourceRow = row * sampleStep;
    const z = chunk.bounds.minZ + sourceRow * chunk.terrain.stepMeters;
    for (let column = 0; column < size; column += 1) {
      const sourceColumn = column * sampleStep;
      const x = chunk.bounds.minX + sourceColumn * chunk.terrain.stepMeters;
      const vertex = row * size + column;
      const height = heights[sourceRow * chunk.terrain.samples + sourceColumn] ?? 0;
      const left = heights[sourceRow * chunk.terrain.samples + Math.max(0, sourceColumn - sampleStep)] ?? height;
      const right = heights[sourceRow * chunk.terrain.samples + Math.min(chunk.terrain.samples - 1, sourceColumn + sampleStep)] ?? height;
      const down = heights[Math.max(0, sourceRow - sampleStep) * chunk.terrain.samples + sourceColumn] ?? height;
      const up = heights[Math.min(chunk.terrain.samples - 1, sourceRow + sampleStep) * chunk.terrain.samples + sourceColumn] ?? height;
      const dx = (right - left) / (spacing * (sourceColumn === 0 || sourceColumn === chunk.terrain.samples - 1 ? 1 : 2));
      const dz = (up - down) / (spacing * (sourceRow === 0 || sourceRow === chunk.terrain.samples - 1 ? 1 : 2));
      const normalLength = Math.hypot(dx, dz, 1);
      positions.set([x - (chunk.bounds.minX + chunk.bounds.maxX) / 2, height, z - (chunk.bounds.minZ + chunk.bounds.maxZ) / 2], vertex * 3);
      normals.set([dx === 0 ? 0 : -dx / normalLength, 1 / normalLength, dz === 0 ? 0 : -dz / normalLength], vertex * 3);
      colors.set(GROUND_COLORS[materialAt(x, z, surfaces)], vertex * 3);
    }
  }

  let indexOffset = 0;
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const southWest = row * size + column;
      const southEast = southWest + 1;
      const northWest = southWest + size;
      const northEast = northWest + 1;
      indices.set([southWest, northWest, southEast, southEast, northWest, northEast], indexOffset);
      indexOffset += 6;
    }
  }

  const skirtBase = vertexCount;
  for (let edgeIndex = 0; edgeIndex < edge.length; edgeIndex += 1) {
    const source = edge[edgeIndex] ?? 0;
    const next = edge[(edgeIndex + 1) % edge.length] ?? source;
    const skirtIndex = skirtBase + edgeIndex;
    const positionOffset = source * 3;
    const lowerOffset = skirtIndex * 3;
    positions.set([positions[positionOffset] ?? 0, (positions[positionOffset + 1] ?? 0) - SKIRT_DEPTH_METERS, positions[positionOffset + 2] ?? 0], lowerOffset);
    normals.set(normals.subarray(positionOffset, positionOffset + 3), lowerOffset);
    colors.set(colors.subarray(positionOffset, positionOffset + 3), lowerOffset);
    const nextSkirt = skirtBase + ((edgeIndex + 1) % edge.length);
    indices.set([source, skirtIndex, next, next, skirtIndex, nextSkirt], indexOffset);
    indexOffset += 6;
  }
  return { level, size, stepMeters: spacing, positions, normals, colors, indices };
}

export function buildTerrainChunk(raw: RawTerrainChunk): BuiltTerrainChunk {
  const expectedHeights = raw.terrain.samples ** 2;
  if (raw.terrain.heights.length !== expectedHeights || raw.terrain.heights.includes(-32768)) {
    throw new Error(`Chunk ${raw.id} has incomplete elevation data.`);
  }
  const heights = Float32Array.from(raw.terrain.heights, (height) => height * raw.terrain.quantizationMeters);
  const surfaces = raw.features.filter((feature) => feature.featureType === 'surface');
  const levels = LOD_STEPS.map((step, index) => buildLod(raw, heights, surfaces, index, step));
  let minimumHeight = Infinity;
  let maximumHeight = -Infinity;
  for (const height of heights) {
    minimumHeight = Math.min(minimumHeight, height);
    maximumHeight = Math.max(maximumHeight, height);
  }
  return { id: raw.id, bounds: raw.bounds, samples: raw.terrain.samples, stepMeters: raw.terrain.stepMeters, heights, minimumHeight, maximumHeight, levels };
}
