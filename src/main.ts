import * as THREE from 'three';
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

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9c2c4');
scene.fog = new THREE.Fog('#a9c2c4', 9, 24);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4.2, 3.1, 6.5);
camera.lookAt(0, 0.4, 0);

const cubeGeometry = new THREE.BoxGeometry(1.35, 1.35, 1.35);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: '#c88655', roughness: 0.62, flatShading: true });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.y = 0.95;
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
let previousTime = performance.now();

function animate(now: number): void {
  requestAnimationFrame(animate);
  const deltaSeconds = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  cube.rotation.y += deltaSeconds * 0.58;
  cube.rotation.x = Math.sin(now * 0.00035) * 0.08;
  renderer.render(scene, camera);
  frameCount += 1;
  if (now - fpsWindowStart >= 500) {
    fpsLabel.textContent = String(Math.round((frameCount * 1000) / (now - fpsWindowStart)));
    callsLabel.textContent = String(renderer.info.render.calls);
    trianglesLabel.textContent = renderer.info.render.triangles.toLocaleString('es-ES');
    frameCount = 0;
    fpsWindowStart = now;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'F3') {
    event.preventDefault();
    showDebug = !showDebug;
    document.querySelector<HTMLElement>('.debug-panel')?.classList.toggle('is-hidden', !showDebug);
  }
});

requestAnimationFrame(animate);
