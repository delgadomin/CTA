import * as RAPIER from '@dimforge/rapier3d-compat';
import type { World } from '@dimforge/rapier3d-compat';
import type { ProjectedBounds } from './types';

export function toRapierColumnMajor(heights: Float32Array, samples: number): Float32Array {
  if (heights.length !== samples * samples) throw new Error('Terrain collider height count does not match its grid.');
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
  private readonly colliders = new Map<string, ReturnType<World['createCollider']>>();

  constructor(world: World) {
    this.world = world;
  }

  add(id: string, bounds: ProjectedBounds, chunkMeters: number, heights: Float32Array, samples: number): void {
    if (this.colliders.has(id)) return;
    const descriptor = RAPIER.ColliderDesc.heightfield(
      samples - 1,
      samples - 1,
      toRapierColumnMajor(heights, samples),
      new RAPIER.Vector3(chunkMeters, 1, chunkMeters),
    ).setTranslation((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2).setFriction(0.85);
    this.colliders.set(id, this.world.createCollider(descriptor));
  }

  remove(id: string): void {
    const collider = this.colliders.get(id);
    if (!collider) return;
    this.world.removeCollider(collider, true);
    this.colliders.delete(id);
  }

  get count(): number {
    return this.colliders.size;
  }

  clear(): void {
    for (const id of this.colliders.keys()) this.remove(id);
  }
}
