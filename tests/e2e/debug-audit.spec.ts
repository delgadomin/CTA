import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

interface TourStop {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly source: string;
  readonly metrics?: DebugSnapshot;
  readonly screenshot?: string;
}

interface FrameAudit {
  slowRunMs: number;
  maximumSlowRunMs: number;
}

declare global {
  interface Window {
    __CTA_DEBUG__?: {
      teleport(x: number, z: number): void;
      metrics(): DebugSnapshot;
    };
    __CTA_FRAME_AUDIT__?: FrameAudit;
  }
}

const date = new Date().toISOString().slice(0, 10);
const outputDirectory = resolve('reports', 'screens', `audit-${date}`);
const summaryPath = resolve('reports', 'audit-summary.md');
const capturedErrors: string[] = [];
const completedStops: TourStop[] = [];

function markdownSummary(): string {
  const rows = completedStops.map((stop) => {
    const metrics = stop.metrics;
    if (!metrics) return `| ${stop.name} | fallo antes de medir | — | — | — | — | — | — | — |`;
    const heap = metrics.heapMemoryMiB === null ? 'n/d' : `${metrics.heapMemoryMiB.toFixed(1)} MiB`;
    const below = metrics.groundHeight === null ? 'sin dato' : `${(metrics.position.y - metrics.groundHeight).toFixed(2)} m`;
    const times = Object.values(metrics.systemTimesMs).map((value) => value.toFixed(2)).join(' / ');
    const population = metrics.agentsByLod.join(' / ');
    return `| ${stop.name} (${stop.source}) | ${metrics.fps} | ${metrics.peakFrameMs.toFixed(1)} ms | ${metrics.drawCalls} / ${metrics.triangles} | ${metrics.loadedChunks} / ${metrics.pendingChunks} / ${metrics.colliderCount} | ${metrics.worldMemoryMiB.toFixed(1)} / ${heap} MiB | ${times} ms | ${population} | ${below} |`;
  });
  const errors = capturedErrors.length ? capturedErrors.map((error) => `- ${error}`).join('\n') : '- Ningún error de consola o página.';
  const shots = completedStops.filter((stop) => stop.screenshot).map((stop) => `- ${stop.name} (${stop.source}): \`${stop.screenshot}\``).join('\n') || '- No se guardaron capturas.';
  return [
    '# Resumen de auditoría del mundo',
    '',
    `Fecha: ${date}`, '',
    '| Parada | FPS | Pico frame | Draw calls / triángulos | Chunks cargados / cola / colliders | Mundo / heap | Física / jugador / streaming / render | Agentes LOD | Altura sobre terreno |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows, '',
    '## Errores', '', errors, '',
    '## Capturas', '', shots, '',
    '## Criterios', '',
    '- Fallo si aparece un error de página/consola, el personaje queda más de 0,5 m por debajo del terreno o se superan frames de más de 50 ms durante 2 s seguidos.',
    '- El heap puede no estar disponible en todos los navegadores y se muestra como `n/d`; la población LOD cuenta agentes ambientales cercanos, medios y lejanos.', '',
  ].join('\n');
}

async function recordBrowserErrors(page: Page): Promise<void> {
  page.on('pageerror', (error) => capturedErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') capturedErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (!response.ok() && !response.url().endsWith('/favicon.ico')) capturedErrors.push(`${response.status()} ${response.url()}`);
  });
}

test('debug tour visits ten geographic stops and writes an audit report', async ({ page }) => {
  const destinations = JSON.parse(await readFile(resolve('tests/e2e/audit-destinations.json'), 'utf8')) as TourStop[];
  await mkdir(outputDirectory, { recursive: true });
  await recordBrowserErrors(page);
  await page.addInitScript(() => {
    let previousFrame: number | undefined;
    const state: FrameAudit = { slowRunMs: 0, maximumSlowRunMs: 0 };
    window.__CTA_FRAME_AUDIT__ = state;
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => requestFrame((timestamp) => {
      if (previousFrame !== undefined) {
        const interval = timestamp - previousFrame;
        state.slowRunMs = interval > 50 ? state.slowRunMs + interval : 0;
        state.maximumSlowRunMs = Math.max(state.maximumSlowRunMs, state.slowRunMs);
      }
      previousFrame = timestamp;
      callback(timestamp);
    });
  });

  try {
    await page.goto('/?debug=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.debug-panel')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__CTA_DEBUG__), null, { timeout: 30_000 });

    for (const [index, destination] of destinations.entries()) {
      const screenshot = `reports/screens/audit-${date}/${String(index + 1).padStart(2, '0')}-${destination.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      try {
        await page.evaluate(({ x, z }) => window.__CTA_DEBUG__?.teleport(x, z), destination);
        await page.waitForFunction(({ x, z }) => {
          const metrics = window.__CTA_DEBUG__?.metrics();
          return Boolean(metrics && metrics.groundHeight !== null
            && Math.abs(metrics.position.x - x) < 1
            && Math.abs(metrics.position.z - z) < 1
            && metrics.position.y >= metrics.groundHeight - 0.5);
        }, destination, { timeout: 45_000 });
        await page.waitForTimeout(750);
        const metrics = await page.evaluate(() => window.__CTA_DEBUG__?.metrics());
        await page.screenshot({ path: resolve(screenshot), animations: 'disabled' });
        completedStops.push({ ...destination, metrics, screenshot });
      } catch (error) {
        capturedErrors.push(`${destination.name}: ${error instanceof Error ? error.message : String(error)}`);
        completedStops.push(destination);
      }
      await writeFile(summaryPath, markdownSummary(), 'utf8');
    }

    const frameAudit = await page.evaluate(() => window.__CTA_FRAME_AUDIT__);
    if (frameAudit && frameAudit.maximumSlowRunMs >= 2_000) capturedErrors.push(`Frames >50 ms sostenidos: ${frameAudit.maximumSlowRunMs.toFixed(0)} ms.`);
    for (const stop of completedStops) {
      if (stop.metrics && stop.metrics.groundHeight !== null && stop.metrics.position.y < stop.metrics.groundHeight - 0.5) {
        capturedErrors.push(`${stop.name}: personaje bajo el terreno (${(stop.metrics.position.y - stop.metrics.groundHeight).toFixed(2)} m).`);
      }
    }
  } finally {
    await writeFile(summaryPath, markdownSummary(), 'utf8');
  }

  expect(completedStops, 'La ruta debe medir las diez paradas').toHaveLength(10);
  expect(capturedErrors, 'La auditoría detectó errores o criterios incumplidos').toEqual([]);
});
