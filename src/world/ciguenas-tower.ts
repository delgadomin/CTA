import { BuildingGeometryWriter, type BuildingColor, type BuildingUv } from './building-geometry';
import { sampleHeight, type RoadPoint, type RoadPoint3 } from './road-geometry';
import type { BuiltTerrainChunk, ChunkFeature, ProjectedBounds } from './types';

const STONE: BuildingColor = [0.83, 0.77, 0.66];
const UV: readonly [BuildingUv, BuildingUv, BuildingUv, BuildingUv] = [[0, 0], [1, 0], [1, 1], [0, 1]];

function framePoint(center: RoadPoint, along: number, across: number, y: number): RoadPoint3 {
  return [center[0] + along, y, center[1] + across];
}

function addStoneBox(writer: BuildingGeometryWriter, center: RoadPoint, baseY: number, width: number, depth: number, height: number): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const bottom = [
    framePoint(center, -halfWidth, -halfDepth, baseY),
    framePoint(center, halfWidth, -halfDepth, baseY),
    framePoint(center, halfWidth, halfDepth, baseY),
    framePoint(center, -halfWidth, halfDepth, baseY),
  ] as const;
  const top = bottom.map((point) => [point[0], point[1] + height, point[2]] as RoadPoint3);
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    const bottomA = bottom[side];
    const bottomB = bottom[next];
    const topA = top[side];
    const topB = top[next];
    if (bottomA && bottomB && topA && topB) writer.addQuad('monument_stone', [bottomA, bottomB, topB, topA], STONE, UV);
  }
  const topPoints = [top[0], top[1], top[2], top[3]];
  if (topPoints.every((point): point is RoadPoint3 => point !== undefined)) {
    writer.addQuad('monument_stone', topPoints as [RoadPoint3, RoadPoint3, RoadPoint3, RoadPoint3], STONE, UV);
  }
}

function addCorbels(writer: BuildingGeometryWriter, center: RoadPoint, baseY: number): void {
  for (const side of [-1, 1]) for (const offset of [-1.9, 0, 1.9]) {
    addStoneBox(writer, [center[0] + offset, center[1] + side * 3], baseY, 0.52, 0.62, 0.65);
    addStoneBox(writer, [center[0] + side * 3, center[1] + offset], baseY, 0.62, 0.52, 0.65);
  }
}

function addMerlons(writer: BuildingGeometryWriter, center: RoadPoint, baseY: number, lod: number): void {
  const offsets = lod === 0 ? [-2.15, -0.72, 0.72, 2.15] : lod === 1 ? [-1.75, 0, 1.75] : [0];
  for (const side of [-1, 1]) for (const offset of offsets) {
    addStoneBox(writer, [center[0] + offset, center[1] + side * 3.4], baseY, 0.72, 0.5, 0.85);
    addStoneBox(writer, [center[0] + side * 3.4, center[1] + offset], baseY, 0.5, 0.72, 0.85);
  }
}

/** Build a tower on its named OSM point, inside the palace relation; dimensions remain visual estimates. */
export function addCiguenasTower(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  const tower = features.find((feature) => feature.featureType === 'poi' && feature.id === 'n13723182454' && feature.position);
  const palace = features.find((feature) => feature.featureType === 'poi' && feature.id === 'r5728956');
  const location = tower?.position;
  if (!location || !palace || location[0] < bounds.minX || location[0] >= bounds.maxX || location[1] < bounds.minZ || location[1] >= bounds.maxZ) return;
  const center: RoadPoint = [location[0], location[1]];
  const ground = sampleHeight(terrain, center[0], center[1]);
  addStoneBox(writer, center, ground, 6, 6, 15.5);
  addCorbels(writer, center, ground + 15.3);
  addStoneBox(writer, center, ground + 15.5, 6.8, 6.8, 4.2);
  addMerlons(writer, center, ground + 19.7, lod);
}
