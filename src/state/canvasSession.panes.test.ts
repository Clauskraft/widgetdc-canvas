import { describe, expect, it } from 'vitest';

import { PANE_IDS } from './canvasSession';

describe('canvas pane registry', () => {
  it('keeps WorkCore Phantom as its own scalable pane instead of overloading phantom_bom', () => {
    expect(PANE_IDS).toContain('workcore_phantom');
    expect(PANE_IDS).toContain('phantom_bom');
  });
});
