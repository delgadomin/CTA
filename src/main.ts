import * as THREE from 'three';
import { CameraRig } from './engine/camera-rig';
import { FixedStepLoop } from './engine/game-loop';
import { InputManager } from './engine/input-manager';
import { DebugConsole } from './engine/debug-console';
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
const heapMemoryLabel = requiredElement<HTMLElement>('#heap-memory');
const agentsLodLabel = requiredElement<HTMLElement>('#agents-lod');
const systemTimesLabel = requiredElement<HTMLElement>('#system-times');
const debugModesLabel = requiredElement<HTMLElement>('#debug-modes');
const debugPanel = requiredElement<HTMLElement>('.debug-panel');
const statusLabel = requiredElement<HTMLElement>('#world-status');
const debugMode = new URLSearchParams(window.location.search).get('debug') === '1';
const quality = QUALITY_PRESETS.high;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor('#a9c2c4');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b7d0d8');
scene.fog = new THREE.Fog('#b7d0d8', quality.viewDistance * 0.4, quality.viewDistance);
// Gradient sky sphere.
const skyGeometry = new THREE.SphereGeometry(quality.viewDistance * 1.2, 32, 16);
const skyPositions = skyGeometry.attributes.position as THREE.BufferAttribute;
const skyColors = new Float32Array(skyPositions.count * 3);
for (let i = 0; i < skyPositions.count; i += 1) {
  const y = skyPositions.getY(i);
  const t = Math.max(0, Math.min(1, (y + quality.viewDistance * 0.5) / (quality.viewDistance * 1.2)));
  skyColors[i * 3] = 0.72 + t * 0.12;
  skyColors[i * 3 + 1] = 0.82 + t * 0.1;
  skyColors[i * 3 + 2] = 0.88 + t * 0.08;
}
skyGeometry.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
const skyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false });
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);
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
let showDebug = debugMode;
let showChunkBorders = false;
let showColliderWireframes = false;
let showRoadWireframes = false;
let showLodBounds = false;
let showShadows = true;
let noclipEnabled = false;
let frameCount = 0;
let frameWindowStart = performance.now();
let previousFrameTimestamp = frameWindowStart;
let maximumFrameMs = 0;
let lastStatsUpdate = frameWindowStart;
let physicsQueryMs = 0;
let actorUpdateMs = 0;
let streamingUpdateMs = 0;
let renderUpdateMs = 0;

const debugConsole = new DebugConsole(
  requiredElement<HTMLElement>('#debug-console'),
  requiredElement<HTMLElement>('#debug-console-output'),
  requiredElement<HTMLFormElement>('#debug-console-form'),
  requiredElement<HTMLInputElement>('#debug-console-input'),
  {
    teleport: teleportToLandmark,
    spawnVehicle: spawnDebugVehicle,
    toggleNoclip: () => {
      noclipEnabled = !noclipEnabled;
      cameraRig.mode = noclipEnabled ? 'free' : 'thirdPerson';
      return `Cámara noclip ${noclipEnabled ? 'activada' : 'desactivada'}.`;
    },
  },
);

debugPanel.classList.toggle('is-hidden', !showDebug);

interface DebugSnapshot {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly groundHeight: number | null;
  readonly loadedChunks: number;
  readonly pendingChunks: number;
  readonly colliderCount: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly worldMemoryMiB: number;
  readonly heapMemoryMiB: number | null;
  readonly agentsByLod: readonly [number, number, number];
  readonly fps: number;
  readonly peakFrameMs: number;
  readonly systemTimesMs: {
    readonly physicsQuery: number;
    readonly actorUpdate: number;
    readonly streamingUpdate: number;
    readonly render: number;
  };
}

declare global {
  interface Window {
    __CTA_DEBUG__?: {
      teleport(x: number, z: number): void;
      metrics(): DebugSnapshot;
    };
  }
}

function debugSnapshot(): DebugSnapshot {
  const position = character.position;
  const browserMemory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return {
    position: { x: position.x, y: position.y, z: position.z },
    groundHeight: chunks?.groundHeightAt(position.x, position.z) ?? null,
    loadedChunks: chunks?.loadedCount ?? 0,
    pendingChunks: chunks?.pendingCount ?? 0,
    colliderCount: chunks?.colliderCount ?? 0,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    worldMemoryMiB: chunks?.memoryMiB ?? 0,
    heapMemoryMiB: browserMemory ? browserMemory.usedJSHeapSize / (1024 * 1024) : null,
    // The current build has no pedestrian simulation or agent LOD scheduler.
    agentsByLod: [0, 0, 0],
    fps: Number(fpsLabel.textContent ?? 0),
    peakFrameMs: maximumFrameMs,
    systemTimesMs: {
      physicsQuery: physicsQueryMs,
      actorUpdate: actorUpdateMs,
      streamingUpdate: streamingUpdateMs,
      render: renderUpdateMs,
    },
  };
}

