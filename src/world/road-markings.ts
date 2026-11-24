import type { BuiltTerrainChunk, ChunkFeature, ProjectedBounds } from './types';
import {
  RoadGeometryBuilder,
  roadWidth,
  smoothRoadCenterline,
  type RoadPoint,
} from './road-geometry';

interface RoadApproach {
  readonly feature: ChunkFeature;
  readonly point: RoadPoint;
  readonly tangent: RoadPoint;
  readonly normal: RoadPoint;
  readonly width: number;
  readonly distance: number;
}

export function addLaneMarkings(
  builder: RoadGeometryBuilder,
  roads: readonly ChunkFeature[],
  terrain: BuiltTerrainChunk,
  bounds: ProjectedBounds,
): void {
  for (const road of roads) {
    const lanes = road.lanes ?? inferredLanes(road.highway ?? '');
    if (lanes < 2 || !road.points || road.points.length < 2) continue;
    const line = smoothRoadCenterline(road.points);
    const halfWidth = roadWidth(road) / 2;
    for (let lane = 1; lane < lanes; lane += 1) {
      const offset = -halfWidth + (roadWidth(road) * lane) / lanes;
      for (let segment = 0; segment < line.length - 1; segment += 1) {
        const a = line[segment];
        const b = line[segment + 1];
        if (!a || !b) continue;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 0.1) continue;
        const tangent: RoadPoint = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
        const normal: RoadPoint = [-tangent[1], tangent[0]];
        for (let start = 0; start < length; start += 12) {
          const end = Math.min(length, start + 5);
          if (end - start < 0.25) continue;
          const first: RoadPoint = [
            a[0] + tangent[0] * start + normal[0] * offset,
            a[1] + tangent[1] * start + normal[1] * offset,
          ];
          const last: RoadPoint = [
            a[0] + tangent[0] * end + normal[0] * offset,
            a[1] + tangent[1] * end + normal[1] * offset,
          ];
          builder.addPolygon(ribbon(first, last, 0.1), bounds, 0.09, `${road.id ?? 'road'}:lane`);
        }
      }
    }
    addTurnArrows(builder, road, line, halfWidth, lanes, bounds);
  }
  void terrain;
}

export function addCrossingAndControlMarkings(
  builder: RoadGeometryBuilder,
  roads: readonly ChunkFeature[],
  props: readonly ChunkFeature[],
  bounds: ProjectedBounds,
): void {
  for (const prop of props) {
    const position = prop.position;
    if (!position) continue;
    const approach = nearestApproach(position, roads);
    if (!approach || approach.distance > 22) continue;
    if (prop.kind === 'crossing')
      addZebraCrossing(builder, approach, bounds, prop.id ?? 'crossing');
    if (prop.kind === 'stop') addStopLine(builder, approach, bounds, prop.id ?? 'stop');
    if (prop.kind === 'give_way' || (prop.trafficSign ?? '').includes('206'))
      addYieldTriangles(builder, approach, bounds, prop.id ?? 'give-way');
  }
}

function addZebraCrossing(
  builder: RoadGeometryBuilder,
  approach: RoadApproach,
  bounds: ProjectedBounds,
  seed: string,
): void {
  for (let stripe = -2; stripe <= 2; stripe += 1) {
    const center: RoadPoint = [
      approach.point[0] + approach.tangent[0] * stripe * 0.9,
      approach.point[1] + approach.tangent[1] * stripe * 0.9,
    ];
    const start: RoadPoint = [
      center[0] - approach.tangent[0] * 0.23,
      center[1] - approach.tangent[1] * 0.23,
    ];
    const end: RoadPoint = [
      center[0] + approach.tangent[0] * 0.23,
      center[1] + approach.tangent[1] * 0.23,
    ];
    builder.addPolygon(
      ribbon(start, end, approach.width * 0.92, approach.normal),
      bounds,
      0.1,
      `${seed}:stripe:${stripe}`,
    );
  }
}

function addStopLine(
  builder: RoadGeometryBuilder,
  approach: RoadApproach,
  bounds: ProjectedBounds,
  seed: string,
): void {
  const center: RoadPoint = [
    approach.point[0] - approach.tangent[0] * 1.2,
    approach.point[1] - approach.tangent[1] * 1.2,
  ];
  const start: RoadPoint = [
    center[0] - (approach.normal[0] * approach.width) / 2,
    center[1] - (approach.normal[1] * approach.width) / 2,
  ];
  const end: RoadPoint = [
    center[0] + (approach.normal[0] * approach.width) / 2,
    center[1] + (approach.normal[1] * approach.width) / 2,
  ];
  builder.addPolygon(ribbon(start, end, 0.18, approach.tangent), bounds, 0.1, seed);
}

