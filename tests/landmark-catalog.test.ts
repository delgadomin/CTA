import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildLandmarkDataset, writeLandmarkDataset } from '../tools/landmark-catalog.mjs';
import { projectEtrs89Utm29 } from '../tools/projection.mjs';

const origin = projectEtrs89Utm29(-6.371556, 39.474414);
const sourceWay = {
  type: 'way',
  id: 42,
  tags: { name: 'Casa de Prueba', building: 'yes', 'building:levels': '3' },
  geometry: [
    { lon: -6.371556, lat: 39.474414 },
    { lon: -6.371546, lat: 39.474414 },
    { lon: -6.371546, lat: 39.474424 },
    { lon: -6.371556, lat: 39.474414 },
  ],
};
const targets = [
  {
    id: 'casa',
    name: 'Casa de Prueba',
    scope: 'cc-monumental',
    aliases: [],
    keyFeatures: ['Fachada por revisar.'],
    references: [],
  },
  {
    id: 'parque',
    name: 'Parque fuera',
    scope: 'ciudad',
    aliases: [],
    keyFeatures: [],
    references: [],
  },
];
const features = [
  {
    id: 'w42',
    featureType: 'building',
    name: 'Casa de Prueba',
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
    visualHeightMeters: 9,
  },
];
const temporaryRoots: string[] = [];

afterEach(async () =>
  Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe('landmark catalog generation', () => {
  it('derives positions, footprints, and level-based height from OSM source geometry', () => {
    const dataset = buildLandmarkDataset(targets, features, [sourceWay], origin, 'cc-monumental');
    const house = dataset.landmarks[0];
    const outOfScope = dataset.landmarks[1];
    expect(house?.sourceIds).toEqual(['w42']);
    expect(house?.position?.lat).toBeCloseTo(39.4744165, 7);
    expect(house?.heightMeters).toBeNull();
    expect(house?.heightFromLevelsMeters).toBe(9);
    expect(house?.footprintLocalMeters?.[0]).toHaveLength(4);
    expect(house?.status).toBe('pending-human-review');
    expect(outOfScope?.position).toBeNull();
    expect(outOfScope?.status).toBe('out-of-scope');
  });

  it('initializes pending status without overwriting a human approval', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cta-landmark-catalog-'));
    temporaryRoots.push(root);
    const dataset = buildLandmarkDataset(targets, features, [sourceWay], origin, 'cc-monumental');
    await writeLandmarkDataset(root, dataset);
    const statusPath = path.join(root, 'data/landmarks/status.json');
    const first = JSON.parse(await readFile(statusPath, 'utf8'));
    expect(first.landmarks.casa.status).toBe('pending');
    first.landmarks.casa = { status: 'approved', reviewer: 'human' };
    await writeFile(statusPath, JSON.stringify(first), 'utf8');
    await writeLandmarkDataset(root, dataset);
    const saved = JSON.parse(await readFile(statusPath, 'utf8'));
    expect(saved.landmarks.casa).toEqual({ status: 'approved', reviewer: 'human' });
    expect(saved.landmarks.parque.status).toBe('pending');
  });
});