function teleportForAudit(x: number, z: number): void {
  noclipEnabled = false;
  cameraRig.mode = 'thirdPerson';
  const ground = chunks?.groundHeightAt(x, z);
  character.position.set(x, ground ?? character.position.y, z);
  camera.position.set(x, character.position.y + 8, z + 9);
}

if (debugMode) window.__CTA_DEBUG__ = { teleport: teleportForAudit, metrics: debugSnapshot };

function updateDebug(timestamp: number): void {
  if (!debugMode || !chunks || timestamp - lastStatsUpdate < 250) return;
  chunksLabel.textContent = `${chunks.loadedCount} cargados · ${chunks.pendingCount} en cola · ${chunks.failures} errores`;
  collidersLabel.textContent = String(chunks.colliderCount);
  drawCallsLabel.textContent = String(renderer.info.render.calls);
  trianglesLabel.textContent = renderer.info.render.triangles.toLocaleString('es-ES');
  memoryLabel.textContent = `≈ ${chunks.memoryMiB.toFixed(1)} MiB`;
  const browserMemory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  heapMemoryLabel.textContent = browserMemory ? `≈ ${(browserMemory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MiB` : 'n/d';
  agentsLodLabel.textContent = '0 / 0 / 0';
  systemTimesLabel.textContent = `física ${physicsQueryMs.toFixed(2)} · jugador ${actorUpdateMs.toFixed(2)} · streaming ${streamingUpdateMs.toFixed(2)} · render ${renderUpdateMs.toFixed(2)} ms`;
  statusLabel.textContent = chunks.loadedCount > 0 ? 'Edificios, calles y terreno MDT05 en streaming' : 'Preparando la ciudad desde datos oficiales…';
  lastStatsUpdate = timestamp;
}

const loop = new FixedStepLoop([], (interpolation, frameSeconds, timestamp) => {
  void interpolation;
  // Rapier raycasts (vehicle suspension, camera occlusion) need an up-to-date
  // query pipeline before any of this frame's collider consumers run.
  let systemStart = debugMode ? performance.now() : 0;
  chunks?.refreshPhysicsQueries();
  if (debugMode) physicsQueryMs = performance.now() - systemStart;
  systemStart = debugMode ? performance.now() : 0;
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
    const vh = chunks?.groundHeightAt(camera.position.x, camera.position.z);
    if (vh !== undefined && camera.position.y < vh + 0.5) camera.position.y = vh + 0.5;
    if (chunks?.collidesWithBuilding(camera.position.x, camera.position.z, 0)) {
      const dir = camera.position.clone().sub(activeVehicle.position);
      const dist = dir.length();
      if (dist > 0.1) {
        dir.normalize();
        for (let i = 0; i < 8; i += 1) {
          camera.position.copy(activeVehicle.position).addScaledVector(dir, dist * (1 - (i + 1) / 9));
          if (!chunks.collidesWithBuilding(camera.position.x, camera.position.z, 0)) break;
        }
      }
    }
  } else if (cameraRig.mode === 'thirdPerson') {
    character.update(frameSeconds, input, chunks, cameraRig.getYaw(), spacePressed);
    cameraRig.update(frameSeconds, character.position);
    const ch = chunks?.groundHeightAt(camera.position.x, camera.position.z);
    if (ch !== undefined && camera.position.y < ch + 0.5) camera.position.y = ch + 0.5;
    // Safety: if the camera ended up inside a building footprint, pull it toward the character.
    if (chunks?.collidesWithBuilding(camera.position.x, camera.position.z, 0)) {
      const dir = camera.position.clone().sub(character.position);
      const dist = dir.length();
      if (dist > 0.1) {
        dir.normalize();
        for (let i = 0; i < 8; i += 1) {
          camera.position.copy(character.position).addScaledVector(dir, dist * (1 - (i + 1) / 9));
          if (!chunks.collidesWithBuilding(camera.position.x, camera.position.z, 0)) break;
        }
      }
      const ch2 = chunks.groundHeightAt(camera.position.x, camera.position.z);
      if (ch2 !== undefined && camera.position.y < ch2 + 0.5) camera.position.y = ch2 + 0.5;
    }
  } else {
    cameraRig.update(frameSeconds);
    character.position.copy(camera.position);
    const characterGround = chunks?.groundHeightAt(character.position.x, character.position.z);
    if (characterGround !== undefined) character.position.y = characterGround;
  }
  if (debugMode) actorUpdateMs = performance.now() - systemStart;
  if (cameraRig.mode === 'free' && !noclipEnabled) {
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -500, 500);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -500, 500);
    const groundHeight = chunks?.groundHeightAt(camera.position.x, camera.position.z);
    if (groundHeight !== undefined) camera.position.y = groundHeight + 1.7;
  }
  systemStart = debugMode ? performance.now() : 0;
  chunks?.update(camera, timestamp);
  if (debugMode) streamingUpdateMs = performance.now() - systemStart;
  systemStart = debugMode ? performance.now() : 0;
  renderer.render(scene, camera);
  if (debugMode) renderUpdateMs = performance.now() - systemStart;
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

