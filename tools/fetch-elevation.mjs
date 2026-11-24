import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectEtrs89Utm29 } from './projection.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const IGN_WCS_ENDPOINT = 'https://servicios.idee.es/wcs-inspire/mdt';
const CRS_25829 = 'http://www.opengis.net/def/crs/EPSG/0/25829';
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_TILE_CHUNKS = 12;
const TERRAIN_EDGE_MARGIN_CHUNKS = 1;

function parseMultipart(buffer, contentType) {
  const boundary = contentType
    .match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)
    ?.slice(1)
    .find(Boolean);
  if (!boundary) throw new Error('IGN WCS response did not include a multipart boundary.');
  const marker = Buffer.from(`--${boundary}`);
  const markerStart = buffer.indexOf(marker);
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), markerStart + marker.length);
  if (markerStart < 0 || headerEnd < 0 || buffer.subarray(0, markerStart).toString('ascii').trim())
    throw new Error('IGN WCS returned an invalid multipart response.');
  const partHeaders = buffer.subarray(markerStart + marker.length, headerEnd).toString('ascii');
  if (!/content-type:\s*application\/asc/i.test(partHeaders))
    throw new Error('IGN WCS multipart response did not contain the requested ASCII grid.');
  const dataStart = headerEnd + 4;
  const dataEnd = buffer.indexOf(Buffer.from(`\r\n--${boundary}`), dataStart);
  if (dataEnd < 0) throw new Error('IGN WCS ASCII grid part was incomplete.');
  return buffer.subarray(dataStart, dataEnd);
}

function parseGrid(text) {
  const lines = text.split(/\r?\n/);
  const header = new Map();
  let index = 0;
  while (index < lines.length) {
    const match = lines[index]
      .trim()
      .match(
        /^(ncols|nrows|xllcorner|yllcorner|xllcenter|yllcenter|cellsize|dx|dy|nodata_value)\s+([-+\d.eE]+)/i,
      );
    if (!match) break;
    header.set(match[1].toLowerCase(), Number(match[2]));
    index += 1;
  }
  const cols = header.get('ncols');
  const rows = header.get('nrows');
  const width = header.get('dx') ?? header.get('cellsize');
  const height = header.get('dy') ?? header.get('cellsize');
  const left = header.get('xllcorner') ?? header.get('xllcenter') - width / 2;
  const bottom = header.get('yllcorner') ?? header.get('yllcenter') - height / 2;
  if (
    ![cols, rows, width, height, left, bottom].every(Number.isFinite) ||
    cols < 2 ||
    rows < 2 ||
    cols * rows > 1_000_000 ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('IGN WCS response did not contain a valid bounded ESRI ASCII grid.');
  }
  const values = Float32Array.from(
    lines.slice(index).flatMap((line) => line.trim().split(/\s+/).filter(Boolean).map(Number)),
  );
  if (values.length !== cols * rows || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`IGN WCS grid contains ${values.length} cells; expected ${cols * rows}.`);
  }
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (min < -1000 || max > 9000)
    throw new Error(`IGN WCS grid contains implausible elevations (${min} to ${max} m).`);
  return {
    cols,
    rows,
    width,
    height,
    left,
    bottom,
    nodata: header.get('nodata_value') ?? -9999,
    min,
    max,
    values,
  };
}

function tileCountFor(region) {
  const chunksPerAxis =
    2 * Math.ceil(region.extentMeters / (2 * region.chunkMeters)) + TERRAIN_EDGE_MARGIN_CHUNKS * 2;
  let tilesPerAxis = 1;
  while (chunksPerAxis / tilesPerAxis > MAX_TILE_CHUNKS || chunksPerAxis % tilesPerAxis !== 0)
    tilesPerAxis += 1;
  return { chunksPerAxis, tilesPerAxis, halfExtent: (chunksPerAxis * region.chunkMeters) / 2 };
}

