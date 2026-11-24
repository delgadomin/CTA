const RETRYABLE_STATUSES = new Set([406, 408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRY_DELAY_MS = 30_000;

function retryAfterMs(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.min(MAX_RETRY_DELAY_MS, Math.max(0, delay)) : undefined;
}

function backoffMs(attempt) {
  return Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** attempt);
}

const waitDefault = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestWithRetry(request, { attempts = 4, wait = waitDefault } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1)
    throw new RangeError('Retry attempts must be positive.');
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await request();
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts - 1) return response;
      const delay = retryAfterMs(response.headers.get('retry-after')) ?? backoffMs(attempt);
      await response.body?.cancel();
      await wait(delay);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      await wait(backoffMs(attempt));
    }
  }
  throw lastError;
}
