import { describe, expect, it } from 'vitest';
import { projectEtrs89Utm29 } from '../tools/projection.mjs';
import { buildRoadNetwork } from '../tools/road-network.mjs';
import { buildWalkRoute } from '../tools/walk-route.mjs';

const origin = { lon: -6.371556, lat: 39.474414 };

function localPoint(lon: number, lat: number): [number, number] {
  const point = projectEtrs89Utm29(lon, lat);
  const center = projectEtrs89Utm29(origin.lon, origin.lat);
  return [point.easting - center.easting, point.northing - center.northing];
}

describe('reference walking route', () => {
  it('connects the three named landmarks over the road network in the requested order', () => {
    const locations = [origin, { lon: -6.3714, lat: 39.4745 }, { lon: -6.3712, lat: 39.4746 }];
    const network = buildRoadNetwork([
      { id: 'w10', highway: 'pedestrian', nodeIds: [1, 2], points: [localPoint(locations[0]!.lon, locations[0]!.lat), localPoint(locations[1]!.lon, locations[1]!.lat)], oneway: 1 },
      { id: 'w20', highway: 'residential', nodeIds: [2, 3], points: [localPoint(locations[1]!.lon, locations[1]!.lat), localPoint(locations[2]!.lon, locations[2]!.lat)], oneway: 1 },
    ]);
    const osm = { elements: locations.map((point, index) => ({
      type: 'node', id: index + 1, lon: point.lon, lat: point.lat,
      tags: { name: ['Plaza Mayor', 'Arco de la Estrella', 'Plaza de San Jorge'][index] },
    })) };
    const route = buildWalkRoute(osm, network, origin);
    expect(route.mode).toBe('pedestrian');
    expect(route.landmarks.map((landmark) => landmark.osmId)).toEqual(['n1', 'n2', 'n3']);
    expect(route.segmentIds).toEqual(['w10:0', 'w20:0']);
    expect(route.nodeIds).toEqual(['n1', 'n2', 'n3']);
    expect(route.points.length).toBe(3);
    expect(route.lengthMeters).toBeGreaterThan(0);
  });
});
