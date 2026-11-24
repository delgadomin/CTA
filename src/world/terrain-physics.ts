import * as RAPIER from '@dimforge/rapier3d-compat';
import type { World } from '@dimforge/rapier3d-compat';
import type { ProjectedBounds } from './types';

export function toRapierColumnMajor(heights: Float32Array, samples: number): Float32Array {
  if (heights.length !== samples * samples)
    throw new Error('Terrain collider height count does not match its grid.');
  const result = new Float32Array(heights.length);
  for (let row = 0; row < samples; row += 1) {
    for (let column = 0; column < samples; column += 1) {
      result[column * samples + row] = heights[row * samples + column] ?? 0;
    }
  }
  return result;
}

export async function createPhysicsWorld(): Promise<World> {
  await RAPIER.init();
  return new RAPIER.World(new RAPIER.Vector3(0, -9.81, 0));
}

export class TerrainColliders {
  private readonly world: World;
  private readonly colliders = new Map<string, ReturnType<World['createCollider']>[]>();
  // Rapier's scene queries are a separate acceleration structure: castRay keeps
  // returning stale results until updateSceneQueries() rebuilds it.
  private queriesDirty = false;

  constructor(world: World) {
    this.world = world;
  }

  add(
    id: string,
    bounds: ProjectedBounds,
    chunkMeters: number,
    heights: Float32Array,
    samples: number,
  ): void {
    if (this.colliders.has(id)) return;
    const descriptor = RAPIER.ColliderDesc.heightfield(
      samples - 1,
      samples - 1,
      toRapierColumnMajor(heights, samples),
      new RAPIER.Vector3(chunkMeters, 1, chunkMeters),
    )
      .setTranslation((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2)
      .setFriction(0.85);
    this.addCollider(id, this.world.createCollider(descriptor));
  }

  addRoads(
    id: string,
    centerX: number,
    centerZ: number,
    positions: Float32Array,
    indices: Uint32Array,
  ): void {
    if (positions.length < 9 || indices.length < 3) return;
    const descriptor = RAPIER.ColliderDesc.trimesh(positions, indices)
      .setTranslation(centerX, 0, centerZ)
      .setFriction(0.9);
    this.addCollider(id, this.world.createCollider(descriptor));
  }

  addBuildings(
    id: string,
    centerX: number,
    centerZ: number,
    positions: Float32Array,
    indices: Uint32Array,
  ): void {
    if (positions.length < 9 || indices.length < 3) return;
    const descriptor = RAPIER.ColliderDesc.trimesh(positions, indices)
      .setTranslation(centerX, 0, centerZ)
      .setFriction(0.7);
    this.addCollider(id, this.world.createCollider(descriptor));
  }

  private addCollider(id: string, collider: ReturnType<World['createCollider']>): void {
    const current = this.colliders.get(id) ?? [];
    current.push(collider);
    this.colliders.set(id, current);
    this.queriesDirty = true;
  }

  remove(id: string): void {
    const colliders = this.colliders.get(id);
    if (!colliders) return;
    for (const collider of colliders) this.world.removeCollider(collider, true);
    this.colliders.delete(id);
    this.queriesDirty = true;
  }

  /** Rebuilds the query pipeline once after any collider add/remove. */
  refreshQueries(): void {
    if (!this.queriesDirty) return;
    this.world.updateSceneQueries();
    this.queriesDirty = false;
  }

  get count(): number {
    return [...this.colliders.values()].reduce((sum, colliders) => sum + colliders.length, 0);
  }

  clear(): void {
    for (const id of this.colliders.keys()) this.remove(id);
  }
}
