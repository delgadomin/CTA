import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { loadAsciiElevation } from './elevation.mjs';
import { fetchElevation } from './fetch-elevation.mjs';
import { getOsmData } from './fetch-osm.mjs';
import { normalizeOsm, resolveRegion } from './normalize-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionName = process.argv.find((argument) => argument.startsWith('--region='))?.split('=')[1] ?? 'cc-monumental';
const forceDownload = process.argv.includes('--fresh');
const config = JSON.parse(await readFile(path.join(ROOT, 'tools/config/regions.json'), 'utf8'));
const regionDefinition = config[regionName];
if (!regionDefinition) throw new Error(`Unknown region: ${regionName}`);

const elevationPath = path.join(ROOT, 'data/raw/elevation', `${regionName}.asc`);
const projectionPath = path.join(ROOT, 'data/raw/elevation', `${regionName}.prj`);
if (forceDownload) await fetchElevation(regionName, regionDefinition);
else {
  try {
    await access(elevationPath);
  } catch {
    console.info(`No cached terrain for ${regionName}; downloading a bounded IGN/CNIG MDT05 tile.`);
    await fetchElevation(regionName, regionDefinition);
  }
}
try {
  const projectionText = await readFile(projectionPath, 'utf8');
  if (!/25829|UTM_Zone_29N/i.test(projectionText)) {
    throw new Error(`${projectionPath} must identify ETRS89 / UTM zone 29N (EPSG:25829).`);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  throw new Error([
    `Terrain source is missing: ${elevationPath}`,
    'Get the IGN/CNIG MDT05 elevation coverage for Cáceres and export it as an ESRI ASCII grid.',
    `Save the grid as ${regionName}.asc and its projection sidecar as ${regionName}.prj in data/raw/elevation/.`,
    'The sidecar must identify ETRS89 / UTM zone 29N (EPSG:25829). The build stops here to avoid invented heights.',
  ].join('\n'));
}

const osm = await getOsmData(regionName, regionDefinition, { fresh: forceDownload });
if (osm.elements.length === 0) throw new Error(`OpenStreetMap returned no features for ${regionName}.`);
const osmRaw = await readFile(path.join(ROOT, 'data/raw/osm', `${regionName}.json`));
const osmSha256 = createHash('sha256').update(osmRaw).digest('hex');
const resolvedRegion = resolveRegion(regionDefinition);
const elevation = await loadAsciiElevation(elevationPath, resolvedRegion.origin, regionDefinition.extentMeters, regionDefinition.chunkMeters);
const brandBlocklist = JSON.parse(await readFile(path.join(ROOT, 'tools/brand-blocklist.json'), 'utf8'));
const region = { ...regionDefinition, lon: regionDefinition.origin.lon, lat: regionDefinition.origin.lat };
const data = normalizeOsm(osm, region, brandBlocklist, elevation);
const elevationMetadata = JSON.parse(await readFile(path.join(ROOT, 'data/raw/elevation', `${regionName}.meta.json`), 'utf8'));
if (data.issues.missingTerrainSamples === data.chunks.length * regionDefinition.heightGrid.samples ** 2) {
  throw new Error('The selected MDT05 file contains no usable height samples for this region.');
}

const destination = path.join(ROOT, 'public/world', regionName);
await mkdir(destination, { recursive: true });
const chunkManifest = [];
for (const chunk of data.chunks) {
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    id: chunk.id,
    bounds: chunk.bounds,
    terrain: chunk.terrain,
    features: chunk.features,
  }), 'utf8');
  const compressed = deflateSync(payload, { level: 9 });
  const binary = Buffer.allocUnsafe(12 + compressed.length);
  binary.write('CTA2', 0, 4, 'ascii');
  binary.writeUInt16LE(1, 4);
  binary.writeUInt16LE(0, 6);
  binary.writeUInt32LE(payload.length, 8);
  compressed.copy(binary, 12);
  const fileName = `${chunk.id}.bin`;
  await writeFile(path.join(destination, fileName), binary);
  chunkManifest.push({
    id: chunk.id,
    path: fileName,
    bounds: chunk.bounds,
    bytes: binary.length,
    sha256: createHash('sha256').update(binary).digest('hex'),
    featureCount: chunk.features.length,
    missingTerrainSamples: chunk.missingTerrainSamples,
  });
}

