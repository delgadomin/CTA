import { BuildingGeometryWriter, type BuildingColor, type BuildingUv } from './building-geometry';
import { sampleHeight, type RoadPoint, type RoadPoint3 } from './road-geometry';
import type { BuiltTerrainChunk, ChunkFeature, ProjectedBounds } from './types';

const STONE_COLOR: BuildingColor = [0.92, 0.86, 0.73];
const QUAD_UV: readonly [BuildingUv, BuildingUv, BuildingUv, BuildingUv] = [[0, 0], [1, 0], [1, 1], [0, 1]];
const ARCH_SPRING_METERS = 4.6;
const ARCH_OUTER_RADIUS_METERS = 4.3;
const ARCH_INNER_RADIUS_METERS = 3.45;
const ARCH_DEPTH_METERS = 1.35;
const TOWER_MERLON_SPACING_METERS = 1.55;

interface Axis {
  readonly x: number;
  readonly z: number;
}

function pointOnFrame(center: RoadPoint, axis: Axis, along: number, across: number, y: number): RoadPoint3 {
  const normalX = -axis.z;
  const normalZ = axis.x;
  return [center[0] + axis.x * along + normalX * across, y, center[1] + axis.z * along + normalZ * across];
}

function addStoneBox(
  writer: BuildingGeometryWriter,
  center: RoadPoint,
  axis: Axis,
  width: number,
  depth: number,
  baseY: number,
  height: number,
): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const bottom = [
    pointOnFrame(center, axis, -halfWidth, -halfDepth, baseY),
    pointOnFrame(center, axis, halfWidth, -halfDepth, baseY),
    pointOnFrame(center, axis, halfWidth, halfDepth, baseY),
    pointOnFrame(center, axis, -halfWidth, halfDepth, baseY),
  ] as const;
  const top = bottom.map((point) => [point[0], point[1] + height, point[2]] as RoadPoint3);
  for (let index = 0; index < 4; index += 1) {
    const next = (index + 1) % 4;
    const firstBottom = bottom[index];
    const nextBottom = bottom[next];
    const firstTop = top[index];
    const nextTop = top[next];
    if (!firstBottom || !nextBottom || !firstTop || !nextTop) continue;
    writer.addQuad('monument_stone', [firstBottom, nextBottom, nextTop, firstTop], STONE_COLOR, QUAD_UV);
  }
  const topPoints = [top[0], top[1], top[2], top[3]];
  if (topPoints.every((point): point is RoadPoint3 => point !== undefined)) {
    writer.addQuad('monument_stone', topPoints as [RoadPoint3, RoadPoint3, RoadPoint3, RoadPoint3], STONE_COLOR, QUAD_UV);
  }
}

function distanceToSegment(point: RoadPoint, start: RoadPoint, end: RoadPoint): { readonly distance: number; readonly heading: number } {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared < 1e-8 ? 0 : Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared));
  return { distance: Math.hypot(point[0] - start[0] - dx * t, point[1] - start[1] - dz * t), heading: Math.atan2(dz, dx) };
}

function nearestRoadAxis(point: RoadPoint, features: readonly ChunkFeature[]): Axis | undefined {
  let closestDistance = Infinity;
  let closestAxis: Axis | undefined;
  for (const feature of features) {
    if (feature.featureType !== 'road' && feature.featureType !== 'pedestrian') continue;
    for (let index = 0; index + 1 < (feature.points?.length ?? 0); index += 1) {
      const start = feature.points?.[index];
      const end = feature.points?.[index + 1];
      if (!start || !end) continue;
      const nearest = distanceToSegment(point, start, end);
      if (nearest.distance >= closestDistance) continue;
      closestDistance = nearest.distance;
      // The portal spans across the road, so its axis follows the road normal.
      closestAxis = { x: -Math.sin(nearest.heading), z: Math.cos(nearest.heading) };
    }
  }
  return closestDistance <= 24 ? closestAxis : undefined;
}

