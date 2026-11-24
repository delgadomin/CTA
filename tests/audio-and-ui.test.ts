import { describe, expect, it } from 'vitest';
import { AudioSystem } from '../src/engine/audio-system';
import { Minimap } from '../src/ui/minimap';

function createMockCanvas(): { canvas: HTMLCanvasElement; hasClass: (name: string) => boolean } {
  const dummyCtx = {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    arc: () => {},
    clip: () => {},
    fillRect: () => {},
    translate: () => {},
    rotate: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: () => {},
    closePath: () => {},
  } as unknown as CanvasRenderingContext2D;

  const classSet = new Set<string>();
  const parent = {
    classList: {
      add: (name: string) => classSet.add(name),
      remove: (name: string) => classSet.delete(name),
      contains: (name: string) => classSet.has(name),
    },
  } as unknown as HTMLElement;

  const canvas = {
    width: 168,
    height: 168,
    getContext: () => dummyCtx,
    parentElement: parent,
  } as unknown as HTMLCanvasElement;

  return { canvas, hasClass: (name: string) => classSet.has(name) };
}

describe('AudioSystem', () => {
  it('constructs safely without AudioContext in test environments and toggles mute', () => {
    const audio = new AudioSystem();
    expect(audio.isMuted).toBe(false);
    expect(audio.toggleMute()).toBe(true);
    expect(audio.isMuted).toBe(true);
    expect(audio.toggleMute()).toBe(false);
  });

  it('tolerates playback calls before initialization without throwing', () => {
    const audio = new AudioSystem();
    expect(() => {
      audio.updateVehicleEngine(true, 15, true);
      audio.updateSkid(true);
      audio.setHorn(true);
      audio.updatePoliceSiren(2, 45);
      audio.playFootstep();
      audio.playCollision(0.7);
      audio.playCrimeAlert();
      audio.playBusted();
    }).not.toThrow();
  });
});

describe('Minimap', () => {
  it('creates an instance and renders without crashing', () => {
    const { canvas } = createMockCanvas();
    const minimap = new Minimap(canvas);

    expect(() => {
      minimap.update(
        0,
        0,
        0,
        false,
        0,
        [{ x: 10, z: 20 }, { x: -30, z: -40 }],
        [{ x: 50, z: 50 }],
        0.016,
      );
    }).not.toThrow();
  });

  it('updates pursuit styling when wanted level is active', () => {
    const { canvas, hasClass } = createMockCanvas();
    const minimap = new Minimap(canvas);

    minimap.update(0, 0, 0, false, 2, [], [], 0.016);
    expect(hasClass('pursuit')).toBe(true);

    minimap.update(0, 0, 0, false, 0, [], [], 0.016);
    expect(hasClass('pursuit')).toBe(false);
  });
});
