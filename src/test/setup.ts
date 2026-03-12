import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock import.meta.env for API module
// @ts-expect-error -- vitest provides this
globalThis.import = globalThis.import ?? {};

// Mock fetch globally
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true, result: { results: [] } }),
});
