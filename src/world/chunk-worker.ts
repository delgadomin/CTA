import { buildTerrainChunk } from './mesh-builder';
import type { BuiltTerrainChunk, RawTerrainChunk } from './types';

interface BuildRequest {
  readonly id: string;
  readonly buffer: ArrayBuffer;
}

interface BuildResponse {
  readonly id: string;
  readonly result?: BuiltTerrainChunk;
  readonly error?: string;
}

const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<BuildRequest>) => void) | null;
  postMessage(message: BuildResponse, transfer: Transferable[]): void;
};

async function decodeChunk(request: BuildRequest): Promise<BuiltTerrainChunk> {
  const bytes = new Uint8Array(request.buffer);
  if (bytes.byteLength < 12 || new TextDecoder().decode(bytes.subarray(0, 4)) !== 'CTA2') throw new Error(`Unknown chunk format: ${request.id}`);
  const view = new DataView(request.buffer);
  if (view.getUint16(4, true) !== 1) throw new Error(`Unsupported chunk version: ${request.id}`);
  const payloadLength = view.getUint32(8, true);
  if (payloadLength > MAX_PAYLOAD_BYTES) throw new Error(`Chunk ${request.id} exceeds the uncompressed size limit.`);
  const compressed = new Blob([bytes.subarray(12)]).stream().pipeThrough(new DecompressionStream('deflate'));
  const payload = await new Response(compressed).arrayBuffer();
  if (payload.byteLength !== payloadLength) throw new Error(`Chunk ${request.id} payload size does not match its header.`);
  const raw = JSON.parse(new TextDecoder().decode(payload)) as RawTerrainChunk;
  if (raw.id !== request.id) throw new Error(`Chunk identity mismatch: ${request.id}`);
  return buildTerrainChunk(raw);
}

function transferables(result: BuiltTerrainChunk): Transferable[] {
  return [
    result.heights.buffer,
    ...result.levels.flatMap((level) => [level.positions.buffer, level.normals.buffer, level.colors.buffer, level.indices.buffer]),
  ];
}

scope.onmessage = (event): void => {
  const request = event.data;
  void decodeChunk(request).then((result) => {
    scope.postMessage({ id: request.id, result }, transferables(result));
  }).catch((error: unknown) => {
    scope.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) }, []);
  });
};
