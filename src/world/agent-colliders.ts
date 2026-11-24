import * as RAPIER from '@dimforge/rapier3d-compat';
import type { World } from '@dimforge/rapier3d-compat';

export type AgentKind = 'pedestrian' | 'vehicle';

/** Keeps agent systems independent from Rapier so they stay unit-testable. */
export interface AgentColliderSink {
  create(kind: AgentKind, x: number, y: number, z: number, heading: number): number;
  move(id: number, x: number, y: number, z: number, heading: number): void;
  remove(id: number): void;
}

/** Kinematic bodies that push the player's dynamic vehicle without being pushed. */
export class AgentColliders implements AgentColliderSink {
  private readonly bodies = new Map<number, RAPIER.RigidBody>();
  private readonly world: World;
  private nextId = 1;

  constructor(world: World) {
    this.world = world;
  }

  create(kind: AgentKind, x: number, y: number, z: number, heading: number): number {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
    );
    const shape =
      kind === 'pedestrian'
        ? RAPIER.ColliderDesc.capsule(0.52, 0.26).setTranslation(0, 0.82, 0)
        : RAPIER.ColliderDesc.cuboid(0.95, 0.55, 2.05).setTranslation(0, 0.6, 0);
    this.world.createCollider(shape, body);
    const id = this.nextId;
    this.nextId += 1;
    this.bodies.set(id, body);
    this.move(id, x, y, z, heading);
    return id;
  }

  move(id: number, x: number, y: number, z: number, heading: number): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.setNextKinematicTranslation({ x, y, z });
    const half = heading * 0.5;
    body.setNextKinematicRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
  }

  remove(id: number): void {
    const body = this.bodies.get(id);
    if (!body) return;
    this.world.removeRigidBody(body);
    this.bodies.delete(id);
  }

  dispose(): void {
    for (const body of this.bodies.values()) this.world.removeRigidBody(body);
    this.bodies.clear();
  }
}
