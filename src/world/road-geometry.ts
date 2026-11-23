import type { BuiltTerrainChunk, ChunkFeature, ProjectedBounds, RoadSurfaceGeometry, RoadSurfaceStyle } from './types';

export type RoadPoint = readonly [number, number];
export type RoadPoint3 = readonly [number, number, number];

export const ROAD_VERTEX_COLORS: Record<RoadSurfaceStyle, readonly [number, number, number]> = {
  // Calzada, acera y bordillo must stay separable under the ACES tonemap, even
  // in the old town where the carriageway itself is also paved with stone.
  asphalt: [0.62, 0.64, 0.66],
  stone: [0.72, 0.7, 0.64],
  sidewalk: [1, 0.99, 0.95],
  concrete: [0.78, 0.79, 0.76],
  earth: [0.8, 0.7, 0.55],
  marking: [1, 0.98, 0.86],
};

const HIGHWAY_WIDTHS: Record<string, number> = {
  motorway: 7.2, trunk: 7, primary: 7, secondary: 6.5, tertiary: 6, residential: 5.5,
  living_street: 4.5, service: 4, unclassified: 4.5, pedestrian: 4.5, footway: 1.8,
  steps: 1.6, ladder: 0.8, path: 1.5, bridleway: 2, cycleway: 2.2, track: 3,
};

const WIDE_SIDEWALKS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street']);
const WALKWAYS = new Set(['pedestrian', 'footway', 'steps', 'ladder', 'path', 'bridleway']);

export interface RoadVertex {
  readonly x: number;
  readonly z: number;
}

export class RoadGeometryBuilder {
  private readonly style: RoadSurfaceStyle;
  private readonly terrain: BuiltTerrainChunk;
  private readonly originX: number;
  private readonly originZ: number;
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];

  constructor(style: RoadSurfaceStyle, terrain: BuiltTerrainChunk, originX: number, originZ: number) {
    this.style = style;
    this.terrain = terrain;
    this.originX = originX;
    this.originZ = originZ;
  }

  addPolygon(points: readonly RoadPoint[], bounds: ProjectedBounds, lift: number, seed: string): void {
    const clipped = clipToBounds(points, bounds);
    if (clipped.length < 3) return;
    this.appendVertices(clipped.map((point) => [point[0], sampleHeight(this.terrain, point[0], point[1]) + lift, point[1]]), seed, true, triangulatePolygon(clipped));
  }

  addPolygonAtHeight(points: readonly RoadPoint[], bounds: ProjectedBounds, lift: number, seed: string, offsetAt: (point: RoadPoint) => number): void {
    const clipped = clipToBounds(points, bounds);
    if (clipped.length < 3) return;
    this.appendVertices(clipped.map((point) => [point[0], sampleHeight(this.terrain, point[0], point[1]) + lift + offsetAt(point), point[1]]), seed, true);
  }

  addFlatPolygon(points: readonly RoadPoint[], elevation: number, bounds: ProjectedBounds, seed: string): void {
    const clipped = clipToBounds(points, bounds);
    if (clipped.length < 3) return;
    this.appendVertices(clipped.map((point) => [point[0], elevation, point[1]]), seed, true, triangulatePolygon(clipped));
  }

  addPolygon3D(points: readonly RoadPoint3[], bounds: ProjectedBounds, seed: string): void {
    const clipped = clipVerticesToBounds(points, bounds);
    if (clipped.length < 3) return;
    this.appendVertices(clipped, seed, false);
  }

  build(): RoadSurfaceGeometry {
    return {
      style: this.style,
      positions: Float32Array.from(this.positions),
      normals: Float32Array.from(this.normals),
      colors: Float32Array.from(this.colors),
      uvs: Float32Array.from(this.uvs),
      indices: Uint32Array.from(this.indices),
    };
  }

  private appendVertices(vertices: readonly RoadPoint3[], seed: string, terrainNormals: boolean, triangles?: readonly (readonly [number, number, number])[]): void {
    const base = ROAD_VERTEX_COLORS[this.style];
    const first = this.positions.length / 3;
    const surfaceNormal = terrainNormals ? undefined : polygonNormal(vertices);
    for (let index = 0; index < vertices.length; index += 1) {
      const point = vertices[index];
      if (!point) continue;
      const normal = terrainNormals
        ? sampleNormal(this.terrain, point[0], point[2])
        : surfaceNormal ?? [0, 1, 0];
      const brightness = this.style === 'marking' ? 1 : wear(seed, point[0], point[2]);
      this.positions.push(point[0] - this.originX, point[1], point[2] - this.originZ);
      this.normals.push(...normal);
      this.colors.push(base[0] * brightness, base[1] * brightness, base[2] * brightness);
      this.uvs.push(point[0] / 4, point[2] / 4);
    }
    const faces = triangles ?? Array.from({ length: vertices.length - 2 }, (_, index) => [0, index + 1, index + 2] as const);
    for (const [firstIndex, secondIndex, thirdIndex] of faces) {
      const a = first + firstIndex;
      const b = first + secondIndex;
      const c = first + thirdIndex;
      if (triangleFacesUp(this.positions, a, b, c)) this.indices.push(a, b, c);
      else this.indices.push(a, c, b);
    }
  }
}

