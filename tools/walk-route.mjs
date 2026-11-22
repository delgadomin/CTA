import { projectEtrs89Utm29 } from './projection.mjs';

const MOTOR_ONLY = new Set(['motorway', 'motorway_link']);

export function buildWalkRoute(osm, network, origin) {
  const originProjected = projectEtrs89Utm29(origin.lon, origin.lat);
  const anchors = [
    findLandmark(osm, /^Plaza Mayor$/i),
    findLandmark(osm, /^Arco de la Estrella$/i),
    findLandmark(osm, /^Plaza de San Jorge$/i),
  ].map((anchor) => ({ ...anchor, position: [anchor.position[0] - originProjected.easting, anchor.position[1] - originProjected.northing] }));
  const snapped = anchors.map((anchor) => {
    const node = nearestNode(network.nodes, anchor.position);
    if (!node || node.distance > 60) throw new Error(`No safe road graph snap found for ${anchor.name}.`);
    return { ...anchor, nodeId: node.id, snapDistanceMeters: node.distance, snapPosition: node.position };
  });
  const byId = new Map(network.nodes.map((node) => [node.id, node]));
  const legs = [];
  for (let index = 0; index < snapped.length - 1; index += 1) {
    const start = snapped[index];
    const end = snapped[index + 1];
    if (!start || !end) continue;
    legs.push(shortestWalkPath(network, byId, start.nodeId, end.nodeId));
  }
  const nodeIds = [];
  const segmentIds = [];
  const pathWithAnchors = [];
  for (const leg of legs) {
    for (const nodeId of leg.nodeIds) if (nodeIds.at(-1) !== nodeId) nodeIds.push(nodeId);
    segmentIds.push(...leg.segmentIds);
  }
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index];
    const start = snapped[index];
    const end = snapped[index + 1];
    if (start) appendPoint(pathWithAnchors, start.position);
    for (const nodeId of leg?.nodeIds ?? []) {
      const node = byId.get(nodeId);
      if (node) appendPoint(pathWithAnchors, node.position);
    }
    if (end) appendPoint(pathWithAnchors, end.position);
  }
  const anchorOutput = snapped.map((anchor) => ({
    id: anchor.id,
    name: anchor.name,
    osmId: anchor.osmId,
    position: anchor.position,
    nodeId: anchor.nodeId,
    snapDistanceMeters: anchor.snapDistanceMeters,
  }));
  const meters = pathWithAnchors.slice(1).reduce((sum, point, index) => {
    const previous = pathWithAnchors[index];
    return sum + (previous ? Math.hypot(point[0] - previous[0], point[1] - previous[1]) : 0);
  }, 0);
  return {
    schemaVersion: 1,
    mode: 'pedestrian',
    landmarks: anchorOutput,
    nodeIds,
    segmentIds,
    points: pathWithAnchors,
    lengthMeters: Math.round(meters),
  };
}

function appendPoint(points, point) {
  const previous = points.at(-1);
  if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) points.push(point);
}

function findLandmark(osm, namePattern) {
  const element = osm.elements.find((candidate) => namePattern.test(candidate.tags?.name ?? ''));
  if (!element) throw new Error(`OSM landmark not found: ${namePattern}.`);
  let lon;
  let lat;
  if (element.type === 'node') {
    lon = element.lon;
    lat = element.lat;
  } else if (Array.isArray(element.geometry) && element.geometry.length > 0) {
    const sums = element.geometry.reduce((result, point) => ({ lon: result.lon + point.lon, lat: result.lat + point.lat }), { lon: 0, lat: 0 });
    lon = sums.lon / element.geometry.length;
    lat = sums.lat / element.geometry.length;
  } else throw new Error(`OSM landmark has no point: ${element.tags?.name ?? element.id}.`);
  const projected = projectEtrs89Utm29(lon, lat);
  return {
    id: element.tags?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ?? `osm-${element.id}`,
    name: element.tags?.name ?? `OSM ${element.id}`,
    osmId: `${element.type === 'node' ? 'n' : 'w'}${element.id}`,
    position: [projected.easting, projected.northing],
  };
}

function nearestNode(nodes, point) {
  let best;
  for (const node of nodes) {
    const distance = Math.hypot(node.position[0] - point[0], node.position[1] - point[1]);
    if (!best || distance < best.distance) best = { node, distance };
  }
  return best ? { ...best.node, distance: best.distance } : undefined;
}

function roadCost(segment) {
  if (MOTOR_ONLY.has(segment.highway)) return Infinity;
  if (segment.highway === 'steps') return segment.lengthMeters * 1.2;
  if (segment.walkable || segment.highway === 'pedestrian') return segment.lengthMeters;
  if (['primary', 'secondary', 'tertiary', 'trunk'].includes(segment.highway)) return segment.lengthMeters * 1.35;
  return segment.lengthMeters * 1.08;
}

function shortestWalkPath(network, nodeById, startId, endId) {
  const edges = new Map();
  for (const segment of network.segments) {
    const cost = roadCost(segment);
    if (!Number.isFinite(cost)) continue;
    const forward = edges.get(segment.fromNode) ?? [];
    forward.push({ to: segment.toNode, segmentId: segment.id, cost });
    edges.set(segment.fromNode, forward);
    const reverse = edges.get(segment.toNode) ?? [];
    reverse.push({ to: segment.fromNode, segmentId: segment.id, cost });
    edges.set(segment.toNode, reverse);
  }
  const distances = new Map([[startId, 0]]);
  const previous = new Map();
  const pending = new Set([startId]);
  const visited = new Set();
  while (pending.size > 0) {
    let current;
    let bestDistance = Infinity;
    for (const id of pending) {
      const distance = distances.get(id) ?? Infinity;
      if (distance < bestDistance) { current = id; bestDistance = distance; }
    }
    if (!current || current === endId) break;
    pending.delete(current);
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges.get(current) ?? []) {
      const candidate = bestDistance + edge.cost;
      if (candidate >= (distances.get(edge.to) ?? Infinity)) continue;
      distances.set(edge.to, candidate);
      previous.set(edge.to, { from: current, segmentId: edge.segmentId });
      pending.add(edge.to);
    }
  }
  if (!distances.has(endId) || !nodeById.has(endId)) throw new Error(`No pedestrian path between ${startId} and ${endId}.`);
  const nodeIds = [endId];
  const segmentIds = [];
  let current = endId;
  while (current !== startId) {
    const step = previous.get(current);
    if (!step) throw new Error(`Incomplete pedestrian path to ${endId}.`);
    nodeIds.unshift(step.from);
    segmentIds.unshift(step.segmentId);
    current = step.from;
  }
  return { nodeIds, segmentIds };
}
