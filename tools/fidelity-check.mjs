import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { projectEtrs89Utm29 } from './projection.mjs';
import { optionValue } from './cli-args.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionName = optionValue(process.argv.slice(2), '--region', 'cc-monumental');
const tolerance = Number.parseFloat(
  process.argv.find((argument) => argument.startsWith('--tolerance='))?.split('=')[1] ?? '1',
);
const pedestrianTypes = new Set(['footway', 'pedestrian', 'steps', 'ladder', 'path', 'bridleway']);
if (!Number.isFinite(tolerance) || tolerance < 0)
  throw new Error('Fidelity tolerance must be a non-negative number of meters.');

const regions = JSON.parse(await readFile(path.join(ROOT, 'tools/config/regions.json'), 'utf8'));
const region = regions[regionName];
if (!region) throw new Error(`Unknown region: ${regionName}`);
const sourcePath = path.join(ROOT, 'data/raw/osm', `${regionName}.json`);
const worldPath = path.join(ROOT, 'public/world', regionName);
const manifest = JSON.parse(await readFile(path.join(worldPath, 'manifest.json'), 'utf8'));
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const landmarkDataset = JSON.parse(
  await readFile(path.join(ROOT, 'data/landmarks/landmarks.json'), 'utf8'),
);
const landmarkStatus = JSON.parse(
  await readFile(path.join(ROOT, 'data/landmarks/status.json'), 'utf8'),
);
const origin = projectEtrs89Utm29(region.origin.lon, region.origin.lat);

function sourceFeature(element) {
  if (element.type !== 'way' || !Array.isArray(element.geometry)) return undefined;
  const tags = element.tags ?? {};
  const featureType = tags.highway
    ? pedestrianTypes.has(tags.highway)
      ? 'pedestrian'
      : 'road'
    : tags.building && tags.building !== 'no'
      ? 'building'
      : undefined;
  if (!featureType) return undefined;
  return {
    id: `w${element.id}`,
    featureType,
    points: element.geometry.map((point) => {
      const projected = projectEtrs89Utm29(point.lon, point.lat);
      return [projected.easting - origin.easting, projected.northing - origin.northing];
    }),
  };
}

function intersectsWorld(points) {
  if (points.length === 0) return false;
  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const minZ = Math.min(...points.map((point) => point[1]));
  const maxZ = Math.max(...points.map((point) => point[1]));
  return manifest.chunks.some(
    (chunk) =>
      maxX >= chunk.bounds.minX &&
      minX <= chunk.bounds.maxX &&
      maxZ >= chunk.bounds.minZ &&
      minZ <= chunk.bounds.maxZ,
  );
}

function indexFeatures(features, label) {
  const indexed = new Map();
  for (const feature of features) {
    if (!['road', 'pedestrian', 'building'].includes(feature.featureType)) continue;
    if (typeof feature.id !== 'string' || !Array.isArray(feature.points))
      throw new Error(`${label} contains geometry without a stable OSM id.`);
    const prior = indexed.get(feature.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(feature))
      throw new Error(`${label} changes geometry for ${feature.id} between chunks.`);
    indexed.set(feature.id, feature);
  }
  return indexed;
}

const sourceFeatures = source.elements
  .map(sourceFeature)
  .filter((feature) => feature && intersectsWorld(feature.points));
const generatedFeatures = [];
for (const chunk of manifest.chunks) {
  const binary = await readFile(path.join(worldPath, chunk.path));
  if (binary.toString('ascii', 0, 4) !== 'CTA2')
    throw new Error(`Invalid chunk header: ${chunk.path}`);
  const payload = JSON.parse(
    inflateSync(binary.subarray(12), { maxOutputLength: 16 * 1024 * 1024 }).toString('utf8'),
  );
  generatedFeatures.push(...payload.features);
}
const expected = indexFeatures(sourceFeatures, 'OSM source');
const actual = indexFeatures(generatedFeatures, 'Generated world');
const missing = [...expected.keys()].filter((id) => !actual.has(id));
const extra = [...actual.keys()].filter((id) => !expected.has(id));
let maximumDeviation = 0;
const deviations = [];
for (const [id, sourceFeatureItem] of expected) {
  const generated = actual.get(id);
  if (!generated) continue;
  if (
    generated.featureType !== sourceFeatureItem.featureType ||
    generated.points.length !== sourceFeatureItem.points.length
  ) {
    deviations.push(`${id}: source and generated geometry shape differ`);
    continue;
  }
  for (let index = 0; index < sourceFeatureItem.points.length; index += 1) {
    const sourcePoint = sourceFeatureItem.points[index];
    const generatedPoint = generated.points[index];
    if (!sourcePoint || !generatedPoint) continue;
    const error = Math.hypot(
      sourcePoint[0] - generatedPoint[0],
      sourcePoint[1] - generatedPoint[1],
    );
    maximumDeviation = Math.max(maximumDeviation, error);
    if (error > tolerance) deviations.push(`${id}[${index}]: ${error.toFixed(3)} m`);
  }
}
const pendingApprovals = landmarkDataset.landmarks.filter(
  (landmark) =>
    landmark.scope === regionName && landmarkStatus.landmarks?.[landmark.id]?.status !== 'approved',
);
if (missing.length || extra.length || deviations.length) {
  throw new Error(
    [
      `Fidelity check failed for ${regionName} (tolerance ${tolerance} m).`,
      `Missing generated IDs: ${missing.slice(0, 12).join(', ') || 'none'}${missing.length > 12 ? ', …' : ''}.`,
      `Unexpected generated IDs: ${extra.slice(0, 12).join(', ') || 'none'}${extra.length > 12 ? ', …' : ''}.`,
      `Geometry differences: ${deviations.slice(0, 12).join('; ') || 'none'}${deviations.length > 12 ? '; …' : ''}.`,
    ].join('\n'),
  );
}

const report = [
  `# Fidelity check — ${regionName}`,
  '',
  `Tolerance: ${tolerance.toFixed(2)} m.`,
  `Road centerlines: ${[...expected.values()].filter((feature) => feature.featureType !== 'building').length}.`,
  `Building footprints: ${[...expected.values()].filter((feature) => feature.featureType === 'building').length}.`,
  `Maximum projected vertex deviation: ${maximumDeviation.toFixed(4)} m.`,
  `Human approvals pending: ${pendingApprovals.length}.`,
  ...(pendingApprovals.length
    ? pendingApprovals.map((landmark) => `- ${landmark.name} (${landmark.id})`)
    : ['All in-region landmarks have human approval.']),
  'Result: PASS.',
  '',
  'Comparison projects the cached OSM way coordinates and serialized chunk geometry to EPSG:25829 local meters; every road and building vertex must match within tolerance.',
  '',
].join('\n');
await mkdir(path.join(ROOT, 'reports'), { recursive: true });
await writeFile(path.join(ROOT, 'reports/fidelity-check.md'), report, 'utf8');
console.info(
  `Fidelity PASS: ${expected.size} source ways, max deviation ${maximumDeviation.toFixed(4)} m (limit ${tolerance.toFixed(2)} m).`,
);