async function fetchTile(bounds, fetchImpl) {
  const params = new URLSearchParams({
    service: 'WCS',
    version: '2.0.1',
    request: 'GetCoverage',
    coverageId: 'Elevacion25830_5',
    subsettingCrs: CRS_25829,
    outputCrs: CRS_25829,
    format: 'application/asc',
  });
  params.append('subset', `x(${bounds.left},${bounds.right})`);
  params.append('subset', `y(${bounds.bottom},${bounds.top})`);
  const sourceUrl = `${IGN_WCS_ENDPOINT}?${params}`;
  const response = await fetchImpl(sourceUrl, {
    headers: { 'user-agent': 'CaceresCriminalDataBuilder/0.1' },
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`IGN WCS replied with HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type') ?? '';
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES)
    throw new Error(`IGN WCS response exceeds ${MAX_RESPONSE_BYTES} bytes.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_RESPONSE_BYTES)
    throw new Error(`IGN WCS response exceeds ${MAX_RESPONSE_BYTES} bytes.`);
  const gridBuffer = parseMultipart(buffer, contentType);
  return { sourceUrl, gridBuffer, grid: parseGrid(gridBuffer.toString('utf8')) };
}

function mosaicTiles(tiles, tilesPerAxis, tileBounds) {
  const first = tiles[0]?.grid;
  if (!first) throw new Error('IGN WCS returned no elevation tiles.');
  const cols = first.cols * tilesPerAxis;
  const rows = first.rows * tilesPerAxis;
  const values = new Float32Array(cols * rows);
  for (const { column, row, grid } of tiles) {
    const expectedLeft = tileBounds.left + column * tileBounds.width;
    const expectedBottom = tileBounds.bottom + row * tileBounds.height;
    if (
      grid.cols !== first.cols ||
      grid.rows !== first.rows ||
      Math.abs(grid.width - first.width) > 1e-6 ||
      Math.abs(grid.height - first.height) > 1e-6 ||
      Math.abs(grid.left - expectedLeft) > 1e-3 ||
      Math.abs(grid.bottom - expectedBottom) > 1e-3 ||
      grid.nodata !== first.nodata
    ) {
      throw new Error(
        'IGN WCS elevation tiles do not align on a common grid; refusing to shift or invent terrain samples.',
      );
    }
    const globalRowStart = (tilesPerAxis - 1 - row) * first.rows;
    const globalColumnStart = column * first.cols;
    for (let localRow = 0; localRow < first.rows; localRow += 1) {
      const sourceStart = localRow * first.cols;
      const targetStart = (globalRowStart + localRow) * cols + globalColumnStart;
      values.set(grid.values.subarray(sourceStart, sourceStart + first.cols), targetStart);
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const header = [
    `ncols ${cols}`,
    `nrows ${rows}`,
    `xllcorner ${first.left}`,
    `yllcorner ${tileBounds.bottom}`,
    `dx ${first.width}`,
    `dy ${first.height}`,
    `NODATA_value ${first.nodata}`,
  ];
  const lines = [header.join('\n')];
  for (let row = 0; row < rows; row += 1) {
    const start = row * cols;
    lines.push(
      Array.from(values.subarray(start, start + cols), (value) => value.toFixed(3)).join(' '),
    );
  }
  return {
    text: `${lines.join('\n')}\n`,
    cols,
    rows,
    width: first.width,
    height: first.height,
    left: first.left,
    bottom: tileBounds.bottom,
    min,
    max,
    values,
  };
}

export async function fetchElevation(regionName, region, { fetchImpl = fetch } = {}) {
  const center = projectEtrs89Utm29(region.origin.lon, region.origin.lat);
  const { chunksPerAxis, tilesPerAxis, halfExtent } = tileCountFor(region);
  const tileChunks = chunksPerAxis / tilesPerAxis;
  const tileSize = tileChunks * region.chunkMeters;
  const tileBounds = {
    left: center.easting - halfExtent,
    bottom: center.northing - halfExtent,
    width: tileSize,
    height: tileSize,
  };
  const tiles = [];
  const sourceUrls = [];
  for (let row = 0; row < tilesPerAxis; row += 1) {
    for (let column = 0; column < tilesPerAxis; column += 1) {
      const bounds = {
        left: tileBounds.left + column * tileSize,
        right: tileBounds.left + (column + 1) * tileSize,
        bottom: tileBounds.bottom + row * tileSize,
        top: tileBounds.bottom + (row + 1) * tileSize,
      };
      const tile = await fetchTile(bounds, fetchImpl);
      sourceUrls.push(tile.sourceUrl);
      tiles.push({ column, row, grid: tile.grid });
    }
  }
  const mosaic = mosaicTiles(tiles, tilesPerAxis, tileBounds);
  const gridBuffer = Buffer.from(mosaic.text, 'utf8');
  const stats = {
    cols: mosaic.cols,
    rows: mosaic.rows,
    width: mosaic.width,
    height: mosaic.height,
    left: mosaic.left,
    bottom: mosaic.bottom,
    min: mosaic.min,
    max: mosaic.max,
    tiles: tiles.length,
  };
  const directory = path.join(ROOT, 'data/raw/elevation');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${regionName}.asc`), mosaic.text, 'utf8');
  await writeFile(path.join(directory, `${regionName}.prj`), `${CRS_25829}\n`, 'utf8');
  await writeFile(
    path.join(directory, `${regionName}.meta.json`),
    `${JSON.stringify(
      {
        source: 'IGN/CNIG PNOA MDT05 1ª cobertura (Elevacion25830_5), servido por WCS 2.0.1',
        sourceUrl: sourceUrls.length === 1 ? sourceUrls[0] : undefined,
        sourceUrls,
        retrievedAt: new Date().toISOString(),
        license: 'CC BY 4.0 scne.es',
        outputCrs: 'EPSG:25829',
        sha256: createHash('sha256').update(gridBuffer).digest('hex'),
        bytes: gridBuffer.length,
        grid: stats,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return stats;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const regionName =
    process.argv.find((argument) => argument.startsWith('--region='))?.split('=')[1] ??
    'cc-monumental';
  const config = JSON.parse(await readFile(path.join(ROOT, 'tools/config/regions.json'), 'utf8'));
  const region = config[regionName];
  if (!region) throw new Error(`Unknown region: ${regionName}`);
  console.info(
    'Downloaded regional IGN/CNIG elevation grid:',
    await fetchElevation(regionName, region),
  );
}
