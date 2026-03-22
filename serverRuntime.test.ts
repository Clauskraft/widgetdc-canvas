import { describe, expect, it } from 'vitest';

import { createMountAwarePathRewrite } from './serverRuntime.mjs';

describe('canvas runtime proxy path preservation', () => {
  it('restores the /api prefix stripped by Express mount paths', () => {
    const rewrite = createMountAwarePathRewrite('/api');

    expect(rewrite('/mcp/route')).toBe('/api/mcp/route');
    expect(rewrite('/health')).toBe('/api/health');
  });

  it('restores singleton runtime prefixes such as /reason', () => {
    const rewrite = createMountAwarePathRewrite('/reason');

    expect(rewrite('/')).toBe('/reason');
    expect(rewrite('/intelligence/compliance-gaps')).toBe('/reason/intelligence/compliance-gaps');
  });

  it('does not double-prefix paths that already include the mount path', () => {
    const rewrite = createMountAwarePathRewrite('/intelligence');

    expect(rewrite('/intelligence/runtime')).toBe('/intelligence/runtime');
  });
});
