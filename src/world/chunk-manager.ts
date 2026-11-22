import * as THREE from 'three';
import type { World } from '@dimforge/rapier3d-compat';
import { EventBus } from '../engine/event-bus';
import { AssetManager } from '../engine/asset-manager';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { buildChunkBorderGeometry } from './chunk-debug';
import { BuildingRenderer } from './building-renderer';
import { sampleHeight } from './road-geometry';
import { RoadRenderer } from './road-renderer';
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
  buildingMeshes?: THREE.Mesh[][];
  decorationMeshes?: THREE.Mesh[];
  landmarkObjects?: THREE.Object3D[];
  debugBorder?: THREE.LineSegments;
  memoryBytes: number;
  debugMemoryBytes: number;
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
const MAX_ATTACHMENTS_PER_FRAME = 1;
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
    if (mesh instanceof THREE.InstancedMesh) total += mesh.instanceMatrix.array.byteLength;
  }
  return total;
}

function objectByteSize(object: THREE.Object3D): number {
  let bytes = 0;
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const geometry = node.geometry;
    for (const name of Object.keys(geometry.attributes)) bytes += geometry.getAttribute(name).array.byteLength;
    if (geometry.index) bytes += geometry.index.array.byteLength;
  });
  return bytes;
}

export class ChunkManager {
  readonly events = new EventBus<TerrainChunkEvents>();
  readonly worker: Worker;
  private readonly scene: THREE.Scene;
  private readonly world: World;
  private readonly colliders: TerrainColliders;
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, side: THREE.DoubleSide });
  private readonly roadRenderer = new RoadRenderer();
  private readonly buildingRenderer = new BuildingRenderer();
  private readonly debugBorderMaterial = new THREE.LineBasicMaterial({ color: '#f06d4e', depthTest: true, toneMapped: false });
  private readonly records = new Map<string, ChunkRecord>();
  private readonly completed: CompletedChunk[] = [];
  private manifest: WorldManifest | undefined;
  private assets: AssetManager | undefined;
  private manifestUrl: URL;
  private worldBaseUrl: URL;
  private readonly loadQueue: string[] = [];
  private workerBusy = false;
  private lastSchedule = 0;
  private memoryBytes = 0;
  private errorCount = 0;
  private closed = false;
  private debugBordersVisible = false;

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

  async prepareRenderer(renderer: THREE.WebGLRenderer, camera: THREE.Camera): Promise<void> {
    this.assets = new AssetManager(renderer);
    await Promise.all([
      this.roadRenderer.prepare(renderer, this.scene, camera, this.material),
      this.buildingRenderer.prepare(renderer, this.scene, camera, this.material),
    ]);
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
        record = { entry, state: 'queued', distance, lod: this.lodForDistance(distance), memoryBytes: 0, debugMemoryBytes: 0, hasCollider: false };
        this.records.set(entry.id, record);
      }
      if (!record) continue;
      record.distance = distance;
      if (record.state === 'queued' && distance <= unloadRadius) nextQueue.push(entry.id);
      if (record.state !== 'loaded') continue;
      this.setLod(record, this.lodForDistance(distance));
      const needsCollider = distance <= colliderRadius;
      if (needsCollider && !record.hasCollider && record.result) {
        this.addColliders(record);
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

  groundHeightAt(x: number, z: number): number | undefined {
    for (const record of this.records.values()) {
      if (record.state !== 'loaded' || !record.result) continue;
      const bounds = record.entry.bounds;
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;
      return sampleHeight(record.result, x, z);
    }
    return undefined;
  }

  setDebugBorders(visible: boolean): void {
    if (this.closed || this.debugBordersVisible === visible) return;
    this.debugBordersVisible = visible;
    for (const record of this.records.values()) {
      if (visible) this.addDebugBorder(record);
      else this.removeDebugBorder(record);
    }
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
    this.roadRenderer.dispose();
    this.buildingRenderer.dispose();
    this.assets?.dispose();
    this.debugBorderMaterial.dispose();
    this.events.clear();
    this.world.free();
  }

  private lodForDistance(distance: number): number {
    const chunkMeters = this.manifest?.chunkMeters ?? 256;
    return distance < chunkMeters * 0.9 ? 0 : distance < chunkMeters * 1.65 ? 1 : 2;
  }

  private setLod(record: ChunkRecord, lod: number): void {
    if (record.lod === lod) return;
    const current = record.meshes?.[record.lod];
    if (current) {
      current.visible = false;
      this.scene.remove(current);
    }
    for (const mesh of record.buildingMeshes?.[record.lod] ?? []) { mesh.visible = false; this.scene.remove(mesh); }
    record.lod = lod;
    const next = record.meshes?.[lod];
    if (next) {
      next.visible = true;
      this.scene.add(next);
    }
    for (const mesh of record.buildingMeshes?.[lod] ?? []) { mesh.visible = true; this.scene.add(mesh); }
  }

  private processCompleted(): void {
    const start = performance.now();
    let attachments = 0;
    while (this.completed.length > 0 && attachments < MAX_ATTACHMENTS_PER_FRAME && performance.now() - start < GEOMETRY_BUDGET_MS) {
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
        return mesh;
      });
      const activeMesh = meshes[record.lod];
      if (activeMesh) this.scene.add(activeMesh);
      const decorationMeshes = this.roadRenderer.createMeshes(item.result.roads, centerX, centerZ);
      for (const mesh of decorationMeshes) this.scene.add(mesh);
      const buildingMeshes = this.buildingRenderer.createMeshes(item.result.buildings, centerX, centerZ);
      for (const mesh of buildingMeshes[record.lod] ?? []) { mesh.visible = true; this.scene.add(mesh); }
      record.result = item.result;
      record.meshes = meshes;
      record.buildingMeshes = buildingMeshes;
      record.decorationMeshes = decorationMeshes;
      const roadBuffers = item.result.roads;
      const roadDataBytes = roadBuffers
        ? roadBuffers.colliderPositions.byteLength + roadBuffers.colliderIndices.byteLength + roadBuffers.props.reduce((sum, prop) => sum + prop.positions.byteLength + prop.headings.byteLength, 0)
        : 0;
      const buildingDataBytes = item.result.buildings
        ? item.result.buildings.colliderPositions.byteLength + item.result.buildings.colliderIndices.byteLength
        : 0;
      record.memoryBytes = byteSize([...meshes, ...decorationMeshes, ...buildingMeshes.flat()]) + item.result.heights.byteLength + roadDataBytes + buildingDataBytes;
      record.state = 'loaded';
      this.memoryBytes += record.memoryBytes;
      this.addDebugBorder(record);
      this.events.emit('chunkLoaded', { id: item.id, lod: record.lod, memoryBytes: record.memoryBytes });
      this.syncCollider(record);
      this.loadLandmarkModels(record, item.result);
      attachments += 1;
    }
  }

  private syncCollider(record: ChunkRecord): void {
    if (!record.result || !this.manifest) return;
    if (record.distance <= this.manifest.chunkMeters * 0.75 && !record.hasCollider) this.addColliders(record);
  }

  private addColliders(record: ChunkRecord): void {
    if (!record.result || !this.manifest || record.hasCollider) return;
    this.colliders.add(record.entry.id, record.entry.bounds, this.manifest.chunkMeters, record.result.heights, record.result.samples);
    const centerX = (record.entry.bounds.minX + record.entry.bounds.maxX) / 2;
    const centerZ = (record.entry.bounds.minZ + record.entry.bounds.maxZ) / 2;
    const roads = record.result.roads;
    if (roads) this.colliders.addRoads(record.entry.id, centerX, centerZ, roads.colliderPositions, roads.colliderIndices);
    const buildings = record.result.buildings;
    if (buildings) this.colliders.addBuildings(record.entry.id, centerX, centerZ, buildings.colliderPositions, buildings.colliderIndices);
    record.hasCollider = true;
  }

  private loadLandmarkModels(record: ChunkRecord, result: BuiltTerrainChunk): void {
    const models = result.buildings?.landmarkModels ?? [];
    if (!this.assets || models.length === 0) return;
    for (const instance of models) {
      if (!/^landmarks\/w\d+\.glb$/.test(instance.path)) continue;
      const url = new URL(instance.path, this.worldBaseUrl);
      void this.assets.loadModel(url.href, 10).then((gltf: GLTF) => {
        if (this.closed || this.records.get(record.entry.id) !== record || record.state !== 'loaded') return;
        const object = gltf.scene.clone(true);
        object.position.set(instance.position[0], instance.position[1], instance.position[2]);
        object.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
        this.scene.add(object);
        record.landmarkObjects ??= [];
        record.landmarkObjects.push(object);
        const bytes = objectByteSize(object);
        record.memoryBytes += bytes;
        this.memoryBytes += bytes;
      }).catch((error: unknown) => {
        this.errorCount += 1;
        console.error(`Could not load landmark model ${instance.path}.`, error);
      });
    }
  }

  private addDebugBorder(record: ChunkRecord): void {
    if (!this.debugBordersVisible || !record.result || record.debugBorder) return;
    const geometry = buildChunkBorderGeometry(record.result);
    const border = new THREE.LineSegments(geometry, this.debugBorderMaterial);
    this.scene.add(border);
    record.debugBorder = border;
    record.debugMemoryBytes = geometry.attributes.position?.array.byteLength ?? 0;
    this.memoryBytes += record.debugMemoryBytes;
  }

  private removeDebugBorder(record: ChunkRecord): void {
    if (!record.debugBorder) return;
    this.scene.remove(record.debugBorder);
    record.debugBorder.geometry.dispose();
    record.debugBorder = undefined;
    this.memoryBytes = Math.max(0, this.memoryBytes - record.debugMemoryBytes);
    record.debugMemoryBytes = 0;
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
    this.removeDebugBorder(record);
    if (record.hasCollider) this.colliders.remove(record.entry.id);
    if (record.meshes) {
      for (const mesh of record.meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
      this.memoryBytes = Math.max(0, this.memoryBytes - record.memoryBytes);
    }
    if (record.decorationMeshes) {
      for (const mesh of record.decorationMeshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    if (record.buildingMeshes) {
      for (const level of record.buildingMeshes) {
        for (const mesh of level) { this.scene.remove(mesh); mesh.geometry.dispose(); }
      }
    }
    if (record.landmarkObjects) for (const object of record.landmarkObjects) this.scene.remove(object);
    if (emit && record.state === 'loaded') this.events.emit('chunkUnloaded', { id: record.entry.id });
  }
}
