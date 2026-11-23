import { BuildingGeometryWriter, type BuildingColor, type BuildingUv } from './building-geometry';
import { clipToBounds, sampleHeight, type RoadPoint, type RoadPoint3 } from './road-geometry';
import { addLandmarkGeometry, isTowerLandmark } from './landmark-geometry';
import type { BuiltBuildingChunk, BuiltTerrainChunk, BuildingLodGeometry, BuildingMaterial, BuildingRoofAnchor, BuildingSignSlot, ChunkFeature, LandmarkModelInstance, ProjectedBounds } from './types';

const WALL_TINT: Readonly<Record<NonNullable<ChunkFeature['zone']>, BuildingColor>> = {
  casco: [0.92, 0.86, 0.75],
  ensanche: [0.87, 0.85, 0.78],
  periferia: [0.83, 0.84, 0.81],
};

interface Footprint {
  readonly feature: ChunkFeature;
  readonly points: readonly RoadPoint[];
  readonly center: RoadPoint;
  readonly ridgeAxis: 0 | 1;
  readonly ridgeHalfSpan: number;
  readonly wallHeight: number;
  readonly roofHeight: number;
  readonly shape: string;
  readonly wallMaterial: BuildingMaterial;
  readonly roofMaterial: BuildingMaterial;
  readonly tint: BuildingColor;
}

