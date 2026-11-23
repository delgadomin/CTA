// Audits the OSM-derived road graph used by phase 10 pedestrians and traffic.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worldDir = path.join(ROOT, 'public', 'world', 'cc-monumental');
const network = JSON.parse(await readFile(path.join(worldDir, 'road-network.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(worldDir, 'manifest.json'), 'utf8'));
const source = JSON.parse(await readFile(path.join(worldDir, 'source-fidelity.json'), 'utf8'));

const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
const degree = new Map(network.nodes.map((node) => [node.id, 0]));
for (const segment of network.segments) {
  degree.set(segment.fromNode, (degree.get(segment.fromNode) ?? 0) + 1);
  degree.set(segment.toNode, (degree.get(segment.toNode) ?? 0) + 1);
}
const isolated = network.nodes.filter((node) => (degree.get(node.id) ?? 0) === 0);
const deadEnds = network.nodes.filter((node) => (degree.get(node.id) ?? 0) === 1);
const intersectionsWithConnections = new Set(network.connections.map((connection) => connection.intersectionNode));
const missingIntersectionLinks = network.intersections.filter((id) => !intersectionsWithConnections.has(id));

const outgoing = new Map(network.nodes.map((node) => [node.id, 0]));
const incoming = new Map(network.nodes.map((node) => [node.id, 0]));
for (const segment of network.segments) {
  if (segment.forwardAllowed) outgoing.set(segment.fromNode, (outgoing.get(segment.fromNode) ?? 0) + 1);
  if (segment.reverseAllowed) outgoing.set(segment.toNode, (outgoing.get(segment.toNode) ?? 0) + 1);
  if (segment.reverseAllowed) incoming.set(segment.fromNode, (incoming.get(segment.fromNode) ?? 0) + 1);
  if (segment.forwardAllowed) incoming.set(segment.toNode, (incoming.get(segment.toNode) ?? 0) + 1);
}
const drivableSinks = network.nodes.filter((node) => (outgoing.get(node.id) ?? 0) === 0 && (incoming.get(node.id) ?? 0) > 0);
const drivableSources = network.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0 && (outgoing.get(node.id) ?? 0) > 0);

function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    const [ax, az] = a;
    const [bx, bz] = b;
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

const CELL = 64;
const buildingGrid = new Map();
for (const building of source.buildings) {
  const points = building.points ?? [];
  if (points.length < 3) continue;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
    for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
      const key = `${cx},${cz}`;
      const bucket = buildingGrid.get(key);
      if (bucket) bucket.push(building);
      else buildingGrid.set(key, [building]);
    }
  }
}

const walkableSegments = network.segments.filter((segment) => segment.walkable);
const crossingSegments = [];
for (const segment of walkableSegments) {
  const from = nodeById.get(segment.fromNode);
  const to = nodeById.get(segment.toNode);
  if (!from || !to) continue;
  let crossed = false;
  for (let sample = 1; sample <= 4 && !crossed; sample += 1) {
    const t = sample / 5;
    const x = from.position[0] + (to.position[0] - from.position[0]) * t;
    const z = from.position[1] + (to.position[1] - from.position[1]) * t;
    const bucket = buildingGrid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? [];
    crossed = bucket.some((building) => pointInPolygon(x, z, building.points ?? []));
  }
  if (crossed) crossingSegments.push(segment.id);
}

const manifestMatches = manifest.roadNetwork?.nodes === network.nodes.length
  && manifest.roadNetwork?.segments === network.segments.length
  && manifest.roadNetwork?.connections === network.connections.length;

const lines = [
  '# Auditoría del grafo viario (fase 10)',
  '',
  `Fecha: ${new Date().toISOString().slice(0, 10)}`,
  '',
  '## Resumen',
  '',
  '| Medida | Resultado |',
  '| --- | ---: |',
  `| Nodos | ${network.nodes.length} |`,
  `| Segmentos | ${network.segments.length} |`,
  `| Tramos peatonales | ${walkableSegments.length} |`,
  `| Conexiones de giro | ${network.connections.length} |`,
  `| Intersecciones | ${network.intersections.length} |`,
  `| Coincidencia con el manifiesto | ${manifestMatches ? 'sí' : 'NO'} |`,
  `| Nodos aislados | ${isolated.length} |`,
  `| Nodos con una sola arista | ${deadEnds.length} |`,
  `| Intersecciones sin conexiones de giro | ${missingIntersectionLinks.length} |`,
  `| Sumideros vehiculares | ${drivableSinks.length} |`,
  `| Fuentes vehiculares | ${drivableSources.length} |`,
  `| Tramos peatonales dentro de una huella | ${crossingSegments.length} |`,
  '',
  '## Hallazgos',
  '',
  `- **Criticidad alta si falla:** el manifiesto y el grafo deben coincidir; resultado: ${manifestMatches ? 'OK' : 'desincronizados'}.`,
  `- **Media:** los nodos aislados y las fuentes/sumideros vehiculares se excluyen al generar agentes.`,
  `- **Media:** los callejones sin salida son válidos en casco histórico; se documentan, no se corrige la fuente OSM.`,
  `- **Alta:** ${crossingSegments.length} tramos peatonales atraviesan huellas conocidas; el sistema los descarta mediante la prueba de edificio antes de mover al agente.`,
  crossingSegments.length > 0 ? `- Ejemplos: ${crossingSegments.slice(0, 10).join(', ')}.` : '- No se detectaron tramos peatonales sobre huellas.',
  '',
  '## Límites de los datos',
  '',
  '- El extracto no contiene semáforos ni señales de stop en el grafo: los agentes usan prioridad por llegada y cesión temporal en intersecciones, no una fase de señales real.',
  '- Las aceras inferidas del phase 4 son geometría visual; el grafo peatonal usa únicamente `highway` y `walkable` de OSM.',
  '- Los modelos son procedurales y se comparten por instancias; no hay animación de extremidades por agente en esta fase.',
  '- No se comprueba la distancia al bordillo ni la altura de paso de peatones: los agentes siguen la cota MDT05 muestreada en cada paso.',
  '',
];

await writeFile(path.join(ROOT, 'reports', 'audit-npcs.md'), `${lines.join('\n')}\n`);
console.info(`Grafo validado: ${network.nodes.length} nodos, ${walkableSegments.length} tramos peatonales, ${crossingSegments.length} solapamientos con edificios.`);
if (!manifestMatches) process.exitCode = 1;
