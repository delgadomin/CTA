import * as THREE from 'three';
import type { World } from '@dimforge/rapier3d-compat';
import { EventBus } from '../engine/event-bus';
import { TerrainColliders } from './terrain-physics';
import type { BuiltTerrainChunk, ChunkEntry, TerrainChunkEvents, TerrainLodData, WorldManifest } from './types';

type ChunkState = 'queued' | 'loading' | 'loaded' | 'error';

interface ChunkRecord {
  readonly entry: ChunkEntry;
  state: ChunkState;
  distance: number;
  lod: number;
  result?: BuiltTerrainChunk;
  meshes?: THREE.Mesh[];
  memoryBytes: number;
  hasCollider: boolean;
}

interface WorkerResponse {
  readonly id: string;
  readonly result?: BuiltTerrainChunk;
  readonly error?: string;
}

interface CompletedChunk {
  readonly id: string;
  readonly result: BuiltTerrainChunk;
}

const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
const GEOMETRY_BUDGET_MS = 5;
const SCHEDULE_INTERVAL_MS = 100;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

function distanceToCenter(x: number, z: number, entry: ChunkEntry): number {
  const centerX = (entry.bounds.minX + entry.bounds.maxX) / 2;
  const centerZ = (entry.bounds.minZ + entry.bounds.maxZ) / 2;
  return Math.hypot(x - centerX, z - centerZ);
}

function geometryForLod(level: TerrainLodData, result: BuiltTerrainChunk, chunkMeters: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(level.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(level.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(level.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(level.indices, 1));
  const half = chunkMeters / 2;
  const verticalRadius = (result.maximumHeight - result.minimumHeight) / 2 + 4;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (result.maximumHeight + result.minimumHeight) / 2, 0), Math.hypot(half, half, verticalRadius));
  return geometry;
}

function byteSize(meshes: readonly THREE.Mesh[]): number {
  let total = 0;
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    for (const attribute of Object.values(geometry.attributes)) total += attribute.array.byteLength;
    if (geometry.index) total += geometry.index.array.byteLength;
  }
  return total;
}