function updateDebugModeLabel(): void {
  debugModesLabel.textContent = `F5 colisiones ${showColliderWireframes ? 'ON' : 'OFF'} · F6 calzadas ${showRoadWireframes ? 'ON' : 'OFF'} · F7 LOD ${showLodBounds ? 'ON' : 'OFF'} · F8 sombras ${showShadows ? 'ON' : 'OFF'} · F9 postprocesado no configurado`;
}

function normalizeLandmarkQuery(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-ES').trim();
}

async function teleportToLandmark(query: string): Promise<string> {
  const response = await fetch(new URL('../data/landmarks/landmarks.json', import.meta.url));
  if (!response.ok) throw new Error(`no se pudo leer el catálogo de hitos (${response.status}).`);
  const catalog = await response.json() as { landmarks: { id: string; name: string; position?: { localMeters?: readonly [number, number] } }[] };
  const normalized = normalizeLandmarkQuery(query);
  const landmark = catalog.landmarks.find((item) => normalizeLandmarkQuery(item.id) === normalized || normalizeLandmarkQuery(item.name) === normalized);
  const point = landmark?.position?.localMeters;
  if (!landmark || !point) throw new Error(`no encuentro el hito «${query}» con coordenadas disponibles.`);
  teleportForAudit(point[0], point[1]);
  return `Teletransporte: ${landmark.name}.`;
}

function spawnDebugVehicle(): string {
  if (!world) throw new Error('el mundo físico todavía no está listo.');
  const position = character.position;
  const x = position.x + 4;
  const z = position.z;
  const height = chunks?.groundHeightAt(x, z) ?? position.y;
  const vehicle = new Vehicle(world, x, height, z);
  vehicles.push(vehicle);
  scene.add(vehicle.group);
  world.updateSceneQueries();
  return 'Vehículo de pruebas creado a 4 m del jugador.';
}

updateDebugModeLabel();
window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (!debugMode) return;
  if (event.code === 'Escape' && debugConsole.isOpen) {
    debugConsole.setOpen(false);
    return;
  }
  if (debugConsole.isInputFocused) return;
  switch (event.code) {
    case 'F3':
      event.preventDefault();
      showDebug = !showDebug;
      debugPanel.classList.toggle('is-hidden', !showDebug);
      break;
    case 'F4':
      event.preventDefault();
      showChunkBorders = !showChunkBorders;
      chunks?.setDebugBorders(showChunkBorders);
      break;
    case 'F5':
      event.preventDefault();
      showColliderWireframes = !showColliderWireframes;
      chunks?.setDebugColliders(showColliderWireframes);
      break;
    case 'F6':
      event.preventDefault();
      showRoadWireframes = !showRoadWireframes;
      chunks?.setDebugRoadSurfaces(showRoadWireframes);
      break;
    case 'F7':
      event.preventDefault();
      showLodBounds = !showLodBounds;
      chunks?.setDebugLodBounds(showLodBounds);
      break;
    case 'F8':
      event.preventDefault();
      showShadows = !showShadows;
      renderer.shadowMap.enabled = showShadows;
      updateDebugModeLabel();
      break;
    case 'F9':
      event.preventDefault();
      debugConsole.append('F9: no hay efectos de postprocesado configurados en esta build.');
      debugConsole.setOpen(true);
      break;
    case 'Backquote':
      event.preventDefault();
      debugConsole.toggle();
      break;
  }
  updateDebugModeLabel();
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
  cameraRig.occlusion = (origin, dir, maxDist) => chunks?.cameraOcclusion(origin, dir, maxDist) ?? maxDist;
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
    // The chassis collider was created outside TerrainColliders.
    world.updateSceneQueries();
  }
  await chunks.prepareRenderer(renderer, camera);
  chunks.setDebugBorders(showChunkBorders);
  statusLabel.textContent = 'Ciudad lista · WASD camina · clic captura el ratón';
  logger.info('World streaming initialized', { region: 'cc-monumental', stepHz: 60, lods: 3 });
}

void initializeWorld().catch((error: unknown) => {
  statusLabel.textContent = error instanceof Error ? `No se pudo iniciar el mundo: ${error.message}` : 'No se pudo iniciar el mundo.';
  logger.error('World initialization failed', { error: String(error) });
});
loop.start();
