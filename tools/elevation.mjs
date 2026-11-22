import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const HEADER_KEYS = new Set(['ncols', 'nrows', 'xllcorner', 'yllcorner', 'xllcenter', 'yllcenter', 'cellsize', 'dx', 'dy', 'nodata_value']);

function parseHeaderLine(line) {
  const [key, value] = line.trim().split(/\s+/, 2);
  return [key?.toLowerCase(), Number(value)];
}

export async function loadAsciiElevation(filePath, origin, extentMeters, chunkMeters = 0) {
  const input = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  const header = new Map();
  let dataStarted = false;
  let sourceRow = 0;
  let firstColumn = 0;
  let lastColumn = -1;
  let firstRow = 0;
  let lastRow = -1;
  let lowerLeftX = 0;
  let lowerLeftY = 0;
  let cellWidth = 0;
  let cellHeight = 0;
  let nodata = -9999;
  let topCellCenter = 0;
  const cropRows = new Map();

  for await (const line of input) {
    if (!dataStarted) {
      const [key, value] = parseHeaderLine(line);
      const isHeaderLine = HEADER_KEYS.has(key);
      if (isHeaderLine && Number.isFinite(value)) header.set(key, value);
      const hasOrigin = header.has('xllcorner') || header.has('xllcenter');
      const hasBottom = header.has('yllcorner') || header.has('yllcenter');
      const hasCellSize = header.has('cellsize') || (header.has('dx') && header.has('dy'));
      const completeHeader = header.has('nodata_value') || (header.has('dx') && header.has('dy'));
      if (!header.has('ncols') || !header.has('nrows') || !hasOrigin || !hasBottom || !hasCellSize || !completeHeader) continue;
      if (isHeaderLine) continue;
      cellWidth = header.get('dx') ?? header.get('cellsize');
      cellHeight = header.get('dy') ?? header.get('cellsize');
      const left = header.has('xllcorner') ? header.get('xllcorner') : header.get('xllcenter') - cellWidth / 2;
      const bottom = header.has('yllcorner') ? header.get('yllcorner') : header.get('yllcenter') - cellHeight / 2;
      if (![left, bottom, cellWidth, cellHeight].every(Number.isFinite) || cellWidth <= 0 || cellHeight <= 0) {
        input.close();
        throw new Error(`Invalid projected origin or cell size in ${filePath}.`);
      }
      lowerLeftX = left - origin.easting;
      lowerLeftY = bottom - origin.northing;
      nodata = header.get('nodata_value') ?? -9999;
      topCellCenter = lowerLeftY + cellHeight * (header.get('nrows') - 0.5);
      const half = chunkMeters > 0 ? Math.ceil(extentMeters / (2 * chunkMeters)) * chunkMeters : extentMeters / 2;
      firstColumn = Math.max(0, Math.floor((-half - lowerLeftX) / cellWidth - 0.5) - 1);
      lastColumn = Math.min(header.get('ncols') - 1, Math.ceil((half - lowerLeftX) / cellWidth - 0.5) + 1);
      firstRow = Math.max(0, Math.floor((topCellCenter - half) / cellHeight) - 1);
      lastRow = Math.min(header.get('nrows') - 1, Math.ceil((topCellCenter + half) / cellHeight) + 1);
      if (firstColumn > lastColumn || firstRow > lastRow) {
        input.close();
        throw new Error(`The elevation grid does not cover the requested region in ${filePath}.`);
      }
      dataStarted = true;
    }

    if (sourceRow >= firstRow && sourceRow <= lastRow) {
      const values = line.trim().split(/\s+/);
      const row = new Float32Array(lastColumn - firstColumn + 1);
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        row[column - firstColumn] = Number(values[column]);
      }
      cropRows.set(sourceRow, row);
    }
    sourceRow += 1;
  }

  if (!dataStarted || sourceRow !== header.get('nrows')) throw new Error(`Elevation grid row count did not match the header in ${filePath}.`);
  return {
    sample(x, z) {
      if (x < lowerLeftX || x > lowerLeftX + header.get('ncols') * cellWidth
        || z < lowerLeftY || z > lowerLeftY + header.get('nrows') * cellHeight) return null;
      const column = Math.max(firstColumn, Math.min(lastColumn, (x - lowerLeftX) / cellWidth - 0.5));
      const row = Math.max(firstRow, Math.min(lastRow, (topCellCenter - z) / cellHeight));
      if (column < firstColumn || column > lastColumn || row < firstRow || row > lastRow) return null;
      const left = Math.max(firstColumn, Math.floor(column));
      const right = Math.min(lastColumn, Math.ceil(column));
      const top = Math.max(firstRow, Math.floor(row));
      const bottom = Math.min(lastRow, Math.ceil(row));
      const leftRow = cropRows.get(top);
      const rightRow = cropRows.get(bottom);
      if (!leftRow || !rightRow) return null;
      const topLeft = leftRow[left - firstColumn];
      const topRight = leftRow[right - firstColumn];
      const bottomLeft = rightRow[left - firstColumn];
      const bottomRight = rightRow[right - firstColumn];
      if ([topLeft, topRight, bottomLeft, bottomRight].some((value) => value === undefined || value === nodata || !Number.isFinite(value) || Math.abs(value) > 1e20)) return null;
      const xFraction = right === left ? 0 : column - left;
      const zFraction = bottom === top ? 0 : row - top;
      const upper = topLeft + (topRight - topLeft) * xFraction;
      const lower = bottomLeft + (bottomRight - bottomLeft) * xFraction;
      return upper + (lower - upper) * zFraction;
    },
  };
}