function addArchRing(writer: BuildingGeometryWriter, center: RoadPoint, axis: Axis, ground: number, segmentCount: number): void {
  const front = ARCH_DEPTH_METERS / 2;
  const back = -front;
  const outer = ARCH_OUTER_RADIUS_METERS;
  const inner = ARCH_INNER_RADIUS_METERS;
  const point = (radius: number, angle: number, depth: number): RoadPoint3 => pointOnFrame(
    center,
    axis,
    radius * Math.cos(angle),
    depth,
    ground + ARCH_SPRING_METERS + radius * Math.sin(angle),
  );
  for (let index = 0; index < segmentCount; index += 1) {
    const firstAngle = Math.PI - Math.PI * index / segmentCount;
    const secondAngle = Math.PI - Math.PI * (index + 1) / segmentCount;
    const outerFirst = point(outer, firstAngle, front);
    const outerSecond = point(outer, secondAngle, front);
    const innerFirst = point(inner, firstAngle, front);
    const innerSecond = point(inner, secondAngle, front);
    const outerFirstBack = point(outer, firstAngle, back);
    const outerSecondBack = point(outer, secondAngle, back);
    const innerFirstBack = point(inner, firstAngle, back);
    const innerSecondBack = point(inner, secondAngle, back);
    writer.addQuad('monument_stone', [outerFirst, outerSecond, innerSecond, innerFirst], STONE_COLOR, QUAD_UV);
    writer.addQuad('monument_stone', [outerFirstBack, innerFirstBack, innerSecondBack, outerSecondBack], STONE_COLOR, QUAD_UV);
    writer.addQuad('monument_stone', [outerFirst, outerFirstBack, outerSecondBack, outerSecond], STONE_COLOR, QUAD_UV);
    writer.addQuad('monument_stone', [innerFirst, innerSecond, innerSecondBack, innerFirstBack], STONE_COLOR, QUAD_UV);
    writer.addQuad('monument_stone', [outerFirst, innerFirst, innerFirstBack, outerFirstBack], STONE_COLOR, QUAD_UV);
    writer.addQuad('monument_stone', [outerSecond, outerSecondBack, innerSecondBack, innerSecond], STONE_COLOR, QUAD_UV);
  }
}

function addStarArch(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  const feature = features.find((item) => item.featureType === 'poi' && item.name === 'Arco de la Estrella' && item.position);
  const location = feature?.position;
  if (!location || location[0] < bounds.minX || location[0] >= bounds.maxX || location[1] < bounds.minZ || location[1] >= bounds.maxZ) return;
  const center: RoadPoint = [location[0], location[1]];
  const axis = nearestRoadAxis(center, features);
  if (!axis) return;
  const ground = sampleHeight(terrain, center[0], center[1]);
  const pierWidth = ARCH_OUTER_RADIUS_METERS - ARCH_INNER_RADIUS_METERS;
  const pierCenter = (ARCH_OUTER_RADIUS_METERS + ARCH_INNER_RADIUS_METERS) / 2;
  for (const side of [-1, 1]) {
    const pier: RoadPoint = [center[0] + axis.x * pierCenter * side, center[1] + axis.z * pierCenter * side];
    addStoneBox(writer, pier, axis, pierWidth, ARCH_DEPTH_METERS, ground, ARCH_SPRING_METERS);
  }
  addArchRing(writer, center, axis, ground, lod === 0 ? 10 : lod === 1 ? 5 : 2);
}

export function isTowerLandmark(feature: ChunkFeature): boolean {
  return feature.featureType === 'building'
    && (feature.buildingType === 'tower' || /^torre(?:\s|$)/i.test(feature.name ?? ''));
}

function addTowerMerlons(writer: BuildingGeometryWriter, feature: ChunkFeature, terrain: BuiltTerrainChunk, lod: number): void {
  const polygon = feature.points;
  if (!polygon || polygon.length < 4) return;
  const height = feature.visualHeightMeters ?? (feature.visualFloors ?? 7) * 3;
  for (let edge = 0; edge + 1 < polygon.length; edge += 1) {
    const start = polygon[edge];
    const end = polygon[edge + 1];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    if (length < 1.2) continue;
    const count = lod === 0 ? Math.max(1, Math.min(8, Math.floor(length / TOWER_MERLON_SPACING_METERS))) : 1;
    const axis = { x: dx / length, z: dz / length };
    for (let index = 0; index < count; index += 1) {
      const t = (index + 0.5) / count;
      const center: RoadPoint = [start[0] + dx * t, start[1] + dz * t];
      const base = sampleHeight(terrain, center[0], center[1]) + height;
      addStoneBox(writer, center, axis, Math.min(0.78, length / count * 0.72), 0.52, base, 0.72);
    }
  }
}

