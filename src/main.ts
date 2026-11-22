import * as THREE from 'three';
import { CameraRig } from './engine/camera-rig';
import { FixedStepLoop } from './engine/game-loop';
import { InputManager } from './engine/input-manager';
import { Logger } from './engine/logger';
import { QUALITY_PRESETS } from './engine/quality';
import { ChunkManager } from './world/chunk-manager';
import { createPhysicsWorld } from './world/terrain-physics';
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
const logger = new Logger('world', 'info');
scene.add(new THREE.HemisphereLight('#e7eff0', '#475447', 2.25));
const sun = new THREE.DirectionalLight('#fff0d2', 3.0);
sun.position.set(-320, 700, 250);
scene.add(sun);

let chunks: ChunkManager | undefined;
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
  cameraRig.update(frameSeconds);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -500, 500);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -500, 500);
  const groundHeight = chunks?.groundHeightAt(camera.position.x, camera.position.z);
  if (groundHeight !== undefined) camera.position.y = groundHeight + 1.7;
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
window.addEventListener('pagehide', () => {
  loop.stop();
  input.dispose();
  chunks?.close();
  renderer.dispose();
});

async function initializeWorld(): Promise<void> {
  const world = await createPhysicsWorld();
  const worldBaseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  const manifestUrl = new URL('world/cc-monumental/manifest.json', worldBaseUrl);
  chunks = new ChunkManager(scene, world, manifestUrl, worldBaseUrl);
  chunks.events.on('chunkLoaded', ({ id, lod }) => logger.debug('Terrain chunk loaded', { id, lod }));
  chunks.events.on('chunkUnloaded', ({ id }) => logger.debug('Terrain chunk unloaded', { id }));
  await chunks.initialize();
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
