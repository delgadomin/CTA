/**
 * Tactical open-world circular radar minimap HUD for Cáceres Criminal.
 * Follows gamedev-skills UI/UX feedback & design-system patterns:
 * - High-performance 2D canvas drawing (zero allocations in hot loop)
 * - Rotating radar oriented to player view with North compass indicator
 * - Dynamic blips for player, ambient traffic, and pulsating police units
 * - Pursuit status border indicator during active wanted levels
 */

export interface MinimapBlip {
  readonly x: number;
  readonly z: number;
}

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly container: HTMLElement | null;
  private pursuitFlash = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create minimap 2D context.');
    this.context = ctx;
    this.container = canvas.parentElement;
  }

  /**
   * Renders the circular radar minimap.
   * @param playerX Player world X coordinate
   * @param playerZ Player world Z coordinate
   * @param heading Player forward angle in radians (camera yaw)
   * @param inVehicle Whether player is currently in vehicle
   * @param wantedStars Current wanted level (0 to 5)
   * @param traffic Nearby ambient vehicle positions
   * @param police Nearby police vehicle positions
   */
  update(
    playerX: number,
    playerZ: number,
    heading: number,
    inVehicle: boolean,
    wantedStars: number,
    traffic: readonly MinimapBlip[],
    police: readonly MinimapBlip[],
    deltaSeconds = 0.016,
  ): void {
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const radius = centerX - 6;
    const radarRange = 100; // meters shown from center to edge

    ctx.clearRect(0, 0, width, height);

    // Save state for circular clipping
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // 1. Radar Background
    ctx.fillStyle = '#14181c';
    ctx.fillRect(0, 0, width, height);

    // Rotate world relative to player forward direction so top is always forward
    const rotation = -heading - Math.PI / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // 2. Subtle grid lines aligned to world axes
    ctx.strokeStyle = 'rgb(255 255 255 / 6%)';
    ctx.lineWidth = 1;
    const gridSize = 25; // 25m world grid
    const startX = -((playerX % gridSize) / radarRange) * radius;
    const startZ = -((playerZ % gridSize) / radarRange) * radius;

    for (let x = -radius * 1.4; x <= radius * 1.4; x += (gridSize / radarRange) * radius) {
      ctx.beginPath();
      ctx.moveTo(startX + x, -radius * 1.4);
      ctx.lineTo(startX + x, radius * 1.4);
      ctx.stroke();
    }
    for (let z = -radius * 1.4; z <= radius * 1.4; z += (gridSize / radarRange) * radius) {
      ctx.beginPath();
      ctx.moveTo(-radius * 1.4, startZ + z);
      ctx.lineTo(radius * 1.4, startZ + z);
      ctx.stroke();
    }

    // 3. Ambient traffic blips
    ctx.fillStyle = '#d4c898';
    for (let i = 0; i < traffic.length; i += 1) {
      const item = traffic[i];
      if (!item) continue;
      const dx = item.x - playerX;
      const dz = item.z - playerZ;
      if (dx * dx + dz * dz > radarRange * radarRange) continue;
      const blipX = (dx / radarRange) * radius;
      const blipZ = (dz / radarRange) * radius;
      ctx.beginPath();
      ctx.arc(blipX, blipZ, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Police vehicle blips (pulsing red/blue strobe)
    this.pursuitFlash += deltaSeconds * 6;
    const isRedFlash = Math.sin(this.pursuitFlash) > 0;
    ctx.fillStyle = isRedFlash ? '#ff3333' : '#3388ff';
    for (let i = 0; i < police.length; i += 1) {
      const item = police[i];
      if (!item) continue;
      const dx = item.x - playerX;
      const dz = item.z - playerZ;
      if (dx * dx + dz * dz > radarRange * radarRange) continue;
      const blipX = (dx / radarRange) * radius;
      const blipZ = (dz / radarRange) * radius;

      // Glow halo
      ctx.beginPath();
      ctx.fillStyle = isRedFlash ? 'rgb(255 50 50 / 35%)' : 'rgb(50 130 255 / 35%)';
      ctx.arc(blipX, blipZ, 6, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.fillStyle = isRedFlash ? '#ff2222' : '#2277ff';
      ctx.arc(blipX, blipZ, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // Restore world rotation

    // 5. Radar Concentric Distance Rings & Crosshair
    ctx.strokeStyle = 'rgb(210 185 140 / 18%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();

    // 6. Player Arrow in center
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.fillStyle = inVehicle ? '#38bdf8' : '#f8fafc';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // Restore circular clip

    // 7. North ("N") Indicator on perimeter
    const northAngle = rotation - Math.PI / 2;
    const northX = centerX + Math.cos(northAngle) * (radius - 8);
    const northY = centerY + Math.sin(northAngle) * (radius - 8);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', northX, northY);

    // 8. Outer metallic/pursuit bezel
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    if (wantedStars >= 1) {
      const pursuitColor = isRedFlash ? '#ef4444' : '#3b82f6';
      ctx.strokeStyle = pursuitColor;
      ctx.lineWidth = 3;
      if (this.container) this.container.classList.add('pursuit');
    } else {
      ctx.strokeStyle = 'rgb(210 180 130 / 60%)';
      ctx.lineWidth = 2.5;
      if (this.container) this.container.classList.remove('pursuit');
    }
    ctx.stroke();
  }
}
