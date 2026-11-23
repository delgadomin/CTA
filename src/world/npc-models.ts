import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function colorPart(geometry: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const count = geometry.getAttribute('position')?.count ?? 0;
  const tint = new THREE.Color(color);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) colors.set([tint.r, tint.g, tint.b], index * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function addPart(parts: THREE.BufferGeometry[], geometry: THREE.BufferGeometry, color: number, position: THREE.Vector3): void {
  geometry.translate(position.x, position.y, position.z);
  parts.push(colorPart(geometry, color));
}

function finish(parts: THREE.BufferGeometry[], fallback: THREE.BufferGeometry): THREE.BufferGeometry {
  return mergeGeometries(parts, false) ?? colorPart(fallback, 0xffffff);
}

/** Low-poly but shaped crowd models, merged so each agent category stays one draw call. */
function pedestrianGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  addPart(parts, new THREE.CapsuleGeometry(0.23, 0.38, 4, 8), 0xffffff, new THREE.Vector3(0, 1.15, 0));
  addPart(parts, new THREE.CylinderGeometry(0.11, 0.13, 0.14, 8), 0xd8d0c4, new THREE.Vector3(0, 1.45, 0));
  addPart(parts, new THREE.SphereGeometry(0.145, 10, 8), 0xe8bd9b, new THREE.Vector3(0, 1.68, 0));
  addPart(parts, new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x38271f, new THREE.Vector3(0, 1.73, 0));
  for (const side of [-1, 1]) {
    const arm = new THREE.CapsuleGeometry(0.075, 0.35, 3, 6);
    arm.rotateZ(side * -0.12);
    addPart(parts, arm, 0xffffff, new THREE.Vector3(side * 0.29, 1.12, 0));
    addPart(parts, new THREE.SphereGeometry(0.065, 7, 5), 0xe8bd9b, new THREE.Vector3(side * 0.32, 0.83, 0));
    const leg = new THREE.CapsuleGeometry(0.085, 0.43, 3, 6);
    addPart(parts, leg, 0x353a43, new THREE.Vector3(side * 0.12, 0.48, 0));
    const shoe = new THREE.BoxGeometry(0.15, 0.12, 0.26);
    addPart(parts, shoe, 0x282522, new THREE.Vector3(side * 0.12, 0.08, 0.055));
  }
  return finish(parts, new THREE.CapsuleGeometry(0.25, 1.2, 4, 8));
}

function cabinGeometry(): THREE.BufferGeometry {
  // A tapered cabin gives the silhouette a windscreen and roof line instead
  // of the toy-like upright cube used previously.
  const vertices = new Float32Array([
    -0.72, 0.78, 0.82,  0.72, 0.78, 0.82,  0.72, 0.78, -0.78, -0.72, 0.78, -0.78,
    -0.52, 1.34, 0.43,  0.52, 1.34, 0.43,  0.52, 1.34, -0.48, -0.52, 1.34, -0.48,
  ]);
  const indices = [0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7, 4, 5, 6, 4, 6, 7, 0, 3, 2, 0, 2, 1];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function vehicleGeometry(police = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CapsuleGeometry(0.72, 2.15, 3, 8);
  body.rotateX(Math.PI / 2);
  body.scale(1, 0.47, 1);
  addPart(parts, body, 0xffffff, new THREE.Vector3(0, 0.62, 0));
  addPart(parts, cabinGeometry(), 0x273d49, new THREE.Vector3(0, 0, 0));
  addPart(parts, new THREE.BoxGeometry(1.58, 0.16, 1.15), 0xffffff, new THREE.Vector3(0, 0.72, 1.18));
  addPart(parts, new THREE.BoxGeometry(1.58, 0.16, 0.88), 0xffffff, new THREE.Vector3(0, 0.72, -1.42));
  addPart(parts, new THREE.BoxGeometry(1.92, 0.13, 0.16), 0x4b4a46, new THREE.Vector3(0, 0.42, 2.02));
  addPart(parts, new THREE.BoxGeometry(1.92, 0.13, 0.16), 0x4b4a46, new THREE.Vector3(0, 0.42, -2.02));
  for (const side of [-1, 1]) {
    addPart(parts, new THREE.BoxGeometry(0.34, 0.2, 0.13), 0xffe8ad, new THREE.Vector3(side * 0.61, 0.67, 1.91));
    addPart(parts, new THREE.BoxGeometry(0.3, 0.18, 0.12), 0xd85145, new THREE.Vector3(side * 0.64, 0.67, -1.93));
    const mirror = new THREE.BoxGeometry(0.16, 0.12, 0.24);
    addPart(parts, mirror, 0xffffff, new THREE.Vector3(side * 0.82, 1.02, 0.46));
    const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10);
    wheel.rotateZ(Math.PI / 2);
    addPart(parts, wheel, 0x25272a, new THREE.Vector3(side * 0.89, 0.36, 1.32));
    const rearWheel = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10);
    rearWheel.rotateZ(Math.PI / 2);
    addPart(parts, rearWheel, 0x25272a, new THREE.Vector3(side * 0.89, 0.36, -1.32));
    for (const z of [1.32, -1.32]) {
      const hub = new THREE.CylinderGeometry(0.15, 0.15, 0.23, 8);
      hub.rotateZ(Math.PI / 2);
      addPart(parts, hub, 0x9da2a5, new THREE.Vector3(side * 0.9, 0.36, z));
    }
  }
  if (police) {
    addPart(parts, new THREE.BoxGeometry(0.9, 0.12, 0.25), 0x202c37, new THREE.Vector3(0, 1.42, -0.05));
    addPart(parts, new THREE.BoxGeometry(0.36, 0.12, 0.23), 0x3b8dff, new THREE.Vector3(-0.24, 1.51, -0.05));
    addPart(parts, new THREE.BoxGeometry(0.36, 0.12, 0.23), 0xe34d4d, new THREE.Vector3(0.24, 1.51, -0.05));
  }
  return finish(parts, new THREE.BoxGeometry(1.9, 1, 4.1));
}

function material(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.76, metalness: 0.08 });
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
