import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const MAX_MODEL_BYTES = 50 * 1024 * 1024;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_VERTICES = 2_000_000;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const MAX_TEXTURE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_REQUIRED_EXTENSIONS = new Set([
  'EXT_meshopt_compression',
  'KHR_texture_basisu',
  'KHR_materials_unlit',
  'KHR_materials_emissive_strength',
  'KHR_texture_transform',
]);

function dimensions(bytes, mimeType, fileName) {
  if (
    mimeType === 'image/png' &&
    bytes.toString('hex', 0, 8) === '89504e470d0a1a0a' &&
    bytes.length >= 24
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mimeType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (!length || offset + 2 + length > bytes.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  throw new Error(`Unsupported or malformed image in landmark GLB: ${fileName}.`);
}

function validateStructure(gltf, binary, fileName) {
  if (gltf.asset?.version !== '2.0' || !Array.isArray(gltf.scenes) || gltf.scenes.length > 128)
    throw new Error(`Unsupported glTF 2.0 scene data: ${fileName}.`);
  const buffers = gltf.buffers ?? [];
  const views = gltf.bufferViews ?? [];
  const accessors = gltf.accessors ?? [];
  const images = gltf.images ?? [];
  const nodes = gltf.nodes ?? [];
  const meshes = gltf.meshes ?? [];
  if (
    buffers.length > 4 ||
    views.length > 8192 ||
    accessors.length > 8192 ||
    images.length > 32 ||
    nodes.length > 4096 ||
    meshes.length > 2048
  ) {
    throw new Error(`Landmark GLB exceeds structural limits: ${fileName}.`);
  }
  for (const buffer of buffers) {
    if (
      !Number.isInteger(buffer.byteLength) ||
      buffer.byteLength < 0 ||
      buffer.byteLength > MAX_MODEL_BYTES
    )
      throw new Error(`Invalid buffer length in ${fileName}.`);
  }
  if ((buffers[0]?.byteLength ?? 0) > binary.length)
    throw new Error(`Landmark GLB binary buffer is truncated: ${fileName}.`);
  for (const view of views) {
    const source = buffers[view.buffer ?? 0];
    const end = (view.byteOffset ?? 0) + view.byteLength;
    if (
      !source ||
      !Number.isInteger(view.byteLength) ||
      view.byteLength < 0 ||
      end > source.byteLength ||
      end > binary.length
    )
      throw new Error(`Invalid buffer view in ${fileName}.`);
  }
  let vertexCount = 0;
  for (const accessor of accessors) {
    if (!Number.isInteger(accessor.count) || accessor.count < 0 || accessor.count > MAX_VERTICES)
      throw new Error(`Invalid accessor count in ${fileName}.`);
    if (accessor.type === 'VEC3' && accessor.componentType === 5126) vertexCount += accessor.count;
    if (vertexCount > MAX_VERTICES)
      throw new Error(`Landmark GLB exceeds the vertex budget: ${fileName}.`);
  }
  const primitiveCount = meshes.reduce(
    (sum, mesh) => sum + (Array.isArray(mesh.primitives) ? mesh.primitives.length : MAX_VERTICES),
    0,
  );
  if (primitiveCount > 2048)
    throw new Error(`Landmark GLB exceeds the primitive budget: ${fileName}.`);
  const external = [...buffers, ...images].some(
    (asset) => typeof asset.uri === 'string' && !asset.uri.startsWith('data:'),
  );
  if (external) throw new Error(`External URIs are forbidden in landmark GLBs: ${fileName}.`);
  let totalPixels = 0;
  for (const image of images) {
    let imageBytes;
    let mimeType = image.mimeType;
    if (image.uri) {
      if (!/^data:image\/(png|jpeg);base64,/i.test(image.uri))
        throw new Error(`Only embedded PNG/JPEG textures are allowed in ${fileName}.`);
      mimeType = image.uri.toLowerCase().startsWith('data:image/png;') ? 'image/png' : 'image/jpeg';
      imageBytes = Buffer.from(image.uri.slice(image.uri.indexOf(',') + 1), 'base64');
    } else {
      const view = views[image.bufferView];
      const start = view?.byteOffset ?? 0;
      const end = start + (view?.byteLength ?? 0);
      if (!view || !['image/png', 'image/jpeg'].includes(mimeType) || end > binary.length)
        throw new Error(`Invalid embedded image reference in ${fileName}.`);
      imageBytes = binary.subarray(start, end);
    }
    if (imageBytes.byteLength === 0 || imageBytes.byteLength > MAX_TEXTURE_BYTES)
      throw new Error(`Landmark texture byte size is outside the safe limit: ${fileName}.`);
    const { width, height } = dimensions(imageBytes, mimeType, fileName);
    if (!width || !height || width > 4096 || height > 4096 || width * height > 16_777_216)
      throw new Error(`Landmark texture dimensions exceed the 4096px safety limit: ${fileName}.`);
    totalPixels += width * height;
    if (totalPixels > 33_554_432)
      throw new Error(`Landmark GLB texture pixel budget exceeded: ${fileName}.`);
  }
  if (
    (gltf.extensionsRequired ?? []).some(
      (extension) => !SUPPORTED_REQUIRED_EXTENSIONS.has(extension),
    )
  )
    throw new Error(`Unsupported required glTF extension in ${fileName}.`);
}

export async function discoverLandmarkModels(publicDirectory) {
  const directory = path.join(publicDirectory, 'landmarks');
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
  const ids = new Set();
  for (const entry of entries) {
    const match = entry.isFile() ? /^(w\d+)\.glb$/i.exec(entry.name) : undefined;
    if (!match?.[1]) continue;
    const bytes = await readFile(path.join(directory, entry.name));
    if (bytes.byteLength < 20 || bytes.byteLength > MAX_MODEL_BYTES)
      throw new Error(`Unsafe landmark GLB size: ${entry.name}.`);
    if (
      bytes.toString('ascii', 0, 4) !== 'glTF' ||
      bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(8) !== bytes.byteLength
    ) {
      throw new Error(`Invalid GLB header or declared length: ${entry.name}.`);
    }
    const jsonLength = bytes.readUInt32LE(12);
    if (
      bytes.readUInt32LE(16) !== JSON_CHUNK ||
      jsonLength < 2 ||
      jsonLength > MAX_JSON_BYTES ||
      jsonLength > bytes.byteLength - 20
    ) {
      throw new Error(`Invalid GLB JSON chunk: ${entry.name}.`);
    }
    let gltf;
    try {
      gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
    } catch {
      throw new Error(`Malformed GLB JSON chunk: ${entry.name}.`);
    }
    const binaryOffset = 20 + jsonLength;
    let binary = Buffer.alloc(0);
    if (binaryOffset + 8 <= bytes.byteLength) {
      const binaryLength = bytes.readUInt32LE(binaryOffset);
      if (
        bytes.readUInt32LE(binaryOffset + 4) !== BIN_CHUNK ||
        binaryLength > bytes.byteLength - binaryOffset - 8
      )
        throw new Error(`Invalid GLB binary chunk: ${entry.name}.`);
      binary = bytes.subarray(binaryOffset + 8, binaryOffset + 8 + binaryLength);
    }
    validateStructure(gltf, binary, entry.name);
    ids.add(match[1]);
  }
  return ids;
}
