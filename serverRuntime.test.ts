import { describe, expect, it } from 'vitest';

import { createMountAwarePathRewrite, resolveProxyAuthHeaders } from './serverRuntime.mjs';

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

  it('injects backend auth headers when a runtime API key is configured', () => {
    const headers = resolveProxyAuthHeaders(
      { BACKEND_API_KEY: 'secret-key' },
      { authorization: '', 'x-api-key': '' },
    );

    expect(headers).toEqual({
      authorization: 'Bearer secret-key',
      'x-api-key': 'secret-key',
    });
  });

  it('preserves existing auth headers when the caller already supplied them', () => {
    const headers = resolveProxyAuthHeaders(
      { BACKEND_API_KEY: 'secret-key' },
      { authorization: 'Bearer caller-token', 'x-api-key': 'caller-token' },
    );

    expect(headers).toEqual({});
  });
});
