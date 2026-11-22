const DEFAULT_LANES = new Map([
  ['motorway', 2], ['trunk', 2], ['primary', 2], ['secondary', 2], ['tertiary', 2],
  ['residential', 2], ['living_street', 1], ['service', 1], ['unclassified', 1],
  ['pedestrian', 0], ['footway', 0], ['steps', 0], ['ladder', 0], ['path', 0],
  ['bridleway', 0], ['cycleway', 1], ['track', 1],
]);
const WALKABLE_HIGHWAYS = new Set(['pedestrian', 'footway', 'steps', 'ladder', 'path', 'bridleway']);

function laneDirections(lanes, oneWay) {
  if (oneWay === 1) return { forward: lanes, reverse: 0 };
  if (oneWay === -1) return { forward: 0, reverse: lanes };
  return { forward: Math.ceil(lanes / 2), reverse: Math.floor(lanes / 2) };
}

function maneuverAt(nodeId, from, to, nodes) {
  if (from.id === to.id) return 'uturn';
  const origin = nodes.get(nodeId)?.position ?? [0, 0];
  const fromEnd = nodes.get(from.fromNode === nodeId ? from.toNode : from.fromNode)?.position ?? origin;
  const toEnd = nodes.get(to.fromNode === nodeId ? to.toNode : to.fromNode)?.position ?? origin;
  const inX = origin[0] - fromEnd[0];
  const inZ = origin[1] - fromEnd[1];
  const outX = toEnd[0] - origin[0];
  const outZ = toEnd[1] - origin[1];
  const angle = Math.atan2(inX * outZ - inZ * outX, inX * outX + inZ * outZ);
  if (Math.abs(angle) > (Math.PI * 5) / 6) return 'uturn';
  if (Math.abs(angle) < Math.PI / 9) return 'straight';
  return angle > 0 ? 'left' : 'right';
}

export function buildRoadNetwork(roads) {
  const nodes = new Map();
  const segments = [];
  for (const road of roads) {
    if (!Array.isArray(road.points) || road.points.length < 2) continue;
    const refsMatch = Array.isArray(road.nodeIds) && road.nodeIds.length === road.points.length;
    const nodeIds = road.points.map((_, index) => refsMatch && Number.isSafeInteger(road.nodeIds[index])
      ? `n${road.nodeIds[index]}`
      : `${road.id}:p${index}`);
    for (let index = 0; index < nodeIds.length; index += 1) {
      const id = nodeIds[index];
      const position = road.points[index];
      if (!id || !position) continue;
      const node = nodes.get(id) ?? { id, position, segmentIds: new Set(), wayIds: new Set() };
      node.wayIds.add(road.id);
      nodes.set(id, node);
    }

    const lanes = Number.isInteger(road.lanes) && road.lanes > 0 ? road.lanes : DEFAULT_LANES.get(road.highway) ?? 1;
    const oneWay = road.oneway ?? 0;
    const directions = laneDirections(lanes, oneWay);
    const walkable = WALKABLE_HIGHWAYS.has(road.highway);
    for (let index = 0; index < nodeIds.length - 1; index += 1) {
      const fromNode = nodeIds[index];
      const toNode = nodeIds[index + 1];
      const from = road.points[index];
      const to = road.points[index + 1];
      if (!fromNode || !toNode || !from || !to) continue;
      const lengthMeters = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (lengthMeters < 0.05) continue;
      const id = `${road.id}:${index}`;
      segments.push({
        id,
        wayId: road.id,
        fromNode,
        toNode,
        lengthMeters,
        highway: road.highway,
        surface: road.surface ?? 'unknown',
        laneCount: lanes,
        forwardLanes: directions.forward,
        reverseLanes: directions.reverse,
        oneWay,
        forwardAllowed: oneWay !== -1,
        reverseAllowed: oneWay !== 1,
        walkable,
        maxSpeedKph: road.maxSpeedKph ?? null,
        bridge: Boolean(road.bridge),
        tunnel: Boolean(road.tunnel),
      });
      nodes.get(fromNode)?.segmentIds.add(id);
      nodes.get(toNode)?.segmentIds.add(id);
    }
  }

  const intersections = [...nodes.values()]
    .filter((node) => node.segmentIds.size >= 3 || node.wayIds.size >= 3)
    .map((node) => node.id)
    .sort();
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const connections = [];
  for (const nodeId of intersections) {
    const incident = [...(nodes.get(nodeId)?.segmentIds ?? [])].map((id) => segmentById.get(id)).filter(Boolean);
    for (const from of incident) {
      const canEnter = from.toNode === nodeId ? from.forwardAllowed : from.reverseAllowed;
      if (!canEnter) continue;
      for (const to of incident) {
        const canExit = to.fromNode === nodeId ? to.forwardAllowed : to.reverseAllowed;
        if (!canExit) continue;
        connections.push({ intersectionNode: nodeId, fromSegment: from.id, toSegment: to.id, maneuver: maneuverAt(nodeId, from, to, nodes) });
      }
    }
  }

  return {
    schemaVersion: 1,
    crs: 'EPSG:25829',
    nodes: [...nodes.values()].map((node) => ({
      id: node.id,
      position: node.position,
      segmentIds: [...node.segmentIds].sort(),
      intersection: intersections.includes(node.id),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    segments: segments.sort((left, right) => left.id.localeCompare(right.id)),
    connections: connections.sort((left, right) => `${left.intersectionNode}|${left.fromSegment}|${left.toSegment}`.localeCompare(`${right.intersectionNode}|${right.fromSegment}|${right.toSegment}`)),
    intersections,
  };
}
