import * as THREE from 'three';
import type { BuiltTerrainChunk, ChunkEntry } from './types';

export interface DebugChunkView {
  readonly entry: ChunkEntry;
  readonly result: BuiltTerrainChunk;
  readonly terrainGeometry: THREE.BufferGeometry | undefined;
  readonly lod: number;
  readonly hasCollider: boolean;
}

function colliderMesh(
  positions: Float32Array,
  indices: Uint32Array,
  material: THREE.Material,
): THREE.Mesh | undefined {
  if (positions.length < 9 || indices.length < 3) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

/** Creates opt-in wireframes from the same geometries used by active colliders. */
export class ChunkDebugOverlays {
  private readonly scene: THREE.Scene;
  private readonly views = new Map<string, DebugChunkView>();
  private readonly colliderGroupMaterial = new THREE.MeshBasicMaterial({
    color: '#f5d547',
    wireframe: true,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    toneMapped: false,
  });
  private readonly roadMaterial = new THREE.MeshBasicMaterial({
    color: '#53d6ff',
    wireframe: true,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    toneMapped: false,
  });
  private readonly buildingMaterial = new THREE.MeshBasicMaterial({
    color: '#ff6d62',
    wireframe: true,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    toneMapped: false,
  });
  private showColliders = false;
  private showRoadSurfaces = false;
  private showLodBounds = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  updateChunk(view: DebugChunkView): void {
    this.views.set(view.entry.id, view);
    this.removeChunkObjects(view.entry.id);
    this.addChunkObjects(view);
  }

  removeChunk(id: string): void {
    this.views.delete(id);
    this.removeChunkObjects(id);
  }

  setColliders(visible: boolean): void {
    if (this.showColliders === visible) return;
    this.showColliders = visible;
    this.refresh();
  }

  setRoadSurfaces(visible: boolean): void {
    if (this.showRoadSurfaces === visible) return;
    this.showRoadSurfaces = visible;
    this.refresh();
  }

  setLodBounds(visible: boolean): void {
    if (this.showLodBounds === visible) return;
    this.showLodBounds = visible;
    this.refresh();
  }

  dispose(): void {
    for (const id of this.views.keys()) this.removeChunkObjects(id);
    this.views.clear();
    this.colliderGroupMaterial.dispose();
    this.roadMaterial.dispose();
    this.buildingMaterial.dispose();
  }

  private refresh(): void {
    for (const view of this.views.values()) {
      this.removeChunkObjects(view.entry.id);
      this.addChunkObjects(view);
    }
  }

  private addChunkObjects(view: DebugChunkView): void {
    const { entry, result } = view;
    const centerX = (entry.bounds.minX + entry.bounds.maxX) / 2;
    const centerZ = (entry.bounds.minZ + entry.bounds.maxZ) / 2;
    if (this.showColliders && view.hasCollider) {
      const group = new THREE.Group();
      group.name = `debug-colliders-${entry.id}`;
      group.position.set(centerX, 0, centerZ);
      if (view.terrainGeometry) {
        const terrain = new THREE.Mesh(view.terrainGeometry.clone(), this.colliderGroupMaterial);
        terrain.name = 'terrain collider';
        group.add(terrain);
      }
      const roads =
        result.roads &&
        colliderMesh(
          result.roads.colliderPositions,
          result.roads.colliderIndices,
          this.roadMaterial,
        );
      const buildings =
        result.buildings &&
        colliderMesh(
          result.buildings.colliderPositions,
          result.buildings.colliderIndices,
          this.buildingMaterial,
        );
      if (roads) {
        roads.name = 'road colliders';
        group.add(roads);
      }
      if (buildings) {
        buildings.name = 'building colliders';
        group.add(buildings);
      }
      this.scene.add(group);
      this.colliderGroups.set(entry.id, group);
    }
    if (this.showRoadSurfaces && result.roads) {
      const roads = colliderMesh(
        result.roads.colliderPositions,
        result.roads.colliderIndices,
        this.roadMaterial,
      );
      if (roads) {
        roads.name = `debug-road-surface-${entry.id}`;
        roads.position.set(centerX, 0.08, centerZ);
        this.scene.add(roads);
        this.roadMeshes.set(entry.id, roads);
      }
    }
    if (this.showLodBounds) {
      const { minimumHeight, maximumHeight } = result;
      const box = new THREE.Box3(
        new THREE.Vector3(entry.bounds.minX, minimumHeight, entry.bounds.minZ),
        new THREE.Vector3(entry.bounds.maxX, maximumHeight, entry.bounds.maxZ),
      );
      const color = view.lod === 0 ? '#61e294' : view.lod === 1 ? '#f5d547' : '#ff6d62';
      const helper = new THREE.Box3Helper(box, color);
      helper.name = `debug-lod-${view.lod}-${entry.id}`;
      this.scene.add(helper);
      this.lodHelpers.set(entry.id, helper);
    }
  }

  private readonly colliderGroups = new Map<string, THREE.Group>();
  private readonly roadMeshes = new Map<string, THREE.Mesh>();
  private readonly lodHelpers = new Map<string, THREE.Box3Helper>();

  private removeChunkObjects(id: string): void {
    const group = this.colliderGroups.get(id);
    if (group) {
      this.scene.remove(group);
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      this.colliderGroups.delete(id);
    }
    const road = this.roadMeshes.get(id);
    if (road) {
      this.scene.remove(road);
      road.geometry.dispose();
      this.roadMeshes.delete(id);
    }
    const helper = this.lodHelpers.get(id);
    if (helper) {
      this.scene.remove(helper);
      helper.geometry.dispose();
      if (Array.isArray(helper.material))
        for (const material of helper.material) material.dispose();
      else helper.material.dispose();
      this.lodHelpers.delete(id);
    }
  }
}
