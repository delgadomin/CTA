import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestWithRetry } from './request-retry.mjs';
import { writeIfChanged } from './write-if-changed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CATASTRO_WFS_ENDPOINT = 'https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx';
const LICENSE_URL = 'https://www.catastro.hacienda.gob.es/webinspire/documentos/Licencia.pdf';
// Small requests stay well below the documented limit and are more reliable live.
const TILE_EDGE_METERS = 250;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_FEATURES = 5000;
const MAX_SPLIT_DEPTH = 3;
const REQUEST_INTERVAL_MS = 350;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function parseFeatureMember(member, origin) {
  const polygon = member.match(/<gml:exterior\b[^>]*>([\s\S]*?)<\/gml:exterior>/i)?.[1];
  const posList = polygon?.match(/<gml:posList\b[^>]*>([\s\S]*?)<\/gml:posList>/i)?.[1];
  if (!posList) return undefined;
  const values = posList.trim().split(/\s+/).map(Number);
  if (
    values.length < 6 ||
    values.length % 2 !== 0 ||
    values.some((value) => !Number.isFinite(value))
  )
    return undefined;
  const points = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push([values[index] - origin.easting, values[index + 1] - origin.northing]);
  }
  if (points.length > 3 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1])
    points.pop();
  return points.length >= 3 ? points : undefined;
}

export function parseCatastroBuildings(xml, origin) {
  if (/ExceptionReport|ServiceException/i.test(xml))
    throw new Error('Catastro WFS returned an exception document instead of building data.');
  const features = new Map();
  for (const [, member] of xml.matchAll(
    /<gml:featureMember\b[^>]*>([\s\S]*?)<\/gml:featureMember>/gi,
  )) {
    const id = member.match(/\bgml:id="([^"]+)"/i)?.[1];
    const points = parseFeatureMember(member, origin);
    if (id && points) features.set(id, { points });
  }
  return [...features.entries()].map(([id, feature]) => ({ id, ...feature }));
}

export function createCatastroTiles(region, origin) {
  const half = region.extentMeters / 2;
  const tiles = [];
  for (let minX = -half; minX < half; minX += TILE_EDGE_METERS) {
    for (let minZ = -half; minZ < half; minZ += TILE_EDGE_METERS) {
      const maxX = Math.min(half, minX + TILE_EDGE_METERS);
      const maxZ = Math.min(half, minZ + TILE_EDGE_METERS);
      tiles.push({
        minX: origin.easting + minX,
        minY: origin.northing + minZ,
        maxX: origin.easting + maxX,
        maxY: origin.northing + maxZ,
      });
    }
  }
  return tiles;
}

function tileName(bounds, origin) {
  const x = Math.round(bounds.minX - origin.easting);
  const z = Math.round(bounds.minY - origin.northing);
  const width = Math.round(bounds.maxX - bounds.minX);
  const height = Math.round(bounds.maxY - bounds.minY);
  return `${x}_${z}_${width}x${height}`;
}

function splitBounds(bounds) {
  const middleX = (bounds.minX + bounds.maxX) / 2;
  const middleY = (bounds.minY + bounds.maxY) / 2;
  return [
    { ...bounds, maxX: middleX, maxY: middleY },
    { ...bounds, minX: middleX, maxY: middleY },
    { ...bounds, maxX: middleX, minY: middleY },
    { ...bounds, minX: middleX, minY: middleY },
  ];
}

function featureCount(xml) {
  return [...xml.matchAll(/<gml:featureMember\b/gi)].length;
}

async function hasCachedChildren(cacheDirectory, bounds, origin) {
  const files = await readdir(cacheDirectory);
  return files.some((fileName) => {
    const match = fileName.match(/^(-?\d+)_(-?\d+)_(\d+)x(\d+)\.gml$/);
    if (!match) return false;
    const [minX, minY, width, height] = match.slice(1).map(Number);
    return (
      width < bounds.maxX - bounds.minX &&
      height < bounds.maxY - bounds.minY &&
      origin.easting + minX >= bounds.minX &&
      origin.northing + minY >= bounds.minY &&
      origin.easting + minX + width <= bounds.maxX &&
      origin.northing + minY + height <= bounds.maxY
    );
  });
}