function centroid(points: readonly RoadPoint[]): RoadPoint {
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + (next ? point[0] * next[1] - next[0] * point[1] : 0);
  }, 0);
  if (Math.abs(area) < 1e-7) {
    const bounds = points.reduce((result, point) => ({ minX: Math.min(result.minX, point[0]), maxX: Math.max(result.maxX, point[0]), minZ: Math.min(result.minZ, point[1]), maxZ: Math.max(result.maxZ, point[1]) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    return [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2];
  }
  let x = 0;
  let z = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    const cross = current[0] * next[1] - next[0] * current[1];
    x += (current[0] + next[0]) * cross;
    z += (current[1] + next[1]) * cross;
  }
  return [x / (3 * area), z / (3 * area)];
}

function areaSize(points: readonly RoadPoint[]): readonly [number, number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return [maxX - minX, maxZ - minZ];
}

export function roofShapeFor(feature: ChunkFeature, points: readonly RoadPoint[]): 'flat' | 'gabled' | 'hipped' {
  const tagged = feature.roofShape?.toLowerCase();
  if (tagged === 'flat') return 'flat';
  if (tagged === 'gabled' || tagged === 'saltbox' || tagged === 'gambrel') return 'gabled';
  if (tagged === 'hipped' || tagged === 'pyramidal') return 'hipped';
  if (isTowerLandmark(feature)) return 'flat';
  const [width, depth] = areaSize(points);
  return Math.max(width, depth) / Math.max(0.1, Math.min(width, depth)) > 1.35 ? 'gabled' : 'hipped';
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function colorTint(feature: ChunkFeature): BuildingColor {
  const fallback = WALL_TINT[feature.zone ?? 'ensanche'];
  const hex = /^#?([\da-f]{6})$/i.exec(feature.facadeColour ?? '')?.[1];
  if (!hex) return fallback;
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function buildingMaterial(feature: ChunkFeature): BuildingMaterial {
  if (feature.zone === 'casco') return 'casco_facade';
  if (feature.zone === 'periferia') return 'periferia_facade';
  return 'ensanche_facade';
}

function footprint(feature: ChunkFeature, points: readonly RoadPoint[], shapePoints = points): Footprint | undefined {
  if (!feature.id || points.length < 3) return undefined;
  const totalHeight = Math.max(2.8, Math.min(80, feature.visualHeightMeters ?? (feature.visualFloors ?? 2) * 3));
  const shape = roofShapeFor(feature, shapePoints);
  const roofHeight = shape === 'flat' ? 0 : Math.max(0.35, Math.min(8, feature.roofHeightMeters ?? (feature.zone === 'casco' ? 1.15 : 0.75)));
  const [shapeWidth, shapeDepth] = areaSize(shapePoints);
  const ridgeAxis: 0 | 1 = shapeWidth >= shapeDepth ? 1 : 0;
  const center = centroid(shapePoints);
  return {
    feature,
    points,
    center,
    ridgeAxis,
    ridgeHalfSpan: Math.max(0.1, ...shapePoints.map((point) => Math.abs(point[ridgeAxis] - center[ridgeAxis]))),
    wallHeight: Math.max(2.4, totalHeight - roofHeight),
    roofHeight,
    shape,
    wallMaterial: buildingMaterial(feature),
    roofMaterial: isTowerLandmark(feature) ? 'monument_stone' : feature.roofMaterial === 'tile' ? 'tile_roof' : 'modern_roof',
    tint: colorTint(feature),
  };
}

function localHeight(terrain: BuiltTerrainChunk, point: RoadPoint): number {
  return sampleHeight(terrain, point[0], point[1]);
}

function worldPoint(point: RoadPoint, y: number): RoadPoint3 {
  return [point[0], y, point[1]];
}

function tileUv(seed: number, row: number): BuildingUv[] {
  const columns = 8;
  const rows = 4;
  const column = seed % columns;
  const inset = 0.003;
  const u0 = column / columns + inset;
  const u1 = (column + 1) / columns - inset;
  const v0 = row / rows + inset;
  const v1 = (row + 1) / rows - inset;
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

function wallUv(seed: number, floor: number): BuildingUv[] {
  const random = stableHash(`${seed}:${floor}`);
  const row = floor === 0 ? (random % 5 === 0 ? 3 : 0) : (random % 3 === 0 ? 2 : 1);
  return tileUv(random, row);
}

function roofUvs(points: readonly RoadPoint3[]): BuildingUv[] {
  return points.map((point) => [point[0] / 4, point[2] / 4]);
}

function onChunkBoundary(a: RoadPoint, b: RoadPoint, bounds: ProjectedBounds): boolean {
  const tolerance = 0.02;
  return (Math.abs(a[0] - bounds.minX) < tolerance && Math.abs(b[0] - bounds.minX) < tolerance)
    || (Math.abs(a[0] - bounds.maxX) < tolerance && Math.abs(b[0] - bounds.maxX) < tolerance)
    || (Math.abs(a[1] - bounds.minZ) < tolerance && Math.abs(b[1] - bounds.minZ) < tolerance)
    || (Math.abs(a[1] - bounds.maxZ) < tolerance && Math.abs(b[1] - bounds.maxZ) < tolerance);
}

function addWalls(writer: BuildingGeometryWriter, item: Footprint, terrain: BuiltTerrainChunk, bounds: ProjectedBounds, detailed: boolean, makeCollider = false): void {
  const floorCount = Math.max(1, Math.min(20, Math.round(item.feature.visualFloors ?? item.wallHeight / 3)));
  const polygon = item.points;
  for (let edge = 0; edge < polygon.length; edge += 1) {
    const start = polygon[edge];
    const end = polygon[(edge + 1) % polygon.length];
    if (!start || !end) continue;
    if (onChunkBoundary(start, end, bounds)) continue;
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (length < 0.1) continue;
    const panels = detailed ? Math.max(1, Math.ceil(length / 3.4)) : 1;
    const floors = detailed ? floorCount : 1;
    const startGround = localHeight(terrain, start);
    const endGround = localHeight(terrain, end);
    for (let panel = 0; panel < panels; panel += 1) {
      const t0 = panel / panels;
      const t1 = (panel + 1) / panels;
      const panelStart: RoadPoint = [start[0] + (end[0] - start[0]) * t0, start[1] + (end[1] - start[1]) * t0];
      const panelEnd: RoadPoint = [start[0] + (end[0] - start[0]) * t1, start[1] + (end[1] - start[1]) * t1];
      const groundStart = startGround + (endGround - startGround) * t0;
      const groundEnd = startGround + (endGround - startGround) * t1;
      for (let floor = 0; floor < floors; floor += 1) {
        const floorBottom = item.wallHeight * floor / floors;
        const floorTop = item.wallHeight * (floor + 1) / floors;
        const points: [RoadPoint3, RoadPoint3, RoadPoint3, RoadPoint3] = [
          worldPoint(panelStart, groundStart + floorBottom), worldPoint(panelEnd, groundEnd + floorBottom),
          worldPoint(panelEnd, groundEnd + floorTop), worldPoint(panelStart, groundStart + floorTop),
        ];
        const uv = detailed ? wallUv(stableHash(item.feature.id ?? ''), floor) : tileUv(stableHash(item.feature.id ?? '') + edge, 1);
        writer.addQuad(item.wallMaterial, points, item.tint, uv as [BuildingUv, BuildingUv, BuildingUv, BuildingUv]);
      }
    }
    if (makeCollider) {
      const bottomStart = worldPoint(start, startGround);
      const bottomEnd = worldPoint(end, endGround);
      const topStart = worldPoint(start, startGround + item.wallHeight);
      const topEnd = worldPoint(end, endGround + item.wallHeight);
      writer.addColliderTriangle([bottomStart, bottomEnd, topEnd]);
      writer.addColliderTriangle([bottomStart, topEnd, topStart]);
    }
  }
}

function clipHalf(points: readonly RoadPoint[], axis: 0 | 1, middle: number, keepBelow: boolean): RoadPoint[] {
  const clipped: RoadPoint[] = [];
  let previous = points.at(-1);
  for (const current of points) {
    if (!previous) continue;
    const previousInside = keepBelow ? previous[axis] <= middle : previous[axis] >= middle;
    const currentInside = keepBelow ? current[axis] <= middle : current[axis] >= middle;
    if (currentInside !== previousInside) {
      const delta = current[axis] - previous[axis];
      const t = Math.abs(delta) < 1e-8 ? 0 : (middle - previous[axis]) / delta;
      clipped.push([previous[0] + (current[0] - previous[0]) * t, previous[1] + (current[1] - previous[1]) * t]);
    }
    if (currentInside) clipped.push(current);
    previous = current;
  }
  return clipped;
}

function addRoof(writer: BuildingGeometryWriter, item: Footprint, terrain: BuiltTerrainChunk, detailed: boolean): void {
  const top: RoadPoint3[] = item.points.map((point) => worldPoint(point, localHeight(terrain, point) + item.wallHeight));
  if (item.shape === 'flat' || !detailed) {
    writer.addPolygon(item.roofMaterial, top, [1, 1, 1], (point) => [point[0] / 4, point[2] / 4]);
    return;
  }
  if (item.shape === 'hipped') {
    const centerY = localHeight(terrain, item.center) + item.wallHeight + item.roofHeight;
    const center = worldPoint(item.center, centerY);
    for (let index = 0; index < top.length; index += 1) {
      const first = top[index];
      const second = top[(index + 1) % top.length];
      if (!first || !second) continue;
      writer.addTriangle(item.roofMaterial, [first, second, center], [1, 1, 1], roofUvs([first, second, center]) as [BuildingUv, BuildingUv, BuildingUv]);
    }
    return;
  }
  const splitAxis = item.ridgeAxis;
  const middle = item.center[splitAxis];
  for (const keepBelow of [true, false]) {
    const half = clipHalf(item.points, splitAxis, middle, keepBelow);
    if (half.length < 3) continue;
    const maxDistance = item.ridgeHalfSpan;
    const roof = half.map((point) => {
      const rise = item.roofHeight * Math.min(1, Math.abs(point[splitAxis] - middle) / maxDistance);
      return worldPoint(point, localHeight(terrain, point) + item.wallHeight + rise);
    });
    writer.addPolygon(item.roofMaterial, roof, [1, 1, 1], (point) => [point[0] / 4, point[2] / 4]);
  }
}

function roadDistance(point: RoadPoint, roads: readonly ChunkFeature[]): number {
  let bestDistance = Infinity;
  for (const road of roads) {
    if (road.featureType !== 'road' && road.featureType !== 'pedestrian') continue;
    for (let index = 1; index < (road.points?.length ?? 0); index += 1) {
      const a = road.points?.[index - 1];
      const b = road.points?.[index];
      if (!a || !b) continue;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared < 1e-6 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared));
      const distance = Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dz * t);
      bestDistance = Math.min(bestDistance, distance);
    }
  }
  return bestDistance;
}

function signSlot(item: Footprint, terrain: BuiltTerrainChunk, roads: readonly ChunkFeature[]): BuildingSignSlot | undefined {
  if (!item.feature.commercial || item.points.length < 3) return undefined;
  let bestIndex = -1;
  let bestLength = 0;
  let bestRoadDistance = Infinity;
  for (let index = 0; index < item.points.length; index += 1) {
    const a = item.points[index];
    const b = item.points[(index + 1) % item.points.length];
    if (!a || !b) continue;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1.5) continue;
    const midpoint: RoadPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const distance = roadDistance(midpoint, roads);
    if (distance < bestRoadDistance || (distance === bestRoadDistance && length > bestLength)) {
      bestIndex = index;
      bestLength = length;
      bestRoadDistance = distance;
    }
  }
  if (bestIndex < 0) return undefined;
  if (bestRoadDistance > 40) return undefined;
  const start = item.points[bestIndex];
  const end = item.points[(bestIndex + 1) % item.points.length];
  if (!start || !end || bestLength < 1.5) return undefined;
  const midpoint: RoadPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  let signedArea = 0;
  for (let index = 0; index < item.points.length; index += 1) {
    const current = item.points[index];
    const next = item.points[(index + 1) % item.points.length];
    if (current && next) signedArea += current[0] * next[1] - next[0] * current[1];
  }
  const edgeDx = end[0] - start[0];
  const edgeDz = end[1] - start[1];
  const normalX = signedArea >= 0 ? edgeDz : -edgeDz;
  const normalZ = signedArea >= 0 ? -edgeDx : edgeDx;
  return {
    buildingId: item.feature.id ?? '',
    category: item.feature.commercialCategory ?? 'business:shop',
    position: [midpoint[0], localHeight(terrain, midpoint) + item.wallHeight * 0.55, midpoint[1]],
    heading: Math.atan2(normalX, normalZ),
    width: Math.min(bestLength * 0.7, 3.5),
  };
}