export function roadStyle(feature: ChunkFeature): Exclude<RoadSurfaceStyle, 'marking'> {
  const surface = feature.surface?.toLowerCase() ?? '';
  if (['cobblestone', 'unhewn_cobblestone', 'sett', 'paving_stones', 'stone'].includes(surface)) return 'stone';
  if (['concrete', 'concrete:plates', 'asphalt', 'paved'].includes(surface)) return surface.startsWith('concrete') ? 'concrete' : 'asphalt';
  if (['ground', 'dirt', 'gravel', 'fine_gravel', 'unpaved'].includes(surface)) return 'earth';
  if (['pedestrian', 'footway', 'steps', 'ladder'].includes(feature.highway ?? '')) return 'stone';
  return 'asphalt';
}

export function roadWidth(feature: ChunkFeature): number {
  if (feature.widthMeters && feature.widthMeters > 0) return Math.min(24, Math.max(0.5, feature.widthMeters));
  if (feature.lanes && feature.lanes > 0) return Math.min(24, Math.max(2.4, feature.lanes * 3.1));
  return HIGHWAY_WIDTHS[feature.highway ?? ''] ?? 4;
}

export function sidewalkSides(feature: ChunkFeature): readonly (-1 | 1)[] {
  if (WALKWAYS.has(feature.highway ?? '')) return [];
  const combined = feature.sidewalk ?? 'unknown';
  if (combined === 'no') return [];
  const left = feature.sidewalkLeft ?? 'unknown';
  const right = feature.sidewalkRight ?? 'unknown';
  const hasLeft = left !== 'unknown' ? left !== 'no' : ['left', 'both', 'yes'].includes(combined) || (combined === 'unknown' && WIDE_SIDEWALKS.has(feature.highway ?? ''));
  const hasRight = right !== 'unknown' ? right !== 'no' : ['right', 'both', 'yes'].includes(combined) || (combined === 'unknown' && WIDE_SIDEWALKS.has(feature.highway ?? ''));
  return [...(hasLeft ? [1 as const] : []), ...(hasRight ? [-1 as const] : [])];
}

export function smoothRoadCenterline(points: readonly RoadPoint[]): RoadPoint[] {
  const clean: RoadPoint[] = [];
  for (const point of points) {
    const previous = clean.at(-1);
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.01) clean.push([point[0], point[1]]);
  }
  if (clean.length < 3) return clean;
  const smoothed: RoadPoint[] = [[clean[0]?.[0] ?? 0, clean[0]?.[1] ?? 0]];
  for (let index = 1; index < clean.length - 1; index += 1) {
    const previous = clean[index - 1];
    const current = clean[index];
    const next = clean[index + 1];
    if (!previous || !current || !next) continue;
    const inLength = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    const outLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
    if (inLength < 0.01 || outLength < 0.01) continue;
    const inDirection: RoadPoint = [(current[0] - previous[0]) / inLength, (current[1] - previous[1]) / inLength];
    const outDirection: RoadPoint = [(next[0] - current[0]) / outLength, (next[1] - current[1]) / outLength];
    if (inDirection[0] * outDirection[0] + inDirection[1] * outDirection[1] > 0.999) {
      smoothed.push(current);
      continue;
    }
    // Fillets stay within a 0.3 m neighborhood of the source node to preserve OSM alignment.
    const cut = Math.min(0.3, inLength * 0.2, outLength * 0.2);
    const start: RoadPoint = [current[0] - inDirection[0] * cut, current[1] - inDirection[1] * cut];
    const end: RoadPoint = [current[0] + outDirection[0] * cut, current[1] + outDirection[1] * cut];
    smoothed.push(start);
    for (let step = 1; step <= 4; step += 1) {
      const t = step / 4;
      const inverse = 1 - t;
      smoothed.push([
        inverse * inverse * start[0] + 2 * inverse * t * current[0] + t * t * end[0],
        inverse * inverse * start[1] + 2 * inverse * t * current[1] + t * t * end[1],
      ]);
    }
  }
  const last = clean[clean.length - 1];
  if (last) smoothed.push(last);
  return smoothed;
}

