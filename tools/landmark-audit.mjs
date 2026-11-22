function normalizeName(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function sourceLink(id) {
  const match = /^([nwr])(\d+)$/.exec(id);
  if (!match?.[1] || !match[2]) return id;
  const type = { n: 'node', w: 'way', r: 'relation' }[match[1]];
  return type ? `[${id}](https://www.openstreetmap.org/${type}/${match[2]})` : id;
}

function geometryKind(feature) {
  const pointCount = feature.points?.length ?? 0;
  if (feature.featureType === 'building' && pointCount >= 3) return 'huella de edificio';
  if (feature.featureType === 'surface' && pointCount >= 3) return 'polígono';
  if (feature.featureType === 'surface' && pointCount >= 2) return 'trazado';
  if (feature.featureType === 'road' || feature.featureType === 'pedestrian') return 'vía';
  if (feature.featureType === 'poi' && feature.id.startsWith('r')) return 'centro de relación';
  if (feature.position) return 'punto';
  return 'solo nombre';
}

export function auditLandmarks(features, targets, regionName) {
  const byName = new Map();
  for (const feature of features) {
    if (typeof feature.name !== 'string' || !feature.name.trim() || typeof feature.id !== 'string') continue;
    const key = normalizeName(feature.name);
    const matches = byName.get(key) ?? [];
    matches.push(feature);
    byName.set(key, matches);
  }

  return targets.map((target) => {
    if (target.scope !== regionName) return { ...target, status: 'out-of-scope', sourceIds: [], geometry: [] };
    const names = [target.name, ...(target.aliases ?? [])].map(normalizeName);
    const matches = names.flatMap((name) => byName.get(name) ?? []);
    const sourceIds = [...new Set(matches.map((feature) => feature.id))].sort();
    const geometry = [...new Set(matches.map(geometryKind))].sort();
    return { ...target, status: sourceIds.length > 0 ? 'found' : 'not-found-in-extract', sourceIds, geometry };
  });
}

export function formatLandmarkAudit(audit) {
  const statusText = {
    found: 'presente',
    'not-found-in-extract': 'no encontrado en el extracto',
    'out-of-scope': 'fuera de esta región',
  };
  return [
    '## Hitos de referencia',
    '',
    'La comparación usa coincidencia exacta de nombre tras normalizar mayúsculas, espacios y tildes. Los IDs OSM indican las entidades fuente; “no encontrado” no significa que el elemento no exista, sino que no aparece con esos nombres en el extracto consultado.',
    '',
    '| Hito | Estado en la región | Geometría fuente | IDs OSM |',
    '| --- | --- | --- | --- |',
    ...audit.map((item) => `| ${item.name} | ${statusText[item.status]} | ${item.geometry.join(', ') || '—'} | ${item.sourceIds.map(sourceLink).join(', ') || '—'} |`),
    '',
  ];
}
