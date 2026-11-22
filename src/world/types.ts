export interface ProjectedBounds {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

export interface ChunkEntry {
  readonly id: string;
  readonly path: string;
  readonly bounds: ProjectedBounds;
  readonly bytes: number;
  readonly sha256: string;
  readonly featureCount: number;
}

export interface WorldManifest {
  readonly schemaVersion: number;
  readonly region: string;
  readonly extentMeters: number;
  readonly chunkMeters: number;
  readonly chunks: readonly ChunkEntry[];
}

export interface ChunkFeature {
  readonly featureType: 'road' | 'pedestrian' | 'building' | 'surface' | 'prop' | 'poi';
  readonly kind?: string;
  readonly value?: string;
  readonly surface?: string;
  readonly points?: readonly (readonly [number, number])[];
}

export interface RawTerrainChunk {
  readonly id: string;
  readonly bounds: ProjectedBounds;
  readonly terrain: {
    readonly samples: number;
    readonly stepMeters: number;
    readonly quantizationMeters: number;
    readonly heights: readonly number[];
  };
  readonly features: readonly ChunkFeature[];
}

export interface TerrainLodData {
  readonly level: number;
  readonly size: number;
  readonly stepMeters: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
}

export interface BuiltTerrainChunk {
  readonly id: string;
  readonly bounds: ProjectedBounds;
  readonly samples: number;
  readonly stepMeters: number;
  readonly heights: Float32Array;
  readonly minimumHeight: number;
  readonly maximumHeight: number;
  readonly levels: readonly TerrainLodData[];
}

export interface TerrainChunkEvents {
  chunkLoaded: { readonly id: string; readonly lod: number; readonly memoryBytes: number };
  chunkUnloaded: { readonly id: string };
}
