export interface QualityPreset {
  readonly pixelRatio: number;
  readonly shadowMapSize: number;
  readonly viewDistance: number;
  readonly populationDensity: number;
  readonly antialias: boolean;
}

export const QUALITY_PRESETS: Readonly<Record<'low' | 'medium' | 'high', QualityPreset>> = {
  low: {
    pixelRatio: 1,
    shadowMapSize: 512,
    viewDistance: 500,
    populationDensity: 0.45,
    antialias: false,
  },
  medium: {
    pixelRatio: 1.25,
    shadowMapSize: 1024,
    viewDistance: 900,
    populationDensity: 0.75,
    antialias: true,
  },
  high: {
    pixelRatio: 1.75,
    shadowMapSize: 2048,
    viewDistance: 1600,
    populationDensity: 1,
    antialias: true,
  },
};
