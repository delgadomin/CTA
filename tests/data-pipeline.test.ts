import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAsciiElevation } from '../tools/elevation.mjs';
import { normalizeOsm } from '../tools/normalize-data.mjs';
import { projectEtrs89Utm29, unprojectEtrs89Utm29 } from '../tools/projection.mjs';
import { makeOverpassQuery } from '../tools/fetch-osm.mjs';
import { optionValue } from '../tools/cli-args.mjs';
import { requestWithRetry } from '../tools/request-retry.mjs';
import { writeIfChanged } from '../tools/write-if-changed.mjs';

const region = {
  origin: { lat: 39.474414, lon: -6.371556 },
  extentMeters: 1000,
  chunkMeters: 256,
  heightGrid: { samples: 3, stepMeters: 2, quantizationMeters: 0.25 },
};
const blocklist = {
  brands: [{ aliases: ['Mercadona'], gameName: 'MercaRoba' }],
};
const temporaryFiles: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryFiles.splice(0).map((filePath) => rm(filePath, { force: true })));
});

describe('EPSG:25829 projection helpers', () => {
  it('round-trips the Plaza Mayor origin within sub-metre error', () => {
    const projected = projectEtrs89Utm29(region.origin.lon, region.origin.lat);
    const restored = unprojectEtrs89Utm29(projected.easting, projected.northing);
    expect(restored.lon).toBeCloseTo(region.origin.lon, 7);
    expect(restored.lat).toBeCloseTo(region.origin.lat, 7);
    expect(projected.easting).toBeGreaterThan(500000);
    expect(projected.northing).toBeGreaterThan(4000000);
  });
});

describe('pipeline command and request helpers', () => {
  it('accepts both documented region argument forms', () => {
    expect(optionValue(['--region', 'cc-monumental'], '--region', 'fallback')).toBe(
      'cc-monumental',
    );
    expect(optionValue(['--region=centro'], '--region', 'fallback')).toBe('centro');
    expect(optionValue(['--region'], '--region', 'fallback')).toBe('fallback');
  });

  it('honors Retry-After when a service temporarily rejects a request', async () => {
    const delays: number[] = [];
    let calls = 0;
    const response = await requestWithRetry(
      async () => {
        calls += 1;
        return calls === 1
          ? new Response('busy', { status: 503, headers: { 'retry-after': '2' } })
          : new Response('ready', { status: 200 });
      },
      { wait: async (milliseconds) => delays.push(milliseconds) },
    );

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
    expect(delays).toEqual([2000]);
  });

  it('writes generated files atomically and skips identical content', async () => {
    const filePath = path.join(os.tmpdir(), `caceres-output-${Date.now()}.txt`);
    temporaryFiles.push(filePath);

    expect(await writeIfChanged(filePath, 'stable output')).toBe(true);
    expect(await writeIfChanged(filePath, 'stable output')).toBe(false);
    expect(await readFile(filePath, 'utf8')).toBe('stable output');
  });
});

describe('ESRI ASCII elevation reader', () => {
  it('crops and bilinearly samples only the requested grid area', async () => {
    const center = projectEtrs89Utm29(region.origin.lon, region.origin.lat);
    const rows = Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 5 }, (_, column) => 100 + row * 10 + column).join(' '),
    );
    const filePath = path.join(os.tmpdir(), `caceres-elevation-${Date.now()}.asc`);
    temporaryFiles.push(filePath);
    await writeFile(
      filePath,
      [
        'ncols 5',
        'nrows 5',
        `xllcorner ${center.easting - 12.5}`,
        `yllcorner ${center.northing - 12.5}`,
        'cellsize 5',
        'NODATA_value -9999',
        ...rows,
        '',
      ].join('\n'),
    );
    const source = await loadAsciiElevation(filePath, center, 4);
    expect(source.sample(0, 0)).toBeCloseTo(122, 6);
    expect(source.sample(5000, 5000)).toBeNull();
  });

  it('reads the IGN WCS ASCII grid with separate dx and dy and clamps edge samples', async () => {
    const filePath = path.join(os.tmpdir(), `caceres-wcs-elevation-${Date.now()}.asc`);
    temporaryFiles.push(filePath);
    await writeFile(
      filePath,
      [
        'ncols 2',
        'nrows 2',
        'xllcorner 0',
        'yllcorner 0',
        'dx 2',
        'dy 4',
        '10 20',
        '30 40',
        '',
      ].join('\n'),
    );
    const source = await loadAsciiElevation(filePath, { easting: 0, northing: 0 }, 4);
    expect(source.sample(2, 4)).toBeCloseTo(25, 6);
    expect(source.sample(0, 0)).toBeCloseTo(30, 6);
    expect(source.sample(-0.1, 0)).toBeNull();
  });
});

