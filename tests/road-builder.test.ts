import { describe, expect, it } from 'vitest';
import { buildRoadChunk } from '../src/world/road-builder';
import { roadStyle, roadWidth, sampleHeight, sidewalkSides, smoothRoadCenterline } from '../src/world/road-geometry';
import { buildTerrainChunk } from '../src/world/mesh-builder';
import type { ChunkFeature, RawTerrainChunk } from '../src/world/types';

const bounds = { minX: -8, minZ: -8, maxX: 8, maxZ: 8 };
const terrain = buildTerrainChunk({
  id: '0_0', bounds,
  terrain: { samples: 5, stepMeters: 4, quantizationMeters: 0.25, heights: Array.from({ length: 25 }, (_, index) => 1600 + index) },
  features: [],
} satisfies RawTerrainChunk);

describe('road geometry rules', () => {
  it('uses measured widths and mapped paving materials, and derives sidewalks per side', () => {
    expect(roadWidth({ featureType: 'road', highway: 'residential', widthMeters: 4.7 })).toBe(4.7);
    expect(roadWidth({ featureType: 'road', highway: 'secondary', lanes: 3 })).toBe(9.3);
    expect(roadStyle({ featureType: 'pedestrian', highway: 'pedestrian', surface: 'paving_stones' })).toBe('stone');
    expect(sidewalkSides({ featureType: 'road', highway: 'residential', sidewalkRight: 'no' })).toEqual([1]);
    expect(sidewalkSides({ featureType: 'pedestrian', highway: 'steps' })).toEqual([]);
  });

  it('smooths a tight turn inside the 0.3 m source-node tolerance', () => {
    const line = smoothRoadCenterline([[0, 0], [5, 0], [5, 5]]);
    expect(line.length).toBeGreaterThan(3);
    const cornerPoints = line.filter((point) => point[0] >= 4.6 && point[0] <= 5.3 && point[1] >= -0.3 && point[1] <= 0.4);
    expect(cornerPoints.length).toBeGreaterThan(2);
    expect(Math.max(...cornerPoints.map((point) => Math.hypot(point[0] - 5, point[1])))).toBeLessThanOrEqual(0.3);
  });

  it('builds clipped road, sidewalk, intersection, markings, and sign batches', () => {
    const roads: ChunkFeature[] = [
      { id: 'w1', featureType: 'road', highway: 'residential', lanes: 2, sidewalk: 'both', nodeIds: [1, 2, 3], points: [[-7, 0], [0, 0], [7, 0]] },
      { id: 'w2', featureType: 'road', highway: 'residential', nodeIds: [4, 2], points: [[0, 7], [0, 0]] },
      { id: 'w3', featureType: 'road', highway: 'pedestrian', nodeIds: [5, 2], points: [[-5, -5], [0, 0]] },
      { id: 'cross', featureType: 'prop', kind: 'crossing', position: [0, 0.5] },
      { id: 'signal', featureType: 'prop', kind: 'traffic_signals', position: [0.2, 0] },
      { id: 'priority', featureType: 'prop', kind: 'give_way', position: [0, 0.1] },
    ];
    const built = buildRoadChunk(roads, terrain, bounds);
    expect(built.surfaces.map((surface) => surface.style)).toEqual(expect.arrayContaining(['asphalt', 'stone', 'concrete']));
    expect(built.triangleCount).toBeGreaterThan(20);
    expect(built.markings.indices.length).toBeGreaterThan(0);
    expect(built.colliderIndices.length).toBeGreaterThan(0);
    expect(built.props).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'traffic_signals' }),
      expect.objectContaining({ kind: 'give_way' }),
    ]));
    for (let offset = 0; offset < built.colliderPositions.length; offset += 3) {
      expect(built.colliderPositions[offset]).toBeGreaterThanOrEqual(-8 - 0.001);
      expect(built.colliderPositions[offset]).toBeLessThanOrEqual(8 + 0.001);
      expect(built.colliderPositions[offset + 2]).toBeGreaterThanOrEqual(-8 - 0.001);
      expect(built.colliderPositions[offset + 2]).toBeLessThanOrEqual(8 + 0.001);
    }
  });

  it('fills an OSM pedestrian area as paved plaza geometry', () => {
    const plaza = buildRoadChunk([{
      id: 'w100', featureType: 'pedestrian', highway: 'pedestrian', area: true, surface: 'paving_stones',
      points: [[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]],
    }], terrain, bounds);
    const stone = plaza.surfaces.find((surface) => surface.style === 'stone');
    expect(stone?.indices.length).toBe(6);
    let area = 0;
    for (let index = 0; index < (stone?.indices.length ?? 0); index += 3) {
      const a = (stone?.indices[index] ?? 0) * 3;
      const b = (stone?.indices[index + 1] ?? 0) * 3;
      const c = (stone?.indices[index + 2] ?? 0) * 3;
      const positions = stone?.positions;
      if (!positions) continue;
      const ax = positions[a] ?? 0;
      const az = positions[a + 2] ?? 0;
      const bx = positions[b] ?? 0;
      const bz = positions[b + 2] ?? 0;
      const cx = positions[c] ?? 0;
      const cz = positions[c + 2] ?? 0;
      area += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    }
    expect(area).toBeCloseTo(16, 3);
  });

  it('raises bridge decks with a smooth visual profile while keeping their collider mesh', () => {
    const bridge = buildRoadChunk([{
      id: 'w200', featureType: 'road', highway: 'residential', widthMeters: 4, bridge: true,
      points: [[-40, 0], [40, 0]],
    }], terrain, bounds);
    const asphalt = bridge.surfaces.find((surface) => surface.style === 'asphalt');
    expect(asphalt?.indices.length).toBeGreaterThan(0);
    for (let index = 0; index < (asphalt?.positions.length ?? 0); index += 3) {
      const x = asphalt?.positions[index] ?? 0;
      const y = asphalt?.positions[index + 1] ?? 0;
      const z = asphalt?.positions[index + 2] ?? 0;
      expect(y - sampleHeight(terrain, x, z)).toBeGreaterThan(1.5);
    }
    expect(bridge.colliderIndices.length).toBeGreaterThan(0);
  });

  it('turns highway=steps ways into individually elevated stone treads', () => {
    const steps = buildRoadChunk([{
      id: 'w300', featureType: 'pedestrian', highway: 'steps', incline: 'up', widthMeters: 1.6,
      points: [[0, -6], [0, 6]],
    }], terrain, bounds);
    const stone = steps.surfaces.find((surface) => surface.style === 'stone');
    const levels = new Set(Array.from({ length: (stone?.positions.length ?? 0) / 3 }, (_, index) => Math.round((stone?.positions[index * 3 + 1] ?? 0) * 100) / 100));
    expect(steps.triangleCount).toBeGreaterThan(60);
    expect(levels.size).toBeGreaterThan(10);
  });
});
