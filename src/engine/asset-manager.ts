import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { Texture } from 'three';

export interface AssetProgress {
  readonly loaded: number;
  readonly total: number;
  readonly url: string;
}

interface QueuedModel {
  readonly url: string;
  readonly priority: number;
  readonly sequence: number;
  readonly resolve: (model: GLTF) => void;
  readonly reject: (error: unknown) => void;
}

export class AssetManager {
  private readonly gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly textureLoader = new KTX2Loader();
  private readonly models = new Map<string, Promise<GLTF>>();
  private readonly textures = new Map<string, Promise<Texture>>();
  private readonly onProgress: ((progress: AssetProgress) => void) | undefined;
  private readonly modelQueue: QueuedModel[] = [];
  private readonly maxConcurrentModels: number;
  private activeModelLoads = 0;
  private nextSequence = 0;

  constructor(renderer: WebGLRenderer, onProgress?: (progress: AssetProgress) => void, maxConcurrentModels = 4) {
    if (!Number.isInteger(maxConcurrentModels) || maxConcurrentModels < 1) {
      throw new RangeError('At least one concurrent model load must be allowed.');
    }
    this.onProgress = onProgress;
    this.maxConcurrentModels = maxConcurrentModels;
    this.textureLoader.setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
    this.textureLoader.detectSupport(renderer);
    this.gltfLoader.setKTX2Loader(this.textureLoader);
  }

  loadModel(url: string, priority = 0): Promise<GLTF> {
    const cached = this.models.get(url);
    if (cached) return cached;
    const request = new Promise<GLTF>((resolve, reject) => {
      this.modelQueue.push({ url, priority, sequence: this.nextSequence, resolve, reject });
      this.nextSequence += 1;
      this.modelQueue.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);
    });
    this.models.set(url, request);
    void request.catch(() => this.models.delete(url));
    this.pumpModelQueue();
    return request;
  }

  loadTexture(url: string): Promise<Texture> {
    const cached = this.textures.get(url);
    if (cached) return cached;
    const request = this.textureLoader.loadAsync(url, (event) => {
      this.onProgress?.({ loaded: event.loaded, total: event.total, url });
    });
    this.textures.set(url, request);
    void request.catch(() => this.textures.delete(url));
    return request;
  }

  dispose(): void {
    for (const queued of this.modelQueue) queued.reject(new Error('Asset manager disposed before model load.'));
    this.modelQueue.length = 0;
    this.models.clear();
    this.textures.clear();
    this.textureLoader.dispose();
  }

  private pumpModelQueue(): void {
    while (this.activeModelLoads < this.maxConcurrentModels && this.modelQueue.length > 0) {
      const request = this.modelQueue.shift();
      if (!request) return;
      this.activeModelLoads += 1;
      this.gltfLoader.load(
        request.url,
        (model) => this.finishModelLoad(request, model),
        (event) => this.onProgress?.({ loaded: event.loaded, total: event.total, url: request.url }),
        (error: unknown) => this.failModelLoad(request, error),
      );
    }
  }

  private finishModelLoad(request: QueuedModel, model: GLTF): void {
    this.activeModelLoads -= 1;
    request.resolve(model);
    this.pumpModelQueue();
  }

  private failModelLoad(request: QueuedModel, error: unknown): void {
    this.activeModelLoads -= 1;
    request.reject(error);
    this.pumpModelQueue();
  }
}
