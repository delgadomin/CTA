import * as THREE from 'three';

const SKY_COLORS = {
  zenith: '#557990',
  upper: '#7da6bb',
  haze: '#c8c8bd',
  horizon: '#f0c79a',
  undersky: '#d7b9a0',
} as const;

function random(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function paintCloudBand(context: CanvasRenderingContext2D, seed: number, count: number, lowY: number, highY: number, opacity: number): void {
  const next = random(seed);
  for (let cloud = 0; cloud < count; cloud += 1) {
    const x = next() * 1024;
    const y = lowY + next() * (highY - lowY);
    const width = 42 + next() * 140;
    const height = 5 + next() * 17;
    const puffs = 3 + Math.floor(next() * 5);
    context.save();
    context.globalAlpha = opacity * (0.55 + next() * 0.45);
    for (let puff = 0; puff < puffs; puff += 1) {
      const puffX = x + (puff / Math.max(1, puffs - 1) - 0.5) * width;
      const puffY = y + (next() - 0.5) * height * 0.45;
      const radiusX = width * (0.18 + next() * 0.16);
      const radiusY = height * (0.45 + next() * 0.65);
      const glow = context.createRadialGradient(puffX, puffY, 0, puffX, puffY, radiusX);
      glow.addColorStop(0, 'rgba(255, 239, 216, 0.84)');
      glow.addColorStop(0.55, 'rgba(245, 221, 196, 0.36)');
      glow.addColorStop(1, 'rgba(232, 209, 190, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.ellipse(puffX, puffY, radiusX, radiusY, -0.06, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the sky texture.');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, SKY_COLORS.zenith);
  gradient.addColorStop(0.28, SKY_COLORS.upper);
  gradient.addColorStop(0.46, SKY_COLORS.haze);
  gradient.addColorStop(0.52, SKY_COLORS.horizon);
  gradient.addColorStop(0.61, SKY_COLORS.undersky);
  gradient.addColorStop(1, '#7d8989');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  paintCloudBand(context, 0x4c4143, 34, 170, 274, 0.42);
  paintCloudBand(context, 0x8e7712, 18, 125, 188, 0.2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createSunTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the sun glow.');
  const glow = context.createRadialGradient(64, 64, 2, 64, 64, 62);
  glow.addColorStop(0, 'rgba(255, 239, 193, 1)');
  glow.addColorStop(0.16, 'rgba(255, 223, 166, 0.98)');
  glow.addColorStop(0.34, 'rgba(255, 196, 137, 0.45)');
  glow.addColorStop(1, 'rgba(255, 186, 132, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A static late-afternoon sky: cheap to render and free of external art assets. */
export function createSkyDome(radius: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'late-afternoon-atmosphere';
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 24),
    new THREE.MeshBasicMaterial({
      map: createSkyTexture(),
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  group.add(dome);

  const sunDirection = new THREE.Vector3(-0.48, 0.43, 0.77).normalize();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createSunTexture(),
    color: '#ffe5b3',
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  }));
  sun.position.copy(sunDirection).multiplyScalar(radius * 0.94);
  sun.scale.set(46, 46, 1);
  sun.renderOrder = -999;
  group.add(sun);
  return group;
}
