import * as THREE from 'three';
import { CameraRig } from './engine/camera-rig';
import { EntityStore } from './engine/ecs';
import { FixedStepLoop } from './engine/game-loop';
import type { GameSystem } from './engine/game-loop';
import { InputManager } from './engine/input-manager';
import { Logger } from './engine/logger';
import { QUALITY_PRESETS } from './engine/quality';
import './style.css';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`The diagnostic scene is missing ${selector}.`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>('#world');
const fpsLabel = requiredElement<HTMLElement>('#fps');
const callsLabel = requiredElement<HTMLElement>('#draw-calls');
const trianglesLabel = requiredElement<HTMLElement>('#triangles');
const quality = QUALITY_PRESETS.medium;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9c2c4');
scene.fog = new THREE.Fog('#a9c2c4', 9, 24);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4.2, 3.1, 6.5);
camera.lookAt(0, 0.4, 0);
const input = new InputManager(canvas);
const cameraRig = new CameraRig(camera, input);
const logger = new Logger('engine', 'info');

const entities = new EntityStore(64);
const cubeId = entities.create();
const cubeSlot = cubeId & 0xffff;
entities.setPosition(cubeId, 0, 0.95, 0);
const cubeGeometry = new THREE.BoxGeometry(1.35, 1.35, 1.35);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: '#c88655', roughness: 0.62, flatShading: true });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
scene.add(cube);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: '#536c5a', roughness: 0.96 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
scene.add(new THREE.HemisphereLight('#e7eff0', '#485442', 2.1));
const sun = new THREE.DirectionalLight('#fff0d2', 3.2);
sun.position.set(-3, 7, 4);
scene.add(sun);

let frameCount = 0;
let fpsWindowStart = performance.now();
let showDebug = true;
let previousCubeYaw = 0;

const systems: readonly GameSystem[] = [
  {
    name: 'diagnostic-spin',
    order: 10,
    update: (deltaSeconds: number): void => {
      const rotationOffset = cubeSlot * 3 + 1;
      previousCubeYaw = entities.rotation[rotationOffset] ?? 0;
      entities.rotation[rotationOffset] = (entities.rotation[rotationOffset] ?? 0) + deltaSeconds * 0.58;
    },
  },
];

const loop = new FixedStepLoop(systems, (interpolation, frameSeconds, timestamp) => {
  cameraRig.update(frameSeconds, cube.position);
  const currentCubeYaw = entities.rotation[cubeSlot * 3 + 1] ?? 0;
  cube.rotation.y = previousCubeYaw + (currentCubeYaw - previousCubeYaw) * interpolation;
  cube.rotation.x = Math.sin(timestamp * 0.00035) * 0.08;
  renderer.render(scene, camera);
  frameCount += 1;
  if (timestamp - fpsWindowStart >= 500) {
    fpsLabel.textContent = String(Math.round((frameCount * 1000) / (timestamp - fpsWindowStart)));
    callsLabel.textContent = String(renderer.info.render.calls);
    trianglesLabel.textContent = renderer.info.render.triangles.toLocaleString('es-ES');
    frameCount = 0;
    fpsWindowStart = timestamp;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.code !== 'F3') return;
  event.preventDefault();
  showDebug = !showDebug;
  document.querySelector<HTMLElement>('.debug-panel')?.classList.toggle('is-hidden', !showDebug);
});

canvas.addEventListener('click', () => input.requestPointerLock());
window.addEventListener('pagehide', () => {
  loop.stop();
  input.dispose();
  cubeGeometry.dispose();
  cubeMaterial.dispose();
  renderer.dispose();
});

logger.info('Engine initialized', { quality: 'medium', stepHz: 60, entities: entities.capacity });
loop.start();
