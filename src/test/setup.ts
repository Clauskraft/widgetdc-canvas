import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock import.meta.env for API module
// @ts-expect-error -- vitest provides this
globalThis.import = globalThis.import ?? {};

// Fail fast on unstubbed network access in unit tests.
vi.stubGlobal('fetch', vi.fn(async () => {
  throw new Error('Unexpected fetch in unit test. Stub fetch explicitly in the test that needs it.');
}));
