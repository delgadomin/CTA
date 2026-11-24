import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectEtrs89Utm29, projectedRegionBounds } from './projection.mjs';
import { optionValue } from './cli-args.mjs';
import { requestWithRetry } from './request-retry.mjs';
import { writeIfChanged } from './write-if-changed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const MAX_OSM_BYTES = 64 * 1024 * 1024;

export function makeOverpassQuery(bounds) {
  const box = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:120];(way[highway](${box});way[building](${box});way[landuse](${box});way[natural](${box});way[waterway](${box});way[leisure](${box});way[historic](${box});way[barrier=city_wall](${box});way[place=square](${box});way[shop](${box});way[craft](${box});way[office](${box});way[amenity](${box});way[tourism](${box});relation[historic](${box});node[shop](${box});node[craft](${box});node[office](${box});node[amenity](${box});node[tourism](${box});node[historic](${box});node[memorial](${box});node[place=square](${box});node[natural=tree](${box});node[highway~"traffic_signals|street_lamp|crossing|stop|give_way"](${box});node[traffic_sign](${box}););out body geom;`;
}

async function fetchWithRetry(query, fetchImpl = fetch) {
  const response = await requestWithRetry(() =>
    fetchImpl(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'CaceresCriminalDataBuilder/0.1',
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(150000),
    }),
  );
  if (!response.ok) throw new Error(`Overpass replied with HTTP ${response.status}.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Overpass returned no response body.');
  const parts = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.length;
    if (byteLength > MAX_OSM_BYTES) {
      await reader.cancel();
      throw new Error(`Overpass response exceeds ${MAX_OSM_BYTES} bytes.`);
    }
    parts.push(Buffer.from(value));
  }
  const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
  if (!Array.isArray(data.elements)) throw new Error('Overpass returned no OSM element list.');
  return data;
}

export async function getOsmData(regionName, region, { fresh = false, fetchImpl = fetch } = {}) {
  const rawPath = path.join(ROOT, 'data', 'raw', 'osm', `${regionName}.json`);
  if (!fresh) {
    try {
      return JSON.parse(await readFile(rawPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const center = projectEtrs89Utm29(region.origin.lon, region.origin.lat);
  const bounds = projectedRegionBounds(region.origin, region.extentMeters);
  const query = makeOverpassQuery(bounds);
  const data = await fetchWithRetry(query, fetchImpl);
  const serialized = JSON.stringify(data);
  await mkdir(path.dirname(rawPath), { recursive: true });
  await writeIfChanged(rawPath, serialized);
  await writeIfChanged(
    `${rawPath}.meta.json`,
    `${JSON.stringify(
      {
        source: OVERPASS_ENDPOINT,
        retrievedAt: new Date().toISOString(),
        querySha256: createHash('sha256').update(query).digest('hex'),
        payloadSha256: createHash('sha256').update(serialized).digest('hex'),
        bytes: Buffer.byteLength(serialized),
        originEtrs89Utm29: center,
        elementCount: data.elements.length,
      },
      null,
      2,
    )}\n`,
  );
  return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const regionName = optionValue(process.argv.slice(2), '--region', 'cc-monumental');
  const config = JSON.parse(await readFile(path.join(ROOT, 'tools/config/regions.json'), 'utf8'));
  const region = config[regionName];
  if (!region) throw new Error(`Unknown region: ${regionName}`);
  const data = await getOsmData(regionName, region, { fresh: process.argv.includes('--fresh') });
  console.info(`Cached ${data.elements.length} OSM elements for ${regionName}.`);
}
