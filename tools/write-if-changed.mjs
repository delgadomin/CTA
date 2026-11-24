import { readFile, rename, unlink, writeFile } from 'node:fs/promises';

export async function writeIfChanged(filePath, contents) {
  const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  try {
    const current = await readFile(filePath);
    if (current.equals(bytes)) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  return true;
}
