import type { BuiltRoadChunk, ProjectedBounds } from './types';

const CELL_SIZE = 8;

/** Small spatial index for raised road and pavement triangles under actors. */
export class RoadHeightIndex {
  private readonly positions: Float32Array;
  private readonly indices: Uint32Array;
  private readonly originX: number;
  private readonly originZ: number;
  private readonly cells = new Map<string, number[]>();

  constructor(roads: BuiltRoadChunk, bounds: ProjectedBounds) {
    this.positions = roads.colliderPositions;
    this.indices = roads.colliderIndices;
    this.originX = (bounds.minX + bounds.maxX) / 2;
    this.originZ = (bounds.minZ + bounds.maxZ) / 2;
    this.indexTriangles();
  }

  heightAt(x: number, z: number): number | undefined {
    const candidates = this.cells.get(
      this.key(Math.floor(x / CELL_SIZE), Math.floor(z / CELL_SIZE)),
    );
    if (!candidates) return undefined;
    let highest: number | undefined;
    for (const triangle of candidates) {
      const height = this.triangleHeight(triangle, x - this.originX, z - this.originZ);
      if (height !== undefined && (highest === undefined || height > highest)) highest = height;
    }
    return highest;
  }

  private indexTriangles(): void {
    for (let triangle = 0; triangle + 2 < this.indices.length; triangle += 3) {
      const a = this.vertex(this.indices[triangle] ?? 0);
      const b = this.vertex(this.indices[triangle + 1] ?? 0);
      const c = this.vertex(this.indices[triangle + 2] ?? 0);
      if (!a || !b || !c) continue;
      const minX = Math.floor((Math.min(a[0], b[0], c[0]) + this.originX) / CELL_SIZE);
      const maxX = Math.floor((Math.max(a[0], b[0], c[0]) + this.originX) / CELL_SIZE);
      const minZ = Math.floor((Math.min(a[2], b[2], c[2]) + this.originZ) / CELL_SIZE);
      const maxZ = Math.floor((Math.max(a[2], b[2], c[2]) + this.originZ) / CELL_SIZE);
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
          const key = this.key(cellX, cellZ);
          const cell = this.cells.get(key) ?? [];
          cell.push(triangle);
          this.cells.set(key, cell);
        }
      }
    }
  }

  private triangleHeight(offset: number, x: number, z: number): number | undefined {
    const a = this.vertex(this.indices[offset] ?? 0);
    const b = this.vertex(this.indices[offset + 1] ?? 0);
    const c = this.vertex(this.indices[offset + 2] ?? 0);
    if (!a || !b || !c) return undefined;
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-8) return undefined;
    const wa = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
    const wb = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
    const wc = 1 - wa - wb;
    if (wa < -1e-5 || wb < -1e-5 || wc < -1e-5) return undefined;
    return wa * a[1] + wb * b[1] + wc * c[1];
  }

  private vertex(index: number): readonly [number, number, number] | undefined {
    const offset = index * 3;
    if (offset + 2 >= this.positions.length) return undefined;
    return [
      this.positions[offset] ?? 0,
      this.positions[offset + 1] ?? 0,
      this.positions[offset + 2] ?? 0,
    ];
  }

  private key(x: number, z: number): string {
    return `${x}:${z}`;
  }
}