function addHistoricWalls(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  for (const feature of features) {
    if (feature.featureType !== 'surface' || feature.kind !== 'historic_wall' || !feature.points || feature.points.length < 2) continue;
    for (let index = 0; index + 1 < feature.points.length; index += 1) {
      const start = feature.points[index];
      const end = feature.points[index + 1];
      if (!start || !end) continue;
      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const length = Math.hypot(dx, dz);
      if (length < 1) continue;
      const center: RoadPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      if (center[0] < bounds.minX || center[0] >= bounds.maxX || center[1] < bounds.minZ || center[1] >= bounds.maxZ) continue;
      const axis = { x: dx / length, z: dz / length };
      const ground = sampleHeight(terrain, center[0], center[1]);
      // OSM supplies the wall line but no height; the 3.8 m body and merlons are visual fallbacks.
      addStoneBox(writer, center, axis, length, 1.1, ground, 3.8);
      const merlons = lod === 0 ? Math.max(1, Math.floor(length / 2.1)) : 1;
      for (let merlon = 0; merlon < merlons; merlon += 1) {
        const along = ((merlon + 0.5) / merlons - 0.5) * length;
        const merlonCenter: RoadPoint = [center[0] + axis.x * along, center[1] + axis.z * along];
        addStoneBox(writer, merlonCenter, axis, Math.min(0.9, length / merlons * 0.72), 1.25, ground + 3.8, 0.65);
      }
    }
  }
}

function addPlazaMayorArcade(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  // Low-poly approximation of the Plaza Mayor porticoes (soportales). The OSM
  // polygon gives the plaza outline; pillars and a flat roof slab are placed
  // just inside the perimeter. Measurements are visual fallbacks pending photo review.
  const plaza = features.find((item) => item.featureType === 'pedestrian' && item.name === 'Plaza Mayor' && (item.points?.length ?? 0) >= 10);
  const points = plaza?.points;
  if (!points || points.length < 4) return;
  let sumX = 0;
  let sumZ = 0;
  for (const point of points) {
    sumX += point[0];
    sumZ += point[1];
  }
  const center: RoadPoint = [sumX / points.length, sumZ / points.length];
  if (center[0] < bounds.minX || center[0] >= bounds.maxX || center[1] < bounds.minZ || center[1] >= bounds.maxZ) return;
  const spacing = lod === 0 ? 4.5 : 9;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (!start || !end) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    if (length < 2) continue;
    const count = Math.max(1, Math.floor(length / spacing));
    const axis = { x: dx / length, z: dz / length };
    const normalX = -axis.z;
    const normalZ = axis.x;
    for (let pillar = 0; pillar < count; pillar += 1) {
      const t = (pillar + 0.5) / count;
      const px = start[0] + dx * t + normalX * 0.9;
      const pz = start[1] + dz * t + normalZ * 0.9;
      if (px < bounds.minX || px >= bounds.maxX || pz < bounds.minZ || pz >= bounds.maxZ) continue;
      const pillarCenter: RoadPoint = [px, pz];
      const ground = sampleHeight(terrain, pillarCenter[0], pillarCenter[1]);
      addStoneBox(writer, pillarCenter, axis, 0.42, 0.42, ground, 3.1);
    }
    const mid: RoadPoint = [(start[0] + end[0]) / 2 + normalX * 0.9, (start[1] + end[1]) / 2 + normalZ * 0.9];
    if (mid[0] < bounds.minX || mid[0] >= bounds.maxX || mid[1] < bounds.minZ || mid[1] >= bounds.maxZ) continue;
    const ground = sampleHeight(terrain, mid[0], mid[1]);
    addStoneBox(writer, mid, axis, length * 0.92, 1.05, ground + 3.1, 0.22);
  }
}

function addConcatedralBellTower(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  // Visual fallback: the OSM footprint has no height; a stone bell tower is added
  // at a corner of the footprint pending photo comparison.
  const building = features.find((item) => item.featureType === 'building' && item.id === 'w385037723');
  if (!building?.points || building.points.length < 4) return;
  let sumX = 0;
  let sumZ = 0;
  for (const point of building.points) {
    sumX += point[0];
    sumZ += point[1];
  }
  const center: RoadPoint = [sumX / building.points.length, sumZ / building.points.length];
  const towerCenter: RoadPoint = [center[0] + 6, center[1] + 4];
  if (towerCenter[0] < bounds.minX || towerCenter[0] >= bounds.maxX || towerCenter[1] < bounds.minZ || towerCenter[1] >= bounds.maxZ) return;
  const ground = sampleHeight(terrain, towerCenter[0], towerCenter[1]);
  const height = 16;
  addStoneBox(writer, towerCenter, { x: 1, z: 0 }, 4.2, 4.2, ground, height);
  const top = ground + height;
  const merlonCount = lod === 0 ? 3 : 1;
  for (const side of [-1, 1]) {
    for (let index = 0; index < merlonCount; index += 1) {
      const along = (index + 0.5) / merlonCount * 3.4 - 1.7;
      const mc: RoadPoint = [towerCenter[0] + side * 2.2, towerCenter[1] + along];
      if (mc[0] < bounds.minX || mc[0] >= bounds.maxX || mc[1] < bounds.minZ || mc[1] >= bounds.maxZ) continue;
      addStoneBox(writer, mc, { x: 1, z: 0 }, 0.7, 0.7, top, 0.7);
    }
  }
  addStoneBox(writer, towerCenter, { x: 1, z: 0 }, 1.4, 1.4, top + 0.7, 3.5);
}

