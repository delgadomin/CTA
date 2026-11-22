import { describe, expect, it } from 'vitest';
import { EntityStore } from '../src/engine/ecs';
import { EventBus } from '../src/engine/event-bus';
import { FixedStepLoop } from '../src/engine/game-loop';

describe('EntityStore', () => {
  it('reuses a destroyed slot without reviving an old handle', () => {
    const store = new EntityStore(2);
    const first = store.create();
    expect(store.isAlive(first)).toBe(true);
    expect(store.destroy(first)).toBe(true);
    const reused = store.create();
    expect(reused & 0xffff).toBe(first & 0xffff);
    expect(reused).not.toBe(first);
    expect(store.isAlive(first)).toBe(false);
    expect(store.isAlive(reused)).toBe(true);
  });

  it('keeps transforms in typed arrays and visits only active entities', () => {
    const store = new EntityStore(3);
    const first = store.create();
    store.setPosition(first, 2, 4, 6);
    const visited: number[] = [];
    store.forEachTransform((id, x, y, z) => visited.push(id, x, y, z));
    expect(Array.from(store.position.slice(0, 3))).toEqual([2, 4, 6]);
    expect(visited).toEqual([first, 2, 4, 6]);
  });
});

describe('FixedStepLoop', () => {
  it('runs systems in stable order for ten thousand deterministic steps', () => {
    const order: string[] = [];
    let ticks = 0;
    const loop = new FixedStepLoop([
      { name: 'late', order: 20, update: () => order.push('late') },
      { name: 'early', order: 10, update: () => order.push('early') },
      { name: 'simulation', order: 30, update: (dt) => { ticks += dt; } },
    ], () => undefined);

    for (let step = 0; step < 10_000; step += 1) loop.advance(1 / 60);

    expect(order.slice(0, 2)).toEqual(['early', 'late']);
    expect(ticks).toBeCloseTo(10_000 / 60, 8);
  });

  it('limits catch-up work after a long frame', () => {
    let ticks = 0;
    const loop = new FixedStepLoop([{ name: 'counter', order: 0, update: () => { ticks += 1; } }], () => undefined);
    expect(loop.advance(10)).toBe(5);
    expect(ticks).toBe(5);
  });
});

describe('EventBus', () => {
  it('supports typed payload delivery and unsubscribe', () => {
    const events = new EventBus<{ timeChanged: { hour: number } }>();
    const hours: number[] = [];
    const unsubscribe = events.on('timeChanged', ({ hour }) => hours.push(hour));
    events.emit('timeChanged', { hour: 20 });
    unsubscribe();
    events.emit('timeChanged', { hour: 21 });
    expect(hours).toEqual([20]);
  });
});
