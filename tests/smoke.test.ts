import { describe, expect, it } from 'vitest';

describe('phase zero scaffold', () => {
  it('uses relative URLs for repository subpath hosting', async () => {
    const { default: config } = await import('../vite.config');
    expect(config.base).toBe('./');
  });
});