export function clipToBounds(points: readonly RoadPoint[], bounds: ProjectedBounds): RoadPoint[] {
  let polygon = points.map((point) => [point[0], point[1]] as RoadPoint);
  const edges: readonly [0 | 1, number, boolean][] = [
    [0, bounds.minX, true], [0, bounds.maxX, false], [1, bounds.minZ, true], [1, bounds.maxZ, false],
  ];
  for (const [axis, boundary, keepGreater] of edges) {
    if (polygon.length === 0) break;
    const input = polygon;
    polygon = [];
    let previous = input[input.length - 1];
    for (const current of input) {
      if (!previous) continue;
      const previousInside = keepGreater ? previous[axis] >= boundary : previous[axis] <= boundary;
      const currentInside = keepGreater ? current[axis] >= boundary : current[axis] <= boundary;
      if (currentInside !== previousInside) polygon.push(intersection(previous, current, axis, boundary));
      if (currentInside) polygon.push(current);
      previous = current;
    }
  }
  return removeDuplicatePoints(polygon);
}

export function sampleHeight(terrain: BuiltTerrainChunk, x: number, z: number): number {
  const max = terrain.samples - 1;
  const fx = Math.max(0, Math.min(max, (x - terrain.bounds.minX) / terrain.stepMeters));
  const fz = Math.max(0, Math.min(max, (z - terrain.bounds.minZ) / terrain.stepMeters));
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(max, x0 + 1);
  const z1 = Math.min(max, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const h00 = terrain.heights[z0 * terrain.samples + x0] ?? 0;
  const h10 = terrain.heights[z0 * terrain.samples + x1] ?? h00;
  const h01 = terrain.heights[z1 * terrain.samples + x0] ?? h00;
  const h11 = terrain.heights[z1 * terrain.samples + x1] ?? h01;

  // Match buildLod's SW-NW-SE / SE-NW-NE diagonal. Bilinear interpolation
  // creates a different curved surface inside each cell, which let the
  // character sink below steep terrain triangles while walking.
  if (tx + tz <= 1) return h00 + tx * (h10 - h00) + tz * (h01 - h00);
  return h11 + (1 - tx) * (h01 - h11) + (1 - tz) * (h10 - h11);
}

export function sampleNormal(terrain: BuiltTerrainChunk, x: number, z: number): readonly [number, number, number] {
  const step = terrain.stepMeters;
  const dx = (sampleHeight(terrain, x + step, z) - sampleHeight(terrain, x - step, z)) / (2 * step);
  const dz = (sampleHeight(terrain, x, z + step) - sampleHeight(terrain, x, z - step)) / (2 * step);
  const length = Math.hypot(dx, 1, dz);
  return [-dx / length, 1 / length, -dz / length];
}

function intersection(a: RoadPoint, b: RoadPoint, axis: 0 | 1, boundary: number): RoadPoint {
  const delta = b[axis] - a[axis];
  const t = Math.abs(delta) < 1e-8 ? 0 : (boundary - a[axis]) / delta;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clipVerticesToBounds(points: readonly RoadPoint3[], bounds: ProjectedBounds): RoadPoint3[] {
  let polygon = points.map((point) => [point[0], point[1], point[2]] as RoadPoint3);
  const edges: readonly [0 | 2, number, boolean][] = [
    [0, bounds.minX, true], [0, bounds.maxX, false], [2, bounds.minZ, true], [2, bounds.maxZ, false],
  ];
  for (const [axis, boundary, keepGreater] of edges) {
    if (polygon.length === 0) break;
    const input = polygon;
    polygon = [];
    let previous = input[input.length - 1];
    for (const current of input) {
      if (!previous) continue;
      const previousInside = keepGreater ? previous[axis] >= boundary : previous[axis] <= boundary;
      const currentInside = keepGreater ? current[axis] >= boundary : current[axis] <= boundary;
      if (currentInside !== previousInside) polygon.push(intersectVertex(previous, current, axis, boundary));
      if (currentInside) polygon.push(current);
      previous = current;
    }
  }
  return polygon.filter((point, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    return previous !== undefined && Math.hypot(point[0] - previous[0], point[2] - previous[2]) > 1e-5;
  });
}

function intersectVertex(a: RoadPoint3, b: RoadPoint3, axis: 0 | 2, boundary: number): RoadPoint3 {
  const delta = b[axis] - a[axis];
  const t = Math.abs(delta) < 1e-8 ? 0 : (boundary - a[axis]) / delta;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function removeDuplicatePoints(points: readonly RoadPoint[]): RoadPoint[] {
  const result = points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    return previous !== undefined && Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-5;
  });
  if (result.length > 1) {
    const first = result[0];
    const last = result[result.length - 1];
    if (first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-5) result.pop();
  }
  return removeCollinearPoints(result);
}

function removeCollinearPoints(points: readonly RoadPoint[]): RoadPoint[] {
  const result = [...points];
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    for (let index = 0; index < result.length; index += 1) {
      const previous = result[(index + result.length - 1) % result.length];
      const current = result[index];
      const next = result[(index + 1) % result.length];
      if (!previous || !current || !next) continue;
      const between = (current[0] - previous[0]) * (current[0] - next[0]) + (current[1] - previous[1]) * (current[1] - next[1]);
      if (Math.abs(cross2D(previous, current, next)) < 1e-6 && between <= 1e-6) {
        result.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
}

export function triangulatePolygon(points: readonly RoadPoint[]): readonly (readonly [number, number, number])[] {
  if (points.length < 3) return [];
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + (next ? point[0] * next[1] - next[0] * point[1] : 0);
  }, 0);
  const orientation = area >= 0 ? 1 : -1;
  const remaining = points.map((_, index) => index);
  const triangles: [number, number, number][] = [];
  let guard = points.length * points.length;
  while (remaining.length > 3 && guard > 0) {
    guard -= 1;
    let earFound = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const previous = remaining[(index + remaining.length - 1) % remaining.length];
      const current = remaining[index];
      const next = remaining[(index + 1) % remaining.length];
      if (previous === undefined || current === undefined || next === undefined) continue;
      const a = points[previous];
      const b = points[current];
      const c = points[next];
      if (!a || !b || !c || orientation * cross2D(a, b, c) <= 1e-8) continue;
      if (remaining.some((candidate) => candidate !== previous && candidate !== current && candidate !== next && points[candidate] && insideTriangle(points[candidate] as RoadPoint, a, b, c, orientation))) continue;
      triangles.push([previous, current, next]);
      remaining.splice(index, 1);
      earFound = true;
      break;
    }
    if (!earFound) return fanTriangles(points.length);
  }
  if (remaining.length === 3) {
    const first = remaining[0];
    const second = remaining[1];
    const third = remaining[2];
    if (first !== undefined && second !== undefined && third !== undefined) triangles.push([first, second, third]);
  }
  return triangles;
}

