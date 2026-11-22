import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regionName = process.argv.find((argument) => argument.startsWith('--region='))?.split('=')[1] ?? 'cc-monumental';
const directory = path.join(ROOT, 'public/world', regionName);
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
const blocklist = JSON.parse(await readFile(path.join(ROOT, 'tools/brand-blocklist.json'), 'utf8'));
const forbidden = blocklist.brands.flatMap((brand) => brand.aliases).map((value) => value.toLocaleLowerCase('es'));
let totalFeatures = 0;
let totalMissingHeights = 0;

for (const chunk of manifest.chunks) {
  const binary = await readFile(path.join(directory, chunk.path));
  if (binary.toString('ascii', 0, 4) !== 'CTA2' || binary.readUInt16LE(4) !== 1) throw new Error(`Invalid CTA2 header: ${chunk.path}`);
  if (createHash('sha256').update(binary).digest('hex') !== chunk.sha256) throw new Error(`SHA-256 mismatch: ${chunk.path}`);
  if (binary.readUInt32LE(8) > 16 * 1024 * 1024) throw new Error(`Uncompressed chunk exceeds safety limit: ${chunk.path}`);
  const payloadBytes = inflateSync(binary.subarray(12), { maxOutputLength: 16 * 1024 * 1024 });
  if (payloadBytes.length !== binary.readUInt32LE(8)) throw new Error(`Uncompressed size mismatch: ${chunk.path}`);
  const payload = JSON.parse(payloadBytes.toString('utf8'));
  if (payload.id !== chunk.id || payload.features.length !== chunk.featureCount) throw new Error(`Chunk metadata mismatch: ${chunk.path}`);
  if (payload.terrain.heights.includes(-32768)) throw new Error(`No-data terrain sample found: ${chunk.path}`);
  const data = JSON.stringify(payload).toLocaleLowerCase('es');
  const leakedAlias = forbidden.find((alias) => data.includes(alias));
  if (leakedAlias) throw new Error(`Blocklisted real business name leaked into ${chunk.path}.`);
  totalFeatures += payload.features.length;
  totalMissingHeights += chunk.missingTerrainSamples;
}

if (totalMissingHeights > 0) throw new Error(`World has ${totalMissingHeights} missing terrain samples.`);
console.info(`Verified ${manifest.chunks.length} chunks, ${totalFeatures} feature records, all hashes and terrain samples; no blocklisted names.`);