async function collectSplitChildren(
  bounds,
  depth,
  cacheDirectory,
  origin,
  fetchImpl,
  results,
  fresh,
) {
  let leafCount = 0;
  for (const child of splitBounds(bounds))
    leafCount += await collectTile(
      child,
      depth + 1,
      cacheDirectory,
      origin,
      fetchImpl,
      results,
      fresh,
    );
  return leafCount;
}

function requestUrl(bounds) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typenames: 'BU.BUILDING',
    bbox: `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY},EPSG:25829`,
    srsName: 'EPSG::25829',
  });
  return `${CATASTRO_WFS_ENDPOINT}?${params}`;
}

async function downloadTile(bounds, destination, fetchImpl) {
  await wait(REQUEST_INTERVAL_MS);
  const url = requestUrl(bounds);
  let response;
  let bytes;
  try {
    response = await requestWithRetry(
      () =>
        fetchImpl(url, {
          headers: { 'user-agent': 'CaceresCriminalDataBuilder/0.1' },
          signal: AbortSignal.timeout(20_000),
        }),
      { attempts: 2 },
    );
    if (response.ok) bytes = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return { split: true };
    throw error;
  }
  if (!response.ok) throw new Error(`Catastro WFS replied with HTTP ${response.status}.`);
  if (bytes.byteLength > MAX_RESPONSE_BYTES) return { split: true };
  const xml = new TextDecoder('iso-8859-1').decode(bytes);
  const count = featureCount(xml);
  if (/ExceptionReport|ServiceException/i.test(xml)) {
    if (/Area of extension out of limits|too many|limit exceeded/i.test(xml))
      return { split: true };
    throw new Error('Catastro WFS rejected the bounded building query.');
  }
  if (count >= MAX_FEATURES) return { split: true };
  await writeIfChanged(destination, bytes);
  await writeIfChanged(
    `${destination}.meta.json`,
    `${JSON.stringify(
      {
        source: CATASTRO_WFS_ENDPOINT,
        licenseUrl: LICENSE_URL,
        retrievedAt: new Date().toISOString(),
        bounds: {
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
        },
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.byteLength,
        buildings: count,
      },
      null,
      2,
    )}\n`,
  );
  return { split: false, count };
}