export class ChunkManager {
  readonly events = new EventBus<TerrainChunkEvents>();
  readonly worker: Worker;
  private readonly scene: THREE.Scene;
  private readonly world: World;
  private readonly colliders: TerrainColliders;
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, side: THREE.DoubleSide });
  private readonly records = new Map<string, ChunkRecord>();
  private readonly completed: CompletedChunk[] = [];
  private manifest: WorldManifest | undefined;
  private manifestUrl: URL;
  private worldBaseUrl: URL;
  private readonly loadQueue: string[] = [];
  private workerBusy = false;
  private lastSchedule = 0;
  private memoryBytes = 0;
  private errorCount = 0;
  private closed = false;

  constructor(scene: THREE.Scene, physicsWorld: World, manifestUrl: URL, worldBaseUrl: URL) {
    this.scene = scene;
    this.world = physicsWorld;
    this.colliders = new TerrainColliders(physicsWorld);
    this.manifestUrl = manifestUrl;
    this.worldBaseUrl = worldBaseUrl;
    this.worker = new Worker(new URL('./chunk-worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', this.handleWorkerMessage);
  }

  async initialize(): Promise<void> {
    const response = await fetch(this.manifestUrl);
    if (!response.ok) throw new Error(`Could not load world manifest (${response.status}).`);
    const manifest = await response.json() as WorldManifest;
    if (manifest.schemaVersion !== 1 || !manifest.chunks.length || manifest.chunkMeters <= 0) throw new Error('World manifest is invalid or empty.');
    this.manifest = manifest;
  }

  update(camera: THREE.Camera, now: number): void {
    if (this.closed || !this.manifest) return;
    this.processCompleted();
    if (now - this.lastSchedule < SCHEDULE_INTERVAL_MS) return;
    this.lastSchedule = now;
    const nextQueue: string[] = [];
    const x = camera.position.x;
    const z = camera.position.z;
    const loadRadius = this.manifest.chunkMeters * 2;
    const unloadRadius = this.manifest.chunkMeters * 2.4;
    const colliderRadius = this.manifest.chunkMeters * 0.75;
    for (const entry of this.manifest.chunks) {
      const distance = distanceToCenter(x, z, entry);
      let record = this.records.get(entry.id);
      if (record && distance > unloadRadius) {
        this.unload(record);
        this.records.delete(entry.id);
        record = undefined;
      }
      if (!record && distance <= loadRadius) {
        record = { entry, state: 'queued', distance, lod: this.lodForDistance(distance), memoryBytes: 0, hasCollider: false };
        this.records.set(entry.id, record);
      }
      if (!record) continue;
      record.distance = distance;
      if (record.state === 'queued' && distance <= unloadRadius) nextQueue.push(entry.id);
      if (record.state !== 'loaded') continue;
      this.setLod(record, this.lodForDistance(distance));
      const needsCollider = distance <= colliderRadius;
      if (needsCollider && !record.hasCollider && record.result) {
        this.colliders.add(entry.id, entry.bounds, this.manifest.chunkMeters, record.result.heights, record.result.samples);
        record.hasCollider = true;
      } else if (!needsCollider && record.hasCollider) {
        this.colliders.remove(entry.id);
        record.hasCollider = false;
      }
    }
    nextQueue.sort((left, right) => (this.records.get(left)?.distance ?? Infinity) - (this.records.get(right)?.distance ?? Infinity));
    this.loadQueue.length = 0;
    this.loadQueue.push(...nextQueue);
    this.dispatchNext();
  }

  get loadedCount(): number {
    let count = 0;
    for (const record of this.records.values()) if (record.state === 'loaded') count += 1;
    return count;
  }

  get pendingCount(): number {
    let count = 0;
    for (const record of this.records.values()) if (record.state === 'queued' || record.state === 'loading') count += 1;
    return count;
  }

  get colliderCount(): number {
    return this.colliders.count;
  }

  get memoryMiB(): number {
    return this.memoryBytes / (1024 * 1024);
  }

  get failures(): number {
    return this.errorCount;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.worker.removeEventListener('message', this.handleWorkerMessage);
    this.worker.terminate();
    for (const record of this.records.values()) this.unload(record, false);
    this.records.clear();
    this.colliders.clear();
    this.material.dispose();
    this.events.clear();
    this.world.free();
  }

  private lodForDistance(distance: number): number {
    const chunkMeters = this.manifest?.chunkMeters ?? 256;
    return distance < chunkMeters * 0.9 ? 0 : distance < chunkMeters * 1.65 ? 1 : 2;
  }

  private setLod(record: ChunkRecord, lod: number): void {
    if (record.lod === lod || !record.meshes) return;
    record.lod = lod;
    record.meshes.forEach((mesh, index) => { mesh.visible = index === lod; });
  }

  private processCompleted(): void {
    const start = performance.now();
    while (this.completed.length > 0 && performance.now() - start < GEOMETRY_BUDGET_MS) {
      const item = this.completed.shift();
      if (!item) return;
      const record = this.records.get(item.id);
      if (!record || record.state !== 'loading' || !this.manifest) continue;
      const centerX = (record.entry.bounds.minX + record.entry.bounds.maxX) / 2;
      const centerZ = (record.entry.bounds.minZ + record.entry.bounds.maxZ) / 2;
      const meshes = item.result.levels.map((level) => {
        const mesh = new THREE.Mesh(geometryForLod(level, item.result, this.manifest?.chunkMeters ?? 256), this.material);
        mesh.position.set(centerX, 0, centerZ);
        mesh.visible = level.level === record.lod;
        this.scene.add(mesh);
        return mesh;
      });
      record.result = item.result;
      record.meshes = meshes;
      record.memoryBytes = byteSize(meshes) + item.result.heights.byteLength;
      record.state = 'loaded';
      this.memoryBytes += record.memoryBytes;
      this.events.emit('chunkLoaded', { id: item.id, lod: record.lod, memoryBytes: record.memoryBytes });
      this.syncCollider(record);
    }
  }

  private syncCollider(record: ChunkRecord): void {
    if (!record.result || !this.manifest) return;
    if (record.distance <= this.manifest.chunkMeters * 0.75 && !record.hasCollider) {
      this.colliders.add(record.entry.id, record.entry.bounds, this.manifest.chunkMeters, record.result.heights, record.result.samples);
      record.hasCollider = true;
    }
  }

  private dispatchNext(): void {
    if (this.workerBusy || this.loadQueue.length === 0 || !this.manifest || this.closed) return;
    const id = this.loadQueue.shift();
    const record = id ? this.records.get(id) : undefined;
    if (!id || !record || record.state !== 'queued') {
      this.dispatchNext();
      return;
    }
    this.workerBusy = true;
    record.state = 'loading';
    void this.fetchAndSend(record);
  }

  private async fetchAndSend(record: ChunkRecord): Promise<void> {
    try {
      if (record.entry.path !== `${record.entry.id}.bin` || record.entry.bytes > MAX_CHUNK_BYTES) throw new Error(`Unsafe chunk path or size: ${record.entry.id}`);
      const url = new URL(`world/${this.manifest?.region}/${record.entry.path}`, this.worldBaseUrl);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load chunk ${record.entry.id} (${response.status}).`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== record.entry.bytes || buffer.byteLength > MAX_CHUNK_BYTES) throw new Error(`Chunk ${record.entry.id} size check failed.`);
      const actualHash = toHex(await crypto.subtle.digest('SHA-256', buffer));
      if (actualHash !== record.entry.sha256) throw new Error(`Chunk ${record.entry.id} integrity check failed.`);
      this.worker.postMessage({ id: record.entry.id, buffer }, [buffer]);
    } catch (error) {
      this.workerBusy = false;
      record.state = 'error';
      this.errorCount += 1;
      console.error(error);
      this.dispatchNext();
    }
  }

  private readonly handleWorkerMessage = (event: MessageEvent<WorkerResponse>): void => {
    this.workerBusy = false;
    const record = this.records.get(event.data.id);
    if (event.data.result && record?.state === 'loading') this.completed.push({ id: event.data.id, result: event.data.result });
    else if (event.data.error && record) {
      record.state = 'error';
      this.errorCount += 1;
      console.error(event.data.error);
    }
    this.dispatchNext();
  };

  private unload(record: ChunkRecord, emit = true): void {
    if (record.hasCollider) this.colliders.remove(record.entry.id);
    if (record.meshes) {
      for (const mesh of record.meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
      this.memoryBytes = Math.max(0, this.memoryBytes - record.memoryBytes);
    }
    if (emit && record.state === 'loaded') this.events.emit('chunkUnloaded', { id: record.entry.id });
  }
}
