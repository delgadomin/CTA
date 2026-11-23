import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NpcSystem } from '../src/world/npc-system';
import { RoadGraph } from '../src/world/road-graph';
import type { RoadNetwork } from '../src/world/types';

function segment(
  id: string,
  fromNode: string,
  toNode: string,
  options: { highway: string; lanes: number; oneWay?: -1 | 0 | 1; walkable?: boolean; length: number },
): RoadNetwork['segments'][number] {
  const forward = options.oneWay !== -1;
  const reverse = options.oneWay === undefined || options.oneWay === 0;
  return {
    id,
    wayId: id,
    fromNode,
    toNode,
    lengthMeters: options.length,
    highway: options.highway,
    surface: 'asphalt',
    laneCount: options.lanes,
    forwardLanes: forward ? Math.max(options.lanes, 1) : 0,
    reverseLanes: reverse ? Math.max(options.lanes, 1) : 0,
    oneWay: options.oneWay ?? 0,
    forwardAllowed: forward,
    reverseAllowed: reverse,
    walkable: options.walkable ?? false,
    maxSpeedKph: null,
    bridge: false,
    tunnel: false,
  };
}

const network: RoadNetwork = {
  schemaVersion: 1,
  crs: 'EPSG:25829',
  nodes: [
    { id: 'n0', position: [-100, 0], segmentIds: ['s0'], intersection: false },
    { id: 'n1', position: [0, 0], segmentIds: ['s0', 's1'], intersection: true },
    { id: 'n2', position: [10, 0], segmentIds: ['s1', 's2', 's3'], intersection: true },
    { id: 'n3', position: [20, 0], segmentIds: ['s2'], intersection: false },
    { id: 'n4', position: [10, 10], segmentIds: ['s3'], intersection: false },
  ],
  segments: [
    segment('s0', 'n0', 'n1', { highway: 'residential', lanes: 2, length: 100 }),
    segment('s1', 'n1', 'n2', { highway: 'footway', lanes: 0, walkable: true, length: 10 }),
    segment('s2', 'n2', 'n3', { highway: 'residential', lanes: 2, oneWay: 1, length: 10 }),
    segment('s3', 'n2', 'n4', { highway: 'footway', lanes: 0, walkable: true, length: 14.14 }),
  ],
  connections: [],
  intersections: ['n1', 'n2'],
};

describe('road graph for ambient agents', () => {
  it('separates drivable and pedestrian networks and respects one-way streets', () => {
    const graph = new RoadGraph(network);
    expect(graph.nodeCount).toBe(5);
    expect(graph.segmentCount).toBe(4);
    expect(graph.nearestSegment(5, 0, 'pedestrian')?.segment).toBe(1);
    expect(graph.nearestSegment(5, 0, 'vehicle')?.segment).toBe(0);
    expect(graph.route(0, 1, 'vehicle')).toEqual([0, 1]);
    expect(graph.route(2, 1, 'vehicle')).toEqual([]);
    expect(graph.route(2, 1, 'pedestrian')).toEqual([2, 1]);
  });

  it('pools agents without exceeding the configured population', () => {
    const graph = new RoadGraph(network);
    const system = new NpcSystem(graph, { pedestrians: 8, vehicles: 3 });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 101, 0);
    camera.updateMatrixWorld();
    const player = new THREE.Vector3(0, 100, 0);
    const world = {
      groundHeightAt: () => 100,
      collidesWithBuilding: () => false,
    };
    try {
      for (let frame = 0; frame < 240; frame += 1) system.update(1 / 60, player, camera, world);
      expect(system.counts.pedestrians).toBeLessThanOrEqual(8);
      expect(system.counts.vehicles).toBeLessThanOrEqual(3);
      expect(system.diagnostics.reroutes).toBeGreaterThanOrEqual(0);
    } finally {
      system.dispose();
    }
  });
});
