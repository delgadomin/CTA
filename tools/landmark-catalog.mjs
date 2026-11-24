import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectEtrs89Utm29 } from './projection.mjs';
import { writeIfChanged } from './write-if-changed.mjs';

function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
}

function sourceElementId(id) {
  const match = /^([nwr])(\d+)$/.exec(id);
  if (!match?.[1] || !match[2]) return undefined;
  return { type: { n: 'node', w: 'way', r: 'relation' }[match[1]], id: Number(match[2]) };
}

function sourceRings(element) {
  if (element.type === 'node') return [];
  if (element.type === 'way') return [element.geometry ?? []];
  return (element.members ?? [])
    .filter((member) => member.type === 'way' && member.role !== 'inner' && member.geometry?.length)
    .map((member) => member.geometry);
}

function sourcePosition(element, rings) {
  if (element.type === 'node') return { lon: element.lon, lat: element.lat };
  const points = rings.flat();
  if (points.length === 0) return undefined;
  return points.reduce(
    (center, point) => ({
      lon: center.lon + point.lon / points.length,
      lat: center.lat + point.lat / points.length,
    }),
    { lon: 0, lat: 0 },
  );
}

function localPoint(point, origin) {
  const projected = projectEtrs89Utm29(point.lon, point.lat);
  return [projected.easting - origin.easting, projected.northing - origin.northing];
}

function heightMetadata(tags, feature) {
  const explicit = Number.parseFloat(String(tags.height ?? '').replace(',', '.'));
  const levels = Number.parseFloat(tags['building:levels'] ?? '');
  return {
    heightMeters: Number.isFinite(explicit) && explicit > 0 ? explicit : null,
    heightSource: Number.isFinite(explicit) && explicit > 0 ? 'height' : null,
    levels: Number.isFinite(levels) && levels > 0 ? levels : null,
    heightFromLevelsMeters: Number.isFinite(levels) && levels > 0 ? levels * 3 : null,
    visualHeightMeters: feature?.visualHeightMeters ?? null,
  };
}

function geometryType(element, rings, tags) {
  if (element.type === 'node') return 'point';
  const hospitalSite =
    tags.amenity === 'hospital' &&
    rings.some(
      (ring) =>
        ring.length >= 4 && ring[0].lat === ring.at(-1).lat && ring[0].lon === ring.at(-1).lon,
    );
  const area = Boolean(
    tags.building ||
    tags.area === 'yes' ||
    tags.place === 'square' ||
    tags.leisure ||
    tags.landuse ||
    hospitalSite,
  );
  if (area && rings.some((ring) => ring.length >= 4))
    return element.type === 'relation' ? 'multipolygon' : 'polygon';
  return 'line';
}

function enrichSource(id, matches, elementsById, origin) {
  const address = sourceElementId(id);
  if (!address) return undefined;
  const element = elementsById.get(id);
  if (!element) return undefined;
  const rings = sourceRings(element);
  const position = sourcePosition(element, rings);
  const primaryMatch =
    matches.find((feature) => feature.featureType === 'building') ??
    matches.find((feature) => feature.points?.length >= 3) ??
    matches.find((feature) => feature.position) ??
    matches[0];
  const tags = element.tags ?? {};
  const type = geometryType(element, rings, tags);
  return {
    id,
    url: `https://www.openstreetmap.org/${address.type}/${address.id}`,
    featureTypes: [...new Set(matches.map((feature) => feature.featureType))].sort(),
    geometryType: type,
    position: position
      ? { lon: position.lon, lat: position.lat, localMeters: localPoint(position, origin) }
      : primaryMatch?.position
        ? { localMeters: primaryMatch.position }
        : null,
    sourceGeometry: rings.map((ring) => ring.map((point) => [point.lon, point.lat])),
    footprintLocalMeters: ['polygon', 'multipolygon'].includes(type)
      ? rings.map((ring) => ring.map((point) => localPoint(point, origin)))
      : null,
    ...heightMetadata(tags, primaryMatch),
    tags: Object.fromEntries(
      [
        'building',
        'building:levels',
        'height',
        'historic',
        'highway',
        'place',
        'surface',
        'wikidata',
      ]
        .filter((key) => tags[key] !== undefined)
        .map((key) => [key, tags[key]]),
    ),
  };
}

