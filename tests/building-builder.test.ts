import { describe, expect, it } from 'vitest';
import { buildBuildingChunk, roofShapeFor } from '../src/world/building-builder';
import { buildTerrainChunk } from '../src/world/mesh-builder';
import type { ChunkFeature, RawTerrainChunk } from '../src/world/types';

const bounds = { minX: -8, minZ: -8, maxX: 8, maxZ: 8 };
const terrain = buildTerrainChunk({
  id: '0_0',
  bounds,
  terrain: {
    samples: 5,
    stepMeters: 4,
    quantizationMeters: 0.25,
    heights: Array.from({ length: 25 }, () => 1600),
  },
  features: [],
} satisfies RawTerrainChunk);

const commercialBuilding: ChunkFeature = {
  id: 'w200',
  featureType: 'building',
  zone: 'casco',
  visualFloors: 3,
  visualHeightMeters: 9,
  roofHeightMeters: 1,
  roofShape: 'gabled',
  roofMaterial: 'tile',
  commercial: true,
  commercialCategory: 'shop:bakery',
  points: [
    [-2, -2],
    [2, -2],
    [2, 2],
    [-2, 2],
    [-2, -2],
  ],
};
const road: ChunkFeature = {
  id: 'w1',
  featureType: 'road',
  highway: 'residential',
  points: [
    [-8, -3],
    [8, -3],
  ],
};

describe('building geometry', () => {
  it('builds three progressively lighter merged LODs and stable chunk-local geometry', () => {
    const features = [commercialBuilding, road];
    const first = buildBuildingChunk(features, terrain, bounds);
    const second = buildBuildingChunk(features, terrain, bounds);
    expect(first.levels).toHaveLength(3);
    const detailed = first.levels[0]?.triangleCount ?? 0;
    expect(detailed).toBeGreaterThan(first.levels[1]?.triangleCount ?? 0);
    // The far LOD keeps the inferred roof shape and can exceed the flat-roofed
    // middle LOD by a couple of triangles; both stay far below full detail.
    expect(first.levels[1]?.triangleCount ?? 0).toBeLessThan(detailed / 2);
    expect(first.levels[2]?.triangleCount ?? 0).toBeLessThan(detailed / 2);
    expect(first.levels[0]?.surfaces.map((surface) => surface.material)).toEqual([
      'casco_facade',
      'tile_roof',
    ]);
    expect(Array.from(first.levels[0]?.surfaces[0]?.positions ?? [])).toEqual(
      Array.from(second.levels[0]?.surfaces[0]?.positions ?? []),
    );
    expect(first.colliderIndices.length).toBeGreaterThan(0);
    for (let index = 0; index < first.colliderPositions.length; index += 3) {
      expect(first.colliderPositions[index]).toBeGreaterThanOrEqual(-8.001);
      expect(first.colliderPositions[index]).toBeLessThanOrEqual(8.001);
      expect(first.colliderPositions[index + 2]).toBeGreaterThanOrEqual(-8.001);
      expect(first.colliderPositions[index + 2]).toBeLessThanOrEqual(8.001);
    }
  });

  it('reserves the closest street-facing sign slot and a historic roof anchor', () => {
    const built = buildBuildingChunk([commercialBuilding, road], terrain, bounds);
    expect(built.signSlots).toEqual([
      expect.objectContaining({ buildingId: 'w200', category: 'shop:bakery', width: 2.8 }),
    ]);
    expect(built.signSlots[0]?.position[2]).toBeCloseTo(-2);
    expect(built.roofAnchors).toEqual([
      expect.objectContaining({ buildingId: 'w200', roofShape: 'gabled' }),
    ]);
    expect(built.roofAnchors[0]?.position[1]).toBeCloseTo(409);
  });

  it('uses roof tags when known and a footprint heuristic otherwise', () => {
    expect(
      roofShapeFor({ featureType: 'building', roofShape: 'flat' }, [
        [0, 0],
        [4, 0],
        [4, 2],
        [0, 2],
      ]),
    ).toBe('flat');
    expect(
      roofShapeFor({ featureType: 'building', roofShape: 'unknown' }, [
        [0, 0],
        [8, 0],
        [8, 2],
        [0, 2],
      ]),
    ).toBe('gabled');
    expect(
      roofShapeFor({ featureType: 'building' }, [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    ).toBe('hipped');
  });

  it('keeps validated landmark replacements stable by their OSM id', () => {
    const feature = { ...commercialBuilding, landmarkModelPath: 'landmarks/w200.glb' };
    const built = buildBuildingChunk([feature, road], terrain, bounds);
    expect(built.landmarkModels).toEqual([
      { buildingId: 'w200', path: 'landmarks/w200.glb', position: [0, 400, 0] },
    ]);
    expect(built.levels[0]?.triangleCount).toBe(0);
  });
});