const manifest = {
  schemaVersion: 1,
  region: regionName,
  crs: regionDefinition.crs,
  origin: regionDefinition.origin,
  extentMeters: regionDefinition.extentMeters,
  chunkMeters: regionDefinition.chunkMeters,
  bounds: {
    south: data.region.south,
    west: data.region.west,
    north: data.region.north,
    east: data.region.east,
  },
  source: {
    osm: {
      attribution: '© OpenStreetMap contributors',
      license: 'ODbL 1.0',
      url: 'https://www.openstreetmap.org/copyright',
      retrievedAt: osm.osm3s?.timestamp_osm_base ?? null,
      bytes: osmRaw.length,
      sha256: osmSha256,
    },
    terrain: {
      attribution: 'Obra derivada de MDT05-cob1 2008-2015 CC-BY 4.0 scne.es',
      product: elevationMetadata.source,
      url: elevationMetadata.sourceUrl,
      license: elevationMetadata.license,
      retrievedAt: elevationMetadata.retrievedAt,
      outputCrs: elevationMetadata.outputCrs,
      sha256: elevationMetadata.sha256,
      grid: elevationMetadata.grid,
    },
  },
  counts: { roads: data.roads.length, buildings: data.buildings.length, surfaces: data.surfaces.length, props: data.props.length, pois: data.pois.length },
  chunks: chunkManifest,
};
await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const brandLines = [
  '# Revisión de marcas',
  '',
  'Los nombres originales se descartan después de aplicar `tools/brand-blocklist.json`; esta tabla solo muestra el id OSM, la categoría, la identidad ficticia y el estado de revisión.',
  '',
  '| Elemento | Categoría | Marca ficticia | Estado |',
  '| --- | --- | --- | --- |',
  ...data.brandReport.map((brand) => `| ${brand.id} | ${brand.category} | ${brand.gameName} | ${brand.status} |`),
  '',
];
const fidelityLines = [
  '# Informe de fidelidad - Ciudad Monumental',
  '',
  `Región: ${regionName}; CRS: ${regionDefinition.crs}; rectángulo: ${regionDefinition.extentMeters} x ${regionDefinition.extentMeters} m.`,
  `Fuente OSM: fecha base ${osm.osm3s?.timestamp_osm_base ?? 'no informada'}.`,
  `Origen UTM fijado en Plaza Mayor: E ${resolvedRegion.origin.easting.toFixed(3)} m, N ${resolvedRegion.origin.northing.toFixed(3)} m.`,
  '',
  '| Medida | Resultado |',
  '| --- | ---: |',
  `| Calles y sendas | ${data.roads.length} |`,
  `| Huellas de edificios | ${data.buildings.length} |`,
  `| Superficies y agua | ${data.surfaces.length} |`,
  `| Árboles y mobiliario | ${data.props.length} |`,
  `| Puntos de interés | ${data.pois.length} |`,
  `| Edificios sin altura/planta OSM | ${data.issues.missingBuildingHeights} |`,
  `| Muestras MDT05 ausentes | ${data.issues.missingTerrainSamples} |`,
  `| Comercios pendientes de revisión de marca | ${data.issues.pendingBrands} |`,
  '',
  'Las alturas desconocidas permanecen nulas; no se asigna una altura inventada. Contrasta el visor 2D de `/debug/map.html` con la cartografía de OpenStreetMap y revisa hitos en la siguiente fase.',
  '',
];
await mkdir(path.join(ROOT, 'reports'), { recursive: true });
await writeFile(path.join(ROOT, 'reports/brands.md'), `${brandLines.join('\n')}\n`, 'utf8');
await writeFile(path.join(ROOT, 'reports/fidelity.md'), `${fidelityLines.join('\n')}\n`, 'utf8');
console.info(`Built ${chunkManifest.length} deterministic chunks for ${regionName}.`);
