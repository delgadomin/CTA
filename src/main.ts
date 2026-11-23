import * as THREE from 'three';
import { CameraRig } from './engine/camera-rig';
import { FixedStepLoop } from './engine/game-loop';
import { InputManager } from './engine/input-manager';
import { Logger } from './engine/logger';
import { QUALITY_PRESETS } from './engine/quality';
import { ChunkManager } from './world/chunk-manager';
import { Character } from './world/character';
import { Vehicle } from './world/vehicle';
import { createPhysicsWorld } from './world/terrain-physics';
import type { World } from '@dimforge/rapier3d-compat';
import './style.css';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Falta un elemento requerido: ${selector}.`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>('#world');
const fpsLabel = requiredElement<HTMLElement>('#fps');
const frameLabel = requiredElement<HTMLElement>('#frame-time');
const chunksLabel = requiredElement<HTMLElement>('#chunks');
const collidersLabel = requiredElement<HTMLElement>('#colliders');
const drawCallsLabel = requiredElement<HTMLElement>('#draw-calls');
const trianglesLabel = requiredElement<HTMLElement>('#triangles');
const memoryLabel = requiredElement<HTMLElement>('#memory');
const statusLabel = requiredElement<HTMLElement>('#world-status');
const quality = QUALITY_PRESETS.medium;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor('#a9c2c4');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9c2c4');
scene.fog = new THREE.Fog('#a9c2c4', quality.viewDistance * 0.45, quality.viewDistance);
const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.5, quality.viewDistance + 50);
camera.position.set(0, 570, 72);
const input = new InputManager(canvas);
const cameraRig = new CameraRig(camera, input, 5.2, 0.002, 2.07, -0.12);
cameraRig.mode = 'thirdPerson';
const logger = new Logger('world', 'info');
const character = new Character();
scene.add(new THREE.HemisphereLight('#e7eff0', '#475447', 2.25));
scene.add(character.group);
const sun = new THREE.DirectionalLight('#fff0d2', 3.0);
sun.position.set(-320, 700, 250);
scene.add(sun);

let world: World | undefined;
let chunks: ChunkManager | undefined;
const vehicles: Vehicle[] = [];
let activeVehicle: Vehicle | null = null;
let inVehicle = false;
let spacePressed = false;
let showDebug = true;
let frameCount = 0;
let frameWindowStart = performance.now();
let previousFrameTimestamp = frameWindowStart;
let maximumFrameMs = 0;
let lastStatsUpdate = frameWindowStart;

function updateDebug(timestamp: number): void {
  if (!chunks || timestamp - lastStatsUpdate < 250) return;
  chunksLabel.textContent = `${chunks.loadedCount} cargados · ${chunks.pendingCount} en cola · ${chunks.failures} errores`;
  collidersLabel.textContent = String(chunks.colliderCount);
  drawCallsLabel.textContent = String(renderer.info.render.calls);
  trianglesLabel.textContent = renderer.info.render.triangles.toLocaleString('es-ES');
  memoryLabel.textContent = `≈ ${chunks.memoryMiB.toFixed(1)} MiB`;
  statusLabel.textContent = chunks.loadedCount > 0 ? 'Edificios, calles y terreno MDT05 en streaming' : 'Preparando la ciudad desde datos oficiales…';
  lastStatsUpdate = timestamp;
}

const loop = new FixedStepLoop([], (interpolation, frameSeconds, timestamp) => {
  void interpolation;
  const rawFrameMs = Math.max(0, timestamp - previousFrameTimestamp);
  previousFrameTimestamp = timestamp;
  maximumFrameMs = Math.max(maximumFrameMs, rawFrameMs);
  if (inVehicle && activeVehicle) {
    const driveInput = {
      forward: input.isPressed('moveForward'),
      backward: input.isPressed('moveBack'),
      left: input.isPressed('moveLeft'),
      right: input.isPressed('moveRight'),
      handbrake: spacePressed,
    };
    activeVehicle.update(frameSeconds, driveInput);
    cameraRig.mode = 'thirdPerson';
    cameraRig.update(frameSeconds, activeVehicle.position);
  } else if (cameraRig.mode === 'thirdPerson') {
    character.update(frameSeconds, input, chunks, cameraRig.getYaw(), spacePressed);
    cameraRig.update(frameSeconds, character.position);
  } else {
    cameraRig.update(frameSeconds);
    character.position.copy(camera.position);
    const characterGround = chunks?.groundHeightAt(character.position.x, character.position.z);
    if (characterGround !== undefined) character.position.y = characterGround;
  }
  if (cameraRig.mode === 'free') {
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -500, 500);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -500, 500);
    const groundHeight = chunks?.groundHeightAt(camera.position.x, camera.position.z);
    if (groundHeight !== undefined) camera.position.y = groundHeight + 1.7;
  }
  chunks?.update(camera, timestamp);
  renderer.render(scene, camera);
  frameCount += 1;
  if (timestamp - frameWindowStart >= 500) {
    fpsLabel.textContent = String(Math.round((frameCount * 1000) / (timestamp - frameWindowStart)));
    frameLabel.textContent = `${maximumFrameMs.toFixed(1)} ms`;
    frameCount = 0;
    frameWindowStart = timestamp;
    maximumFrameMs = 0;
  }
  updateDebug(timestamp);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.code !== 'F4') return;
  event.preventDefault();
  showDebug = !showDebug;
  document.querySelector<HTMLElement>('.debug-panel')?.classList.toggle('is-hidden', !showDebug);
  chunks?.setDebugBorders(showDebug);
});

canvas.addEventListener('click', () => input.requestPointerLock());
window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.code === 'Space') { spacePressed = true; event.preventDefault(); }
  if (event.code === 'KeyE') {
    if (inVehicle && activeVehicle) {
      character.position.copy(activeVehicle.position);
      character.position.x += 2;
      const h = chunks?.groundHeightAt(character.position.x, character.position.z);
      if (h !== undefined) character.position.y = h;
      inVehicle = false;
      activeVehicle = null;
      character.group.visible = true;
      cameraRig.mode = 'thirdPerson';
    } else {
      // find nearest vehicle
      let nearest: Vehicle | null = null;
      let best = 3;
      for (const v of vehicles) {
        const d = v.position.distanceTo(character.position);
        if (d < best) { best = d; nearest = v; }
      }
      if (nearest) {
        inVehicle = true;
        activeVehicle = nearest;
        character.position.copy(nearest.position);
        character.group.visible = false;
      }
    }
  }
});
window.addEventListener('keyup', (event: KeyboardEvent) => {
  if (event.code === 'Space') spacePressed = false;
});
window.addEventListener('pagehide', () => {
  loop.stop();
  input.dispose();
  chunks?.close();
  renderer.dispose();
});

async function initializeWorld(): Promise<void> {
  world = await createPhysicsWorld();
  const worldBaseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  const manifestUrl = new URL('world/cc-monumental/manifest.json', worldBaseUrl);
  chunks = new ChunkManager(scene, world, manifestUrl, worldBaseUrl);
  chunks.events.on('chunkLoaded', ({ id, lod }) => logger.debug('Terrain chunk loaded', { id, lod }));
  chunks.events.on('chunkUnloaded', ({ id }) => logger.debug('Terrain chunk unloaded', { id }));
  await chunks.initialize();
  const startHeight = chunks.groundHeightAt(0, 0);
  if (startHeight !== undefined) character.position.y = startHeight;
  if (world) {
    const spawnH = chunks.groundHeightAt(8, 8) ?? 0;
    const vehicle = new Vehicle(world, 8, spawnH, 8);
    vehicles.push(vehicle);
    scene.add(vehicle.group);
  }
  await chunks.prepareRenderer(renderer, camera);
  chunks.setDebugBorders(showDebug);
  statusLabel.textContent = 'Ciudad lista · WASD camina · clic captura el ratón';
  logger.info('World streaming initialized', { region: 'cc-monumental', stepHz: 60, lods: 3 });
}

void initializeWorld().catch((error: unknown) => {
  statusLabel.textContent = error instanceof Error ? `No se pudo iniciar el mundo: ${error.message}` : 'No se pudo iniciar el mundo.';
  logger.error('World initialization failed', { error: String(error) });
});
loop.start();
