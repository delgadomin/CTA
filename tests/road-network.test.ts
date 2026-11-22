import { describe, expect, it } from 'vitest';
import { buildRoadNetwork } from '../tools/road-network.mjs';

describe('OSM road network', () => {
  it('connects shared OSM node IDs and respects one-way lanes', () => {
    const network = buildRoadNetwork([
      {
        id: 'w10', highway: 'residential', nodeIds: [1, 2], points: [[0, 0], [10, 0]],
        lanes: 2, oneway: 1, surface: 'asphalt',
      },
      {
        id: 'w20', highway: 'residential', nodeIds: [2, 3], points: [[10, 0], [10, 10]],
        lanes: 2, oneway: 0, surface: 'paving_stones',
      },
      {
        id: 'w30', highway: 'residential', nodeIds: [2, 4], points: [[10, 0], [20, 0]],
        lanes: 1, oneway: 0, surface: 'cobblestone',
      },
    ]);

    expect(network.intersections).toEqual(['n2']);
    expect(network.segments.map((segment) => [segment.oneWay, segment.forwardLanes, segment.reverseLanes])).toEqual([
      [1, 2, 0], [0, 1, 1], [0, 1, 0],
    ]);
    expect(network.segments[2]?.reverseAllowed).toBe(true);
    expect(network.connections.some((connection) => connection.fromSegment === 'w10:0' && connection.toSegment === 'w20:0' && connection.maneuver === 'left')).toBe(true);
    expect(network.connections.every((connection) => connection.fromSegment !== 'w20:0' || connection.toSegment !== 'w10:0')).toBe(true);
  });

  it('keeps footpaths two-way and uses stable fallback nodes when OSM refs are absent', () => {
    const network = buildRoadNetwork([{
      id: 'w40', highway: 'steps', points: [[1, 1], [1, 4]], nodeIds: [], oneway: 0,
    }]);
    expect(network.nodes.map((node) => node.id)).toEqual(['w40:p0', 'w40:p1']);
    expect(network.segments[0]).toMatchObject({ walkable: true, forwardAllowed: true, reverseAllowed: true, laneCount: 0 });
  });
});