function boxSilhouette(item: Footprint, terrain: BuiltTerrainChunk, bounds: ProjectedBounds, writer: BuildingGeometryWriter): void {
  const minX = Math.min(...item.points.map((point) => point[0]));
  const maxX = Math.max(...item.points.map((point) => point[0]));
  const minZ = Math.min(...item.points.map((point) => point[1]));
  const maxZ = Math.max(...item.points.map((point) => point[1]));
  const y = localHeight(terrain, item.center);
  const points: RoadPoint[] = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  const silhouette = footprint(item.feature, points);
  if (!silhouette) return;
  addWalls(writer, silhouette, terrain, bounds, false);
  const roof: RoadPoint3[] = points.map((point) => worldPoint(point, y + item.wallHeight));
  writer.addPolygon(item.roofMaterial, roof, [1, 1, 1], (point) => [point[0] / 4, point[2] / 4]);
}

function buildLod(features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): BuildingLodGeometry {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const writer = new BuildingGeometryWriter(centerX, centerZ);
  for (const feature of features) {
    if (feature.featureType !== 'building' || !feature.points || feature.points.length < 3) continue;
    if (feature.landmarkModelPath && /^landmarks\/w\d+\.glb$/.test(feature.landmarkModelPath)) continue;
    const clipped = clipToBounds(feature.points, bounds);
    const item = footprint(feature, clipped, feature.points);
    if (!item) continue;
    if (lod === 2) boxSilhouette(item, terrain, bounds, writer);
    else {
      addWalls(writer, item, terrain, bounds, lod === 0);
      addRoof(writer, item, terrain, lod === 0);
    }
  }
  addLandmarkGeometry(writer, features, terrain, bounds, lod);
  const surfaces = writer.build();
  return { level: lod, surfaces, triangleCount: surfaces.reduce((sum, surface) => sum + surface.indices.length / 3, 0) };
}