export function buildLandmarkDataset(targets, features, sourceElements, origin, regionName) {
  const featuresByName = new Map();
  const featuresById = new Map();
  for (const feature of features) {
    if (typeof feature.id === 'string') {
      const list = featuresById.get(feature.id) ?? [];
      list.push(feature);
      featuresById.set(feature.id, list);
    }
    if (typeof feature.name !== 'string' || !feature.name.trim()) continue;
    const name = normalizeName(feature.name);
    const list = featuresByName.get(name) ?? [];
    list.push(feature);
    featuresByName.set(name, list);
  }
  const elementsById = new Map(
    sourceElements.map((element) => [`${element.type[0]}${element.id}`, element]),
  );
  const landmarks = targets.map((target) => {
    const names = [target.name, ...(target.aliases ?? [])].map(normalizeName);
    const matches = names.flatMap((name) => featuresByName.get(name) ?? []);
    const sourceIds = [...new Set(matches.map((feature) => feature.id))].sort();
    const sources = sourceIds
      .map((id) => enrichSource(id, featuresById.get(id) ?? [], elementsById, origin))
      .filter(Boolean);
    const primary =
      sources.find((source) => source.id === target.anchorSourceId) ??
      sources.find((source) => source.footprintLocalMeters?.some((ring) => ring.length >= 4)) ??
      sources[0];
    return {
      id: target.id,
      name: target.name,
      scope: target.scope,
      aliases: target.aliases ?? [],
      keyFeatures: target.keyFeatures ?? [],
      references: target.references ?? [],
      sourceIds,
      position: primary?.position ?? null,
      heightMeters: primary?.heightMeters ?? null,
      heightSource: primary?.heightSource ?? null,
      heightFromLevelsMeters: primary?.heightFromLevelsMeters ?? null,
      footprintLocalMeters: primary?.footprintLocalMeters ?? null,
      sources,
      status:
        target.scope === regionName && sourceIds.length > 0
          ? 'pending-human-review'
          : target.scope === regionName
            ? 'missing-source-geometry'
            : 'out-of-scope',
    };
  });
  return { schemaVersion: 1, region: regionName, crs: 'EPSG:25829 local meters', landmarks };
}

function markdownFor(landmark) {
  const ids = landmark.sourceIds.length
    ? landmark.sources.map((source) => `[${source.id}](${source.url})`).join(', ')
    : 'Sin entidad OSM en el extracto actual.';
  const point =
    landmark.position?.lon !== undefined
      ? `${landmark.position.lat.toFixed(7)}, ${landmark.position.lon.toFixed(7)}`
      : 'Sin posición en esta región';
  const height =
    landmark.heightMeters !== null
      ? `${landmark.heightMeters} m (OSM height)`
      : landmark.heightFromLevelsMeters !== null
        ? `${landmark.heightFromLevelsMeters} m (building:levels × 3 m)`
        : 'Sin altura fuente.';
  const features = landmark.keyFeatures.length
    ? landmark.keyFeatures.map((feature) => `- ${feature}`).join('\n')
    : '- La guía no define rasgos específicos; documentar con referencias y revisión humana antes de añadir detalles.';
  return `# ${landmark.name}\n\n- Estado: pendiente de aprobación humana.\n- Alcance: ${landmark.scope}.\n- Fuentes OSM: ${ids}\n- Posición fuente: ${point}.\n- Altura fuente: ${height}\n- Huella local EPSG:25829: ${landmark.footprintLocalMeters ? 'incluida en landmarks.json' : 'no disponible'}\n\n## Rasgos de referencia\n\n${features}\n\n## Referencias para revisión\n\n${landmark.references.map((url) => `- ${url}`).join('\n')}\n\n## Aprobación\n\nNo cambiar el estado a aprobado sin comparación humana con fotografías.\n`;
}

export async function writeLandmarkDataset(root, dataset) {
  const directory = path.join(root, 'data/landmarks');
  await mkdir(directory, { recursive: true });
  await writeIfChanged(
    path.join(directory, 'landmarks.json'),
    `${JSON.stringify(dataset, null, 2)}\n`,
    'utf8',
  );
  for (const landmark of dataset.landmarks)
    await writeIfChanged(path.join(directory, `${landmark.id}.md`), markdownFor(landmark));
  const statusPath = path.join(directory, 'status.json');
  let existing = { schemaVersion: 1, landmarks: {} };
  try {
    existing = JSON.parse(await readFile(statusPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const statuses = Object.fromEntries(
    dataset.landmarks.map((landmark) => {
      const current = existing.landmarks?.[landmark.id];
      return [landmark.id, current?.status === 'approved' ? current : { status: 'pending' }];
    }),
  );
  await writeIfChanged(
    statusPath,
    `${JSON.stringify({ schemaVersion: 1, approvalRule: 'Only a human may mark a landmark approved after photo comparison.', landmarks: statuses }, null, 2)}\n`,
  );
}
