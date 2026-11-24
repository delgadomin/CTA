import * as THREE from 'three';
import { createBuildingMaterials } from './building-materials';
import type { BuiltBuildingChunk, BuildingSurfaceGeometry } from './types';

function buildingGeometry(surface: BuildingSurfaceGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(surface.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(surface.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(surface.colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(surface.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export class BuildingRenderer {
  private readonly materials = createBuildingMaterials();

  createMeshes(
    buildings: BuiltBuildingChunk | undefined,
    centerX: number,
    centerZ: number,
  ): THREE.Mesh[][] {
    if (!buildings) return [];
    return buildings.levels.map((level) =>
      level.surfaces.flatMap((surface) => {
        const material = this.materials.get(surface.material);
        if (!material || surface.indices.length === 0) return [];
        const mesh = new THREE.Mesh(buildingGeometry(surface), material);
        mesh.position.set(centerX, 0, centerZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.visible = false;
        return [mesh];
      }),
    );
  }

  async prepare(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    terrainMaterial: THREE.Material,
  ): Promise<void> {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const warmup: THREE.Mesh[] = [new THREE.Mesh(geometry, terrainMaterial)];
    for (const material of this.materials.values()) {
      if (material.map) renderer.initTexture(material.map);
      if (material.emissiveMap) renderer.initTexture(material.emissiveMap);
      warmup.push(new THREE.Mesh(geometry, material));
    }
    for (const mesh of warmup) scene.add(mesh);
    try {
      await renderer.compileAsync(scene, camera);
    } finally {
      for (const mesh of warmup) scene.remove(mesh);
      geometry.dispose();
    }
  }

  setNight(enabled: boolean): void {
    const intensity = enabled ? 1.35 : 0;
    for (const [kind, material] of this.materials) {
      if (kind.endsWith('_facade')) material.emissiveIntensity = intensity;
    }
  }

  dispose(): void {
    for (const material of this.materials.values()) {
      material.map?.dispose();
      material.emissiveMap?.dispose();
      material.dispose();
    }
  }
}
