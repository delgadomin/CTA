import { chromium } from '@playwright/test';

const durationMs = Number(process.argv[2] ?? 300_000);
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage();
const failures = [];
const downloadedChunks = new Set();

await page.addInitScript(() => {
  let previousTimestamp;
  let streamingActive = false;
  window.__ctaFrameMetrics = { maximumStreamingFrameMs: 0, slowFrames: [] };
  const updateStreamingState = () => {
    streamingActive = document.querySelector('#world-status')?.textContent?.includes('streaming') ?? false;
  };
  new MutationObserver(updateStreamingState).observe(document, { childList: true, characterData: true, subtree: true });
  const requestFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => requestFrame((timestamp) => {
    if (previousTimestamp !== undefined) {
      const milliseconds = timestamp - previousTimestamp;
      if (streamingActive) window.__ctaFrameMetrics.maximumStreamingFrameMs = Math.max(window.__ctaFrameMetrics.maximumStreamingFrameMs, milliseconds);
      if (milliseconds > 16) {
        window.__ctaFrameMetrics.slowFrames.push({
          milliseconds,
          timestamp,
          streaming: streamingActive,
          chunks: document.querySelector('#chunks')?.textContent,
          colliders: document.querySelector('#colliders')?.textContent,
          memory: document.querySelector('#memory')?.textContent,
          status: document.querySelector('#world-status')?.textContent,
        });
      }
    }
    previousTimestamp = timestamp;
    callback(timestamp);
  });
});

page.on('pageerror', (error) => failures.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('Failed to load resource')) failures.push(message.text());
});
page.on('response', (response) => {
  if (!response.ok() && !response.url().endsWith('/favicon.ico')) failures.push(`${response.status()} ${response.url()}`);
});
page.on('request', (request) => {
  const match = request.url().match(/\/cc-monumental\/([^/]+\.bin)$/);
  if (match?.[1]) downloadedChunks.add(match[1]);
});

try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#world-status')?.textContent?.includes('streaming'), null, { timeout: 30_000 });
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  const endTime = Date.now() + durationMs;
  let minimumLoaded = Infinity;
  let maximumLoaded = 0;
  let minimumMemory = Infinity;
  let maximumMemory = 0;
  let maximumDrawCalls = 0;
  let maximumTriangles = 0;
  let samples = 0;
  let nextProgress = Date.now();
  const route = [
    [['KeyD', 'KeyS'], 16000], [['KeyA', 'KeyS'], 16000], [['KeyA', 'KeyW'], 16000], [['KeyD', 'KeyW'], 16000],
    [['KeyA', 'KeyW'], 16000], [['KeyD', 'KeyW'], 16000], [['KeyD', 'KeyS'], 16000], [['KeyA', 'KeyS'], 16000],
  ];
  const sprinting = durationMs >= 300_000;

  const moveCamera = async () => {
    while (Date.now() < endTime) {
      for (const [keys, stepDuration] of route) {
        if (Date.now() >= endTime) break;
        if (sprinting) await page.keyboard.down('ShiftLeft');
        for (const key of keys) await page.keyboard.down(key);
        await page.waitForTimeout(Math.min(stepDuration, endTime - Date.now()));
        for (const key of keys) await page.keyboard.up(key);
        if (sprinting) await page.keyboard.up('ShiftLeft');
      }
    }
  };

  const movement = moveCamera();
  while (Date.now() < endTime) {
    const stats = await page.evaluate(() => ({
      loaded: Number((document.querySelector('#chunks')?.textContent ?? '').match(/^(\d+)/)?.[1] ?? 0),
      memoryMiB: Number((document.querySelector('#memory')?.textContent ?? '').match(/[\d.]+/)?.[0] ?? 0),
      fps: Number(document.querySelector('#fps')?.textContent ?? 0),
      drawCalls: Number(document.querySelector('#draw-calls')?.textContent ?? 0),
      triangles: Number((document.querySelector('#triangles')?.textContent ?? '0').replaceAll('.', '')),
    }));
    samples += 1;
    minimumLoaded = Math.min(minimumLoaded, stats.loaded);
    maximumLoaded = Math.max(maximumLoaded, stats.loaded);
    minimumMemory = Math.min(minimumMemory, stats.memoryMiB);
    maximumMemory = Math.max(maximumMemory, stats.memoryMiB);
    maximumDrawCalls = Math.max(maximumDrawCalls, stats.drawCalls);
    maximumTriangles = Math.max(maximumTriangles, stats.triangles);
    if (Date.now() >= nextProgress) {
      console.info('PROGRESS', `${Math.round((Date.now() - (endTime - durationMs)) / 1000)}s`, JSON.stringify(stats));
      nextProgress = Date.now() + 30_000;
    }
    await page.waitForTimeout(500);
  }
  await movement;

  const final = await page.evaluate(() => ({
    chunks: document.querySelector('#chunks')?.textContent,
    colliders: document.querySelector('#colliders')?.textContent,
    memory: document.querySelector('#memory')?.textContent,
    fps: document.querySelector('#fps')?.textContent,
    frame: document.querySelector('#frame-time')?.textContent,
    status: document.querySelector('#world-status')?.textContent,
    frameMetrics: window.__ctaFrameMetrics,
  }));
  const mapPage = await browser.newPage();
  mapPage.on('pageerror', (error) => failures.push(`Map inspector: ${error.message}`));
  await mapPage.goto('http://127.0.0.1:5173/debug/map.html', { waitUntil: 'networkidle' });
  await mapPage.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('recorrido peatonal'), null, { timeout: 15_000 });
  const mapStatus = await mapPage.locator('#status').textContent();
  if (process.argv[3]) await mapPage.screenshot({ path: process.argv[3].replace(/\.png$/i, '-map.png') });
  if (!mapStatus?.includes('403 m')) failures.push(`Map inspector did not show the reference route: ${mapStatus}`);
  const slowFrames = final.frameMetrics.slowFrames;
  const streamingSlowFrames = slowFrames.filter((interval) => interval.streaming);
  const startupSlowFrames = slowFrames.filter((interval) => !interval.streaming);
  const result = {
    durationMs,
    samples,
    maximumFrameMs: Math.max(final.frameMetrics.maximumStreamingFrameMs, ...startupSlowFrames.map((interval) => interval.milliseconds), 0),
    startupSlowFrameCount: startupSlowFrames.length,
    startupSlowFrames: startupSlowFrames.slice(0, 12),
    streamingMaximumFrameMs: final.frameMetrics.maximumStreamingFrameMs,
    streamingSlowFrameCount: streamingSlowFrames.length,
    streamingSlowFrames: streamingSlowFrames.slice(0, 12),
    minimumLoaded,
    maximumLoaded,
    minimumMemoryMiB: minimumMemory,
    maximumMemoryMiB: maximumMemory,
    memoryRangeMiB: maximumMemory - minimumMemory,
    maximumDrawCalls,
    maximumTriangles,
    downloadedChunks: [...downloadedChunks].sort(),
    failures,
    mapStatus,
    final: { chunks: final.chunks, colliders: final.colliders, memory: final.memory, fps: final.fps, frame: final.frame, status: final.status },
  };
  console.info('RESULT', JSON.stringify(result));
  const fullRegionUnvisited = durationMs >= 300_000 && downloadedChunks.size < 16;
  if (failures.length || streamingSlowFrames.length || fullRegionUnvisited || maximumDrawCalls > 300 || maximumTriangles > 600_000) process.exitCode = 1;
} finally {
  await browser.close();
}