function addYieldTriangles(
  builder: RoadGeometryBuilder,
  approach: RoadApproach,
  bounds: ProjectedBounds,
  seed: string,
): void {
  for (let index = -1; index <= 1; index += 1) {
    const center: RoadPoint = [
      approach.point[0] - approach.tangent[0] * 1.8 + approach.normal[0] * index * 0.7,
      approach.point[1] - approach.tangent[1] * 1.8 + approach.normal[1] * index * 0.7,
    ];
    const baseA: RoadPoint = [
      center[0] + approach.tangent[0] * 0.35 - approach.normal[0] * 0.22,
      center[1] + approach.tangent[1] * 0.35 - approach.normal[1] * 0.22,
    ];
    const baseB: RoadPoint = [
      center[0] + approach.tangent[0] * 0.35 + approach.normal[0] * 0.22,
      center[1] + approach.tangent[1] * 0.35 + approach.normal[1] * 0.22,
    ];
    const tip: RoadPoint = [
      center[0] - approach.tangent[0] * 0.35,
      center[1] - approach.tangent[1] * 0.35,
    ];
    builder.addPolygon([baseA, baseB, tip], bounds, 0.1, `${seed}:triangle:${index}`);
  }
}

function addTurnArrows(
  builder: RoadGeometryBuilder,
  road: ChunkFeature,
  line: readonly RoadPoint[],
  halfWidth: number,
  lanes: number,
  bounds: ProjectedBounds,
): void {
  const turns =
    road.turnLanes?.split('|').map((turn) => turn.split(';')[0]?.trim().toLowerCase() ?? '') ?? [];
  if (turns.length === 0) return;
  const reverse = road.oneway === -1;
  const points = reverse ? [...line].reverse() : [...line];
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  if (!a || !b) return;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 4) return;
  const tangent: RoadPoint = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const normal: RoadPoint = [-tangent[1], tangent[0]];
  const laneCount = Math.max(1, lanes);
  turns.slice(0, laneCount).forEach((turn, lane) => {
    const direction = turn.includes('left')
      ? rotate(tangent, Math.PI / 2)
      : turn.includes('right')
        ? rotate(tangent, -Math.PI / 2)
        : tangent;
    const centerOffset = -halfWidth + (lane + 0.5) * ((2 * halfWidth) / laneCount);
    const center: RoadPoint = [
      b[0] - tangent[0] * 4 + normal[0] * centerOffset,
      b[1] - tangent[1] * 4 + normal[1] * centerOffset,
    ];
    const arrow = arrowPolygon(center, direction);
    builder.addPolygon(arrow, bounds, 0.1, `${road.id ?? 'road'}:arrow:${lane}`);
  });
}

function nearestApproach(
  point: readonly [number, number],
  roads: readonly ChunkFeature[],
): RoadApproach | undefined {
  let best: RoadApproach | undefined;
  for (const feature of roads) {
    const line = feature.points;
    if (!line || line.length < 2) continue;
    for (let index = 0; index < line.length - 1; index += 1) {
      const a = line[index];
      const b = line[index + 1];
      if (!a || !b) continue;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const lengthSquared = dx * dx + dz * dz;
      if (lengthSquared < 1e-6) continue;
      const t = Math.max(
        0,
        Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared),
      );
      const nearest: RoadPoint = [a[0] + dx * t, a[1] + dz * t];
      const distance = Math.hypot(point[0] - nearest[0], point[1] - nearest[1]);
      if (best && best.distance <= distance) continue;
      const length = Math.sqrt(lengthSquared);
      const tangent: RoadPoint = [dx / length, dz / length];
      best = {
        feature,
        point: nearest,
        tangent,
        normal: [-tangent[1], tangent[0]],
        width: roadWidth(feature),
        distance,
      };
    }
  }
  return best;
}

function ribbon(start: RoadPoint, end: RoadPoint, width: number, normal?: RoadPoint): RoadPoint[] {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return [];
  const side = normal ?? [-dz / length, dx / length];
  const half = width / 2;
  return [
    [start[0] + side[0] * half, start[1] + side[1] * half],
    [end[0] + side[0] * half, end[1] + side[1] * half],
    [end[0] - side[0] * half, end[1] - side[1] * half],
    [start[0] - side[0] * half, start[1] - side[1] * half],
  ];
}

function arrowPolygon(center: RoadPoint, direction: RoadPoint): RoadPoint[] {
  const normal: RoadPoint = [-direction[1], direction[0]];
  const make = (forward: number, side: number): RoadPoint => [
    center[0] + direction[0] * forward + normal[0] * side,
    center[1] + direction[1] * forward + normal[1] * side,
  ];
  return [
    make(-0.8, -0.1),
    make(0.05, -0.1),
    make(0.05, -0.28),
    make(0.75, 0),
    make(0.05, 0.28),
    make(0.05, 0.1),
    make(-0.8, 0.1),
  ];
}

function rotate(direction: RoadPoint, angle: number): RoadPoint {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [direction[0] * cosine - direction[1] * sine, direction[0] * sine + direction[1] * cosine];
}

function inferredLanes(highway: string): number {
  return ['primary', 'secondary', 'tertiary', 'residential'].includes(highway) ? 2 : 0;
}
