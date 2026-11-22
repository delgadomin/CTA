import * as THREE from 'three';
import { createRoadMaterials, createRoadPropMaterial } from './road-materials';
import type { BuiltRoadChunk, RoadSurfaceGeometry } from './types';

function roadGeometry(road: RoadSurfaceGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(road.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(road.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(road.colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(road.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(road.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function propGeometry(kind: BuiltRoadChunk['props'][number]['kind']): THREE.BufferGeometry {
  if (kind === 'street_lamp') return new THREE.CylinderGeometry(0.045, 0.08, 4.3, 6);
  if (kind === 'traffic_signals') {
    const geometry = new THREE.BoxGeometry(0.22, 2.8, 0.2);
    geometry.translate(0, 1.4, 0);
    return geometry;
  }
  const shape = new THREE.Shape();
  shape.moveTo(-0.045, 0);
  shape.lineTo(0.045, 0);
  shape.lineTo(0.045, 1.7);
  if (kind === 'give_way') {
    shape.lineTo(0.27, 1.82);
    shape.lineTo(0, 2.26);
    shape.lineTo(-0.27, 1.82);
  } else {
    shape.lineTo(0.18, 1.84);
    shape.lineTo(0.18, 2.02);
    shape.lineTo(0.1, 2.1);
    shape.lineTo(-0.1, 2.1);
    shape.lineTo(-0.18, 2.02);
    shape.lineTo(-0.18, 1.84);
  }
  shape.lineTo(-0.045, 1.7);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.computeVertexNormals();
  return geometry;
}

export class RoadRenderer {
  private readonly roadMaterials = createRoadMaterials();
  private readonly propMaterials = new Map(['traffic_signals', 'stop', 'give_way', 'street_lamp'].map((kind) => [kind, createRoadPropMaterial(kind)]));
  private readonly materials = new Map([...this.roadMaterials, ...this.propMaterials]);

  createMeshes(roads: BuiltRoadChunk | undefined, centerX: number, centerZ: number): THREE.Mesh[] {
    if (!roads) return [];
    const meshes: THREE.Mesh[] = [];
    for (const surface of roads.surfaces) {
      if (surface.indices.length === 0) continue;
      const mesh = new THREE.Mesh(roadGeometry(surface), this.materials.get(surface.style));
      mesh.position.set(centerX, 0, centerZ);
      mesh.receiveShadow = true;
      meshes.push(mesh);
    }
    if (roads.markings.indices.length > 0) {
      const markings = new THREE.Mesh(roadGeometry(roads.markings), this.materials.get('marking'));
      markings.position.set(centerX, 0, centerZ);
      meshes.push(markings);
    }
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    for (const batch of roads.props) {
      if (batch.positions.length < 3) continue;
      const mesh = new THREE.InstancedMesh(propGeometry(batch.kind), this.materials.get(batch.kind), batch.positions.length / 3);
      for (let index = 0; index < batch.positions.length / 3; index += 1) {
        const offset = index * 3;
        const height = batch.kind === 'street_lamp' ? 2.15 : batch.kind === 'traffic_signals' ? 0 : 0;
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), batch.headings[index] ?? 0);
        matrix.compose(new THREE.Vector3(batch.positions[offset] ?? 0, (batch.positions[offset + 1] ?? 0) + height, batch.positions[offset + 2] ?? 0), rotation, scale);
        mesh.setMatrixAt(index, matrix);
      }
      mesh.computeBoundingSphere();
      mesh.position.set(centerX, 0, centerZ);
      meshes.push(mesh);
    }
    return meshes;
  }

  async prepare(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, terrainMaterial: THREE.Material): Promise<void> {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const warmup: THREE.Mesh[] = [new THREE.Mesh(geometry, terrainMaterial)];
    for (const material of this.roadMaterials.values()) warmup.push(new THREE.Mesh(geometry, material));
    for (const material of this.propMaterials.values()) warmup.push(new THREE.InstancedMesh(geometry, material, 1));
    for (const material of this.materials.values()) if (material.map) renderer.initTexture(material.map);
    for (const mesh of warmup) scene.add(mesh);
    try {
      await renderer.compileAsync(scene, camera);
    } finally {
      for (const mesh of warmup) scene.remove(mesh);
      geometry.dispose();
    }
  }

  dispose(): void {
    for (const material of this.roadMaterials.values()) {
      material.map?.dispose();
      material.dispose();
    }
    for (const material of this.propMaterials.values()) material.dispose();
  }
}