function addSanFranciscoStaircase(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  // Visual fallback: a stone staircase descends from the church toward Plaza de San Jorge.
  const building = features.find((item) => item.featureType === 'building' && item.id === 'w385037722');
  if (!building?.points || building.points.length < 4) return;
  let sumX = 0;
  let sumZ = 0;
  for (const point of building.points) {
    sumX += point[0];
    sumZ += point[1];
  }
  const center: RoadPoint = [sumX / building.points.length, sumZ / building.points.length];
  const targetX = 116.1;
  const targetZ = -56.4;
  const dx = targetX - center[0];
  const dz = targetZ - center[1];
  const length = Math.hypot(dx, dz);
  if (length < 1) return;
  const ux = dx / length;
  const uz = dz / length;
  const stepCount = lod === 0 ? 12 : 6;
  const stepWidth = 6;
  const stepDepth = 0.45;
  const stepHeight = 0.18;
  for (let index = 0; index < stepCount; index += 1) {
    const along = 4 + index * stepDepth;
    const rise = index * stepHeight;
    const px = center[0] + ux * along;
    const pz = center[1] + uz * along;
    if (px < bounds.minX || px >= bounds.maxX || pz < bounds.minZ || pz >= bounds.maxZ) continue;
    const stepCenter: RoadPoint = [px, pz];
    const ground = sampleHeight(terrain, stepCenter[0], stepCenter[1]);
    addStoneBox(writer, stepCenter, { x: ux, z: uz }, stepDepth, stepWidth, ground + rise, stepHeight);
  }
}

function addTorreCiguenasTower(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  // The OSM source is a point with no footprint, so a synthetic square tower is used
  // as a documented visual fallback pending reference review.
  const poi = features.find((item) => item.featureType === 'poi' && item.id === 'n13723182454');
  const location = poi?.position;
  if (!location) return;
  const center: RoadPoint = [location[0], location[1]];
  if (center[0] < bounds.minX || center[0] >= bounds.maxX || center[1] < bounds.minZ || center[1] >= bounds.maxZ) return;
  const ground = sampleHeight(terrain, center[0], center[1]);
  const size = 7.5;
  const height = 24;
  addStoneBox(writer, center, { x: 1, z: 0 }, size, size, ground, height);
  const top = ground + height;
  const merlonCount = lod === 0 ? 3 : 1;
  for (let side = 0; side < 4; side += 1) {
    const angle = side * (Math.PI / 2);
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);
    const tx = -nz;
    const tz = nx;
    for (let index = 0; index < merlonCount; index += 1) {
      const along = (index + 0.5) / merlonCount * size - size / 2;
      const mc: RoadPoint = [center[0] + nx * (size / 2) + tx * along, center[1] + nz * (size / 2) + tz * along];
      if (mc[0] < bounds.minX || mc[0] >= bounds.maxX || mc[1] < bounds.minZ || mc[1] >= bounds.maxZ) continue;
      addStoneBox(writer, mc, { x: tx, z: tz }, Math.min(0.85, size / merlonCount * 0.7), 0.55, top, 0.75);
    }
  }
  addStoneBox(writer, center, { x: 1, z: 0 }, 1.6, 1.6, top + 0.75, 4);
}

export function addLandmarkGeometry(writer: BuildingGeometryWriter, features: readonly ChunkFeature[], terrain: BuiltTerrainChunk, bounds: ProjectedBounds, lod: number): void {
  addStarArch(writer, features, terrain, bounds, lod);
  addHistoricWalls(writer, features, terrain, bounds, lod);
  addPlazaMayorArcade(writer, features, terrain, bounds, lod);
  addConcatedralBellTower(writer, features, terrain, bounds, lod);
  addSanFranciscoStaircase(writer, features, terrain, bounds, lod);
  addTorreCiguenasTower(writer, features, terrain, bounds, lod);
  for (const feature of features) {
    if (!isTowerLandmark(feature) || feature.landmarkModelPath) continue;
    const points = feature.points;
    if (!points || points.length === 0) continue;
    // Centroid via loop: keeps strict-mode narrowing and avoids per-point closure captures.
    let sumX = 0;
    let sumZ = 0;
    for (const point of points) {
      sumX += point[0];
      sumZ += point[1];
    }
    const center: RoadPoint = [sumX / points.length, sumZ / points.length];
    if (center[0] < bounds.minX || center[0] >= bounds.maxX || center[1] < bounds.minZ || center[1] >= bounds.maxZ) continue;
    addTowerMerlons(writer, feature, terrain, lod);
  }
}