function buildExtras(features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds): { signs: BuildingSignSlot[]; anchors: BuildingRoofAnchor[]; models: LandmarkModelInstance[]; storks: { buildingId: string; position: RoadPoint3 }[] } {
  const signs: BuildingSignSlot[] = [];
  const anchors: BuildingRoofAnchor[] = [];
  const models: LandmarkModelInstance[] = [];
  const storks: { buildingId: string; position: RoadPoint3 }[] = [];
  const roads = features.filter((feature) => feature.featureType === 'road' || feature.featureType === 'pedestrian');
  for (const feature of features) {
    if (feature.featureType !== 'building' || !feature.points || feature.points.length < 3) continue;
    const center = centroid(feature.points);
    const clipped = clipToBounds(feature.points, bounds);
    const item = footprint(feature, clipped, feature.points);
    if (!item) continue;
    const owner = center[0] >= bounds.minX && center[0] < bounds.maxX && center[1] >= bounds.minZ && center[1] < bounds.maxZ;
    if (owner && feature.landmarkModelPath && /^landmarks\/w\d+\.glb$/.test(feature.landmarkModelPath)) {
      models.push({ buildingId: feature.id ?? '', path: feature.landmarkModelPath, position: [center[0], localHeight(terrain, center), center[1]] });
    }
    if (owner && feature.zone === 'casco' && item.wallHeight >= 5) {
      anchors.push({ buildingId: feature.id ?? '', position: [center[0], localHeight(terrain, center) + item.wallHeight + item.roofHeight, center[1]], roofShape: item.shape });
    }
    const landmarkTower = isTowerLandmark(feature);
    const roofId = feature.id ?? '';
    const roofHash = [...roofId].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
    if (owner && feature.zone === 'casco' && item.wallHeight >= 5 && (landmarkTower || roofHash % 11 === 0)) {
      storks.push({ buildingId: roofId, position: [center[0], localHeight(terrain, center) + item.wallHeight + item.roofHeight + 0.85, center[1]] });
    }
    if (owner) {
      const slot = signSlot(item, terrain, roads);
      if (slot) signs.push(slot);
    }
  }
  // Torre de las Cigueñas is an OSM point without a building footprint, so it is
  // not covered by the loop above; add its stork anchor here as a visual fallback.
  const ciguenas = features.find((feature) => feature.featureType === 'poi' && feature.id === 'n13723182454');
  if (ciguenas?.position) {
    const [px, pz] = ciguenas.position;
    const owner = px >= bounds.minX && px < bounds.maxX && pz >= bounds.minZ && pz < bounds.maxZ;
    if (owner) {
      const ground = localHeight(terrain, [px, pz] as RoadPoint);
      storks.push({ buildingId: ciguenas.id ?? '', position: [px, ground + 24 + 0.85 + 0.75, pz] });
    }
  }
  return { signs, anchors, models, storks };
}

export function buildBuildingChunk(features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds): BuiltBuildingChunk {
  const levels = [0, 1, 2].map((lod) => buildLod(features, terrain, bounds, lod));
  const extras = buildExtras(features, terrain, bounds);
  const colliderWriter = new BuildingGeometryWriter((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2);
  for (const feature of features) {
    if (feature.featureType !== 'building' || !feature.points || feature.points.length < 3) continue;
    const item = footprint(feature, clipToBounds(feature.points, bounds), feature.points);
    if (!item) continue;
    addWalls(colliderWriter, item, terrain, bounds, false, true);
  }
  const collider = colliderWriter.buildCollider();
  return { levels, colliderPositions: collider.positions, colliderIndices: collider.indices, signSlots: extras.signs, roofAnchors: extras.anchors, landmarkModels: extras.models, storks: extras.storks };
}

