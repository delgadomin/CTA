import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Procedural low-poly agent models. A single merged geometry per kind keeps the
 * whole crowd at two draw calls and uses no external or copyrighted assets.
 */
function pedestrianGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const torso = new THREE.BoxGeometry(0.42, 0.72, 0.24);
  torso.translate(0, 1.18, 0);
  parts.push(torso);
  const head = new THREE.SphereGeometry(0.14, 8, 6);
  head.translate(0, 1.69, 0);
  parts.push(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.BoxGeometry(0.12, 0.6, 0.13);
    arm.translate(side * 0.29, 1.16, 0);
    parts.push(arm);
    const leg = new THREE.BoxGeometry(0.15, 0.82, 0.16);
    leg.translate(side * 0.12, 0.41, 0);
    parts.push(leg);
  }
  return mergeGeometries(parts, false) ?? new THREE.BoxGeometry(0.5, 1.7, 0.3);
}

function vehicleGeometry(police = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.BoxGeometry(1.86, 0.52, 4.1);
  body.translate(0, 0.62, 0);
  parts.push(body);
  const cabin = new THREE.BoxGeometry(1.52, 0.5, 1.9);
  cabin.translate(0, 1.09, -0.2);
  parts.push(cabin);
  if (police) {
    // A light bar is enough to read as a patrol car without any external asset.
    const bar = new THREE.BoxGeometry(0.94, 0.14, 0.28);
    bar.translate(0, 1.41, -0.2);
    parts.push(bar);
  }
  const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10);
  wheel.rotateZ(Math.PI / 2);
  for (const x of [-0.94, 0.94]) {
    for (const z of [-1.32, 1.32]) {
      const copy = wheel.clone();
      copy.translate(x, 0.36, z);
      parts.push(copy);
    }
  }
  return mergeGeometries(parts, false) ?? new THREE.BoxGeometry(1.9, 1.1, 4.1);
}

function material(): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.04 });
  result.vertexColors = false;
  return result;
}

export function createPedestrianMesh(capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(pedestrianGeometry(), material(), capacity);
  mesh.name = 'pedestrians';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

export function createVehicleMesh(capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(vehicleGeometry(), material(), capacity);
  mesh.name = 'traffic';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

export function createPoliceMesh(capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(vehicleGeometry(true), material(), capacity);
  mesh.name = 'police';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

export function disposeAgentMesh(mesh: THREE.InstancedMesh): void {
  mesh.geometry.dispose();
  const mat = mesh.material;
  if (Array.isArray(mat)) for (const item of mat) item.dispose();
  else mat.dispose();
  mesh.dispose();
}
