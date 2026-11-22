export type GroundMaterial = 'grass' | 'stone' | 'asphalt' | 'soil' | 'rock' | 'water';

export const GROUND_COLORS: Readonly<Record<GroundMaterial, readonly [number, number, number]>> = {
  grass: [0.30, 0.40, 0.28],
  stone: [0.53, 0.49, 0.41],
  asphalt: [0.24, 0.27, 0.25],
  soil: [0.48, 0.37, 0.26],
  rock: [0.47, 0.46, 0.42],
  water: [0.18, 0.32, 0.37],
};

export function classifyGround(kind: string | undefined, value: string | undefined, surface: string | undefined): GroundMaterial {
  const surfaceName = surface?.toLowerCase() ?? '';
  if (['paving_stones', 'sett', 'cobblestone', 'stone'].includes(surfaceName)) return 'stone';
  if (['asphalt', 'concrete', 'paved', 'concrete:plates'].includes(surfaceName)) return 'asphalt';
  if (['unpaved', 'gravel', 'fine_gravel', 'ground', 'earth', 'dirt', 'sand'].includes(surfaceName)) return 'soil';
  if (kind === 'water' || kind === 'waterway' || value === 'water') return 'water';
  if (kind === 'natural' && ['bare_rock', 'rock', 'scree', 'shingle'].includes(value ?? '')) return 'rock';
  if (kind === 'natural' && ['sand', 'scrub', 'heath'].includes(value ?? '')) return 'soil';
  if (kind === 'landuse' && ['residential', 'commercial', 'industrial', 'retail', 'construction'].includes(value ?? '')) return 'stone';
  if (kind === 'landuse' && ['farmland', 'farmyard', 'orchard', 'vineyard', 'brownfield', 'quarry'].includes(value ?? '')) return 'soil';
  return 'grass';
}
