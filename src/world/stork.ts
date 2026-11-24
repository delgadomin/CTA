import * as THREE from 'three';

const bodyGeometry = new THREE.SphereGeometry(0.42, 8, 6);
const wingGeometry = new THREE.BoxGeometry(0.12, 0.06, 0.9);
const neckGeometry = new THREE.CylinderGeometry(0.075, 0.12, 0.72, 6);
const headGeometry = new THREE.SphereGeometry(0.14, 7, 5);
const beakGeometry = new THREE.ConeGeometry(0.055, 0.36, 5);
const legGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.68, 5);
const whiteMaterial = new THREE.MeshStandardMaterial({ color: '#f4f0e7', roughness: 0.9 });
const blackMaterial = new THREE.MeshStandardMaterial({ color: '#252a2b', roughness: 0.92 });
const legMaterial = new THREE.MeshStandardMaterial({ color: '#bd5b2b', roughness: 0.8 });
const flight = new WeakMap<
  THREE.Group,
  { start: THREE.Vector3; direction: THREE.Vector3; began: number }
>();

export function createStork(): THREE.Group {
  const stork = new THREE.Group();
  const body = new THREE.Mesh(bodyGeometry, whiteMaterial);
  body.scale.set(0.85, 0.72, 1.2);
  body.castShadow = true;
  stork.add(body);

  const neck = new THREE.Mesh(neckGeometry, whiteMaterial);
  neck.position.set(0, 0.45, 0.34);
  neck.rotation.x = -0.28;
  neck.castShadow = true;
  stork.add(neck);
  const head = new THREE.Mesh(headGeometry, whiteMaterial);
  head.position.set(0, 0.78, 0.46);
  stork.add(head);
  const beak = new THREE.Mesh(beakGeometry, legMaterial);
  beak.position.set(0, 0.74, 0.7);
  beak.rotation.x = Math.PI / 2;
  stork.add(beak);

  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.3, 0.05, -0.08);
    const feather = new THREE.Mesh(wingGeometry, blackMaterial);
    feather.position.set(side * 0.43, 0, -0.08);
    feather.rotation.z = side * 0.08;
    feather.castShadow = true;
    wing.add(feather);
    stork.add(wing);
    wings.push(wing);
  }

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(side * 0.14, -0.46, -0.03);
    leg.castShadow = true;
    stork.add(leg);
  }
  stork.userData.storkWings = wings;
  return stork;
}

export function updateStork(stork: THREE.Group, player: THREE.Vector3, now: number): void {
  const wings = stork.userData.storkWings as THREE.Group[] | undefined;
  let state = flight.get(stork);
  if (!state) {
    const distance = stork.position.distanceTo(player);
    if (distance < 28) {
      const direction = stork.position.clone().sub(player);
      if (direction.lengthSq() < 1e-4) direction.set(1, 0, 0);
      direction.y = 0.28;
      direction.normalize();
      state = { start: stork.position.clone(), direction, began: now };
      flight.set(stork, state);
    }
  }

  if (state) {
    const elapsed = (now - state.began) / 1000;
    if ((elapsed >= 7 && stork.position.distanceTo(player) > 70) || elapsed >= 18) {
      stork.position.copy(state.start);
      stork.rotation.set(0, 0, 0);
      flight.delete(stork);
      state = undefined;
    } else {
      const travel = Math.min(elapsed, 7);
      stork.position.copy(state.start).addScaledVector(state.direction, travel * 3.2);
      stork.position.y += Math.sin(elapsed * 2.2) * 0.75 + Math.min(elapsed, 2) * 1.7;
      stork.rotation.y = Math.atan2(state.direction.x, state.direction.z);
    }
  }

  if (wings) {
    const angle = state ? Math.sin(now * 0.018) * 0.62 : Math.sin(now * 0.0018) * 0.06;
    wings[0]!.rotation.z = angle;
    wings[1]!.rotation.z = -angle;
  }
}