function fanTriangles(count: number): readonly (readonly [number, number, number])[] {
  return Array.from({ length: count - 2 }, (_, index) => [0, index + 1, index + 2] as const);
}

function cross2D(a: RoadPoint, b: RoadPoint, c: RoadPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function insideTriangle(point: RoadPoint, a: RoadPoint, b: RoadPoint, c: RoadPoint, orientation: number): boolean {
  return orientation * cross2D(a, b, point) >= -1e-7
    && orientation * cross2D(b, c, point) >= -1e-7
    && orientation * cross2D(c, a, point) >= -1e-7;
}

function polygonNormal(vertices: readonly RoadPoint3[]): readonly [number, number, number] {
  const a = vertices[0];
  const b = vertices[1];
  const c = vertices[2];
  if (!a || !b || !c) return [0, 1, 0];
  const ab: RoadPoint3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: RoadPoint3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal: RoadPoint3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const length = Math.hypot(normal[0], normal[1], normal[2]);
  if (length < 1e-8) return [0, 1, 0];
  return [normal[0] / length, normal[1] / length, normal[2] / length];
}

function triangleFacesUp(positions: readonly number[], a: number, b: number, c: number): boolean {
  const ax = positions[a * 3] ?? 0;
  const az = positions[a * 3 + 2] ?? 0;
  const bx = positions[b * 3] ?? 0;
  const bz = positions[b * 3 + 2] ?? 0;
  const cx = positions[c * 3] ?? 0;
  const cz = positions[c * 3 + 2] ?? 0;
  return ((bz - az) * (cx - ax) - (bx - ax) * (cz - az)) >= 0;
}

function wear(seed: string, x: number, z: number): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  hash = Math.imul(hash ^ Math.round(x / 2), 16777619);
  hash = Math.imul(hash ^ Math.round(z / 2), 16777619);
  return 0.94 + ((hash >>> 0) % 13) / 100;
}