describe('OSM normalization and brand scrubber', () => {
  it('converts building and road geometry, retaining navigation tags but removing source business names', () => {
    const osm = {
      elements: [
        {
          type: 'way',
          id: 10,
          nodes: [101, 102],
          tags: {
            highway: 'residential',
            name: 'Calle Ejemplo',
            lanes: '2',
            oneway: 'yes',
            surface: 'asphalt',
            sidewalk: 'both',
            width: '5.5',
            bridge: 'yes',
          },
          geometry: [
            { lon: -6.371556, lat: 39.474414 },
            { lon: -6.3714, lat: 39.4745 },
          ],
        },
        {
          type: 'way',
          id: 11,
          nodes: [111, 112, 113, 111],
          tags: { highway: 'pedestrian', area: 'yes', surface: 'paving_stones' },
          geometry: [
            { lon: -6.37156, lat: 39.47441 },
            { lon: -6.3715, lat: 39.47441 },
            { lon: -6.3715, lat: 39.47448 },
            { lon: -6.37156, lat: 39.47441 },
          ],
        },
        {
          type: 'way',
          id: 20,
          tags: {
            building: 'yes',
            'building:levels': '3',
            shop: 'clothes',
            name: 'Example Outfitters',
          },
          geometry: [
            { lon: -6.37156, lat: 39.47441 },
            { lon: -6.3715, lat: 39.47442 },
            { lon: -6.3715, lat: 39.47448 },
            { lon: -6.37156, lat: 39.47441 },
          ],
        },
        {
          type: 'node',
          id: 30,
          lat: 39.474414,
          lon: -6.371556,
          tags: { shop: 'supermarket', brand: 'Mercadona', name: 'Mercadona' },
        },
        {
          type: 'node',
          id: 40,
          lat: 39.474414,
          lon: -6.371556,
          tags: { historic: 'tower', name: 'Torre de Prueba' },
        },
        { type: 'node', id: 50, lat: 39.474414, lon: -6.371556, tags: { amenity: 'bench' } },
        { type: 'node', id: 60, lat: 39.474414, lon: -6.371556, tags: { natural: 'tree' } },
        { type: 'node', id: 70, lat: 39.474414, lon: -6.371556, tags: { highway: 'stop' } },
        { type: 'node', id: 71, lat: 39.474414, lon: -6.371556, tags: { traffic_sign: 'DE:205' } },
      ],
    };
    const data = normalizeOsm(osm, region, blocklist, { sample: () => 420 });
    const serialized = JSON.stringify(data);
    expect(data.roads[0]?.name).toBe('Calle Ejemplo');
    expect(data.roads[0]).toMatchObject({
      nodeIds: [101, 102],
      lanes: 2,
      oneway: 1,
      surface: 'asphalt',
      sidewalk: 'both',
      widthMeters: 5.5,
      bridge: true,
    });
    expect(data.roads.find((road) => road.id === 'w11')).toMatchObject({
      area: true,
      highway: 'pedestrian',
      surface: 'paving_stones',
    });
    expect(data.buildings[0]?.floors).toBe(3);
    expect(data.buildings[0]).toMatchObject({
      id: 'w20',
      heightMeters: null,
      visualFloors: 3,
      visualHeightMeters: 9,
      zone: 'casco',
      commercial: true,
      roofMaterial: 'tile',
    });
    expect(data.chunks).toHaveLength(16);
    expect(data.pois.find((poi) => poi.id === 'w20')?.name).not.toBe('Example Outfitters');
    expect(data.pois.find((poi) => poi.id === 'n30')?.name).toBe('MercaRoba');
    expect(data.pois.find((poi) => poi.id === 'n40')?.name).toBe('Torre de Prueba');
    expect(data.props.map((prop) => prop.kind)).toEqual(['bench', 'tree', 'stop', 'traffic_sign']);
    expect(data.props[3]?.trafficSign).toBe('DE:205');
    expect(serialized).not.toContain('Mercadona');
    expect(serialized).not.toContain('Example Outfitters');
  });

  it('requests stop, give-way and traffic-sign nodes from Overpass', () => {
    const query = makeOverpassQuery({ south: 39, west: -7, north: 40, east: -6 });
    expect(query).toContain('node[highway~"traffic_signals|street_lamp|crossing|stop|give_way"]');
    expect(query).toContain('node[traffic_sign]');
  });

  it('keeps absent terrain as nodata instead of fabricating a height', () => {
    const osm = { elements: [] };
    const data = normalizeOsm(osm, region, blocklist, { sample: () => null });
    expect(data.issues.missingTerrainSamples).toBe(data.chunks.length * 9);
    expect(data.chunks[0]?.terrain.heights).toContain(-32768);
  });
});
