import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CrimeSystem } from '../src/world/crime-system';
import { NpcSystem } from '../src/world/npc-system';
import { PoliceSystem } from '../src/world/police-system';
import { RoadGraph } from '../src/world/road-graph';
import type { RoadNetwork } from '../src/world/types';

function roadNetwork(): RoadNetwork {
  const segment = (id: string, from: string, to: string): RoadNetwork['segments'][number] => ({
    id,
    wayId: id,
    fromNode: from,
    toNode: to,
    lengthMeters: 60,
    highway: 'residential',
    surface: 'asphalt',
    laneCount: 2,
    forwardLanes: 1,
    reverseLanes: 1,
    oneWay: 0,
    forwardAllowed: true,
    reverseAllowed: true,
    walkable: true,
    maxSpeedKph: 50,
    bridge: false,
    tunnel: false,
  });
  return {
    schemaVersion: 1,
    crs: 'EPSG:25829',
    nodes: [
      { id: 'a', position: [-120, 0], segmentIds: ['s0'], intersection: false },
      { id: 'b', position: [0, 0], segmentIds: ['s0', 's1'], intersection: true },
      { id: 'c', position: [120, 0], segmentIds: ['s1'], intersection: false },
    ],
    segments: [segment('s0', 'a', 'b'), segment('s1', 'b', 'c')],
    connections: [],
    intersections: ['b'],
  };
}

const world = {
  groundHeightAt: () => 100,
  collidesWithBuilding: () => false,
};

describe('crime and police', () => {
  it('raises stars, throttles repeated crimes and decays when the police are far', () => {
    const crime = new CrimeSystem();
    expect(crime.report('vehicleTheft', 0, 0)).toBe(true);
    expect(crime.stars).toBe(2);
    expect(crime.report('vehicleTheft', 0, 0)).toBe(false);
    expect(crime.eventCount).toBe(1);
    for (let frame = 0; frame < 600; frame += 1) crime.update(0.1, 400, 20);
    expect(crime.stars).toBe(0);
    expect(crime.value).toBe(0);
  });

  it('busts a slow player only when a patrol is close', () => {
    const crime = new CrimeSystem();
    crime.report('vehicleTheft', 0, 0);
    for (let frame = 0; frame < 25; frame += 1) crime.update(0.1, 200, 0);
    expect(crime.busted).toBe(false);
    for (let frame = 0; frame < 25; frame += 1) crime.update(0.1, 5, 1);
    expect(crime.busted).toBe(true);
    crime.reset();
    expect(crime.stars).toBe(0);
  });

  it('spawns patrols behind the camera and stands down without wanted level', () => {
    const graph = new RoadGraph(roadNetwork());
    const police = new PoliceSystem(graph);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 101, 12);
    camera.updateMatrixWorld();
    const player = new THREE.Vector3(0, 100, 0);
    try {
      for (let frame = 0; frame < 180; frame += 1) police.update(1 / 60, 3, player, camera, world);
      expect(police.count).toBeGreaterThan(0);
      expect(police.nearestDistance(player)).toBeLessThan(Infinity);
      for (let frame = 0; frame < 60; frame += 1) police.update(1 / 60, 0, player, camera, world);
      expect(police.count).toBe(0);
      expect(police.nearestDistance(player)).toBe(Infinity);
    } finally {
      police.dispose();
    }
  });

  it('lets the player requisition an ambient car and alarms nearby pedestrians', () => {
    const graph = new RoadGraph(roadNetwork());
    const npcs = new NpcSystem(graph, { pedestrians: 6, vehicles: 4 });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 101, 12);
    camera.updateMatrixWorld();
    const player = new THREE.Vector3(0, 100, 0);
    try {
      for (let frame = 0; frame < 180; frame += 1) npcs.update(1 / 60, player, camera, world);
      expect(npcs.counts.vehicles).toBeGreaterThan(0);
      expect(npcs.counts.pedestrians).toBeGreaterThan(0);
      expect(npcs.checkVehicleImpact(player, 1000)).toBe(true);
      const before = npcs.counts.vehicles;
      const claimed = npcs.claimVehicle(player, 500);
      expect(claimed).toBeDefined();
      expect(npcs.counts.vehicles).toBe(before - 1);
      expect(npcs.alarm(claimed?.x ?? 0, claimed?.z ?? 0, 1000)).toBeGreaterThan(0);
    } finally {
      npcs.dispose();
    }
  });
});
