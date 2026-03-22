import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('canvas runtime packaging', () => {
  it('copies the server runtime helper into the runner image', () => {
    const dockerfile = readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');

    expect(dockerfile).toMatch(/COPY\s+server\.mjs\s+serverRuntime\.mjs\s+\.\/?/);
  });
});