async function collectTile(bounds, depth, cacheDirectory, origin, fetchImpl, results, fresh) {
  const name = tileName(bounds, origin);
  const cachePath = path.join(cacheDirectory, `${name}.gml`);
  const splitPath = `${cachePath}.split.json`;
  if (!fresh) {
    try {
      const splitMarker = JSON.parse(await readFile(splitPath, 'utf8'));
      if (splitMarker.split === true) {
        if (depth >= MAX_SPLIT_DEPTH)
          throw new Error('Catastro split cache exceeds the configured depth limit.');
        return collectSplitChildren(
          bounds,
          depth,
          cacheDirectory,
          origin,
          fetchImpl,
          results,
          fresh,
        );
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!fresh && (await hasCachedChildren(cacheDirectory, bounds, origin))) {
    await writeIfChanged(splitPath, `${JSON.stringify({ split: true, bounds }, null, 2)}\n`);
    if (depth >= MAX_SPLIT_DEPTH)
      throw new Error('Cached Catastro subdivision exceeds the configured depth limit.');
    return collectSplitChildren(bounds, depth, cacheDirectory, origin, fetchImpl, results, fresh);
  }
  let xml;
  if (!fresh) {
    try {
      xml = await readFile(cachePath, 'latin1');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (xml === undefined) {
    const response = await downloadTile(bounds, cachePath, fetchImpl);
    if (response.split) {
      await unlink(cachePath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      await unlink(`${cachePath}.meta.json`).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      if (depth >= MAX_SPLIT_DEPTH)
        throw new Error(`Catastro WFS still exceeds ${MAX_FEATURES} buildings after subdivision.`);
      await writeIfChanged(splitPath, `${JSON.stringify({ split: true, bounds }, null, 2)}\n`);
      return collectSplitChildren(bounds, depth, cacheDirectory, origin, fetchImpl, results, fresh);
    }
    await unlink(splitPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    xml = await readFile(cachePath, 'latin1');
  }
  const parsed = parseCatastroBuildings(xml, origin);
  for (const feature of parsed) results.set(feature.id, { points: feature.points });
  return 1;
}

export async function getCatastroBuildingReference(
  regionName,
  region,
  projectedOrigin,
  { fetchImpl = fetch, fresh = false } = {},
) {
  if (!Number.isFinite(projectedOrigin?.easting) || !Number.isFinite(projectedOrigin?.northing))
    throw new Error('Catastro reference requires a projected region origin.');
  const cacheDirectory = path.join(ROOT, 'data/raw/catastro', regionName);
  await mkdir(cacheDirectory, { recursive: true });
  const features = new Map();
  const referenceExtentMeters = region.catastroReferenceExtentMeters ?? region.extentMeters;
  const tiles = createCatastroTiles({ extentMeters: referenceExtentMeters }, projectedOrigin);
  let tileCount = 0;
  for (const bounds of tiles)
    tileCount += await collectTile(
      bounds,
      0,
      cacheDirectory,
      projectedOrigin,
      fetchImpl,
      features,
      fresh,
    );
  const buildings = [...features.values()]
    .map((building) => ({ building, key: JSON.stringify(building.points) }))
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(({ building }) => building);
  if (buildings.length === 0)
    throw new Error(`Catastro WFS returned no building footprints for ${regionName}.`);
  return {
    buildings,
    tileCount,
    extentMeters: referenceExtentMeters,
    source: CATASTRO_WFS_ENDPOINT,
    licenseUrl: LICENSE_URL,
    sha256: createHash('sha256').update(JSON.stringify(buildings)).digest('hex'),
  };
}

function centroid(points) {
  let doubleArea = 0;
  let weightedX = 0;
  let weightedZ = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current[0] * next[1] - next[0] * current[1];
    doubleArea += cross;
    weightedX += (current[0] + next[0]) * cross;
    weightedZ += (current[1] + next[1]) * cross;
  }
  if (Math.abs(doubleArea) < 1e-6)
    return points.reduce(
      (sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length],
      [0, 0],
    );
  return [weightedX / (3 * doubleArea), weightedZ / (3 * doubleArea)];
}

export function compareBuildingCentroids(
  referenceBuildings,
  osmBuildings,
  toleranceMeters = 10,
  extentMeters = Infinity,
) {
  const cellSize = toleranceMeters;
  const halfExtent = extentMeters / 2;
  const cells = new Map();
  let osmCount = 0;
  for (const building of osmBuildings) {
    const center = centroid(building.points);
    if (Math.abs(center[0]) > halfExtent || Math.abs(center[1]) > halfExtent) continue;
    osmCount += 1;
    const key = `${Math.floor(center[0] / cellSize)},${Math.floor(center[1] / cellSize)}`;
    const members = cells.get(key) ?? [];
    members.push(center);
    cells.set(key, members);
  }
  let matched = 0;
  for (const building of referenceBuildings) {
    const [x, z] = centroid(building.points);
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    let nearest = Infinity;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (const [osmX, osmZ] of cells.get(`${cellX + dx},${cellZ + dz}`) ?? [])
          nearest = Math.min(nearest, Math.hypot(x - osmX, z - osmZ));
      }
    }
    if (nearest <= toleranceMeters) matched += 1;
  }
  return {
    referenceCount: referenceBuildings.length,
    osmCount,
    matched,
    toleranceMeters,
  };
}
