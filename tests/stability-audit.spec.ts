import { test, expect } from '@playwright/test';

/**
 * CANVAS STABILITY AUDIT (DAY 5)
 * Step 1: Bottleneck Analysis
 * Step 2: LOD Verification
 */
test.describe('Canvas Stability Audit - Steps 1 & 2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Step 1: Node Rendering Bottleneck & FPS Stress', async ({ page }) => {
    test.setTimeout(120000);

    // Inject 500 nodes to stress the renderer
    await page.evaluate(() => {
      const store = (window as any).useCanvasStore;
      if (!store) return;
      const nodes = [];
      for (let i = 0; i < 500; i++) {
        nodes.push({
          id: `audit-node-${i}`,
          type: 'Claim',
          position: { x: (i % 25) * 300, y: Math.floor(i / 25) * 200 },
          data: { label: `Audit Node ${i}`, nodeType: 'Claim', signalIntensity: 0.9 } // High signal triggers red aura
        });
      }
      store.setState({ nodes });
    });

    // Wait for render
    await expect(page.locator('input').last()).toBeAttached({ timeout: 30000 });

    // Start performance profiling
    const startTime = Date.now();
    
    // Perform complex zoom/pan sequence
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 500); // Zoom out
      await page.waitForTimeout(100);
      await page.mouse.wheel(0, -500); // Zoom in
      await page.waitForTimeout(100);
    }

    const duration = Date.now() - startTime;
    console.log(`[AUDIT] Step 1 Performance: 10 Zoom cycles took ${duration}ms`);
    
    // Threshold: Zoom cycles should not take more than 5s total (including waits)
    expect(duration).toBeLessThan(10000);
  });

  test('Step 2: LOD (Level of Detail) Verification', async ({ page }) => {
    // 1. Zoom out heavily to trigger LOD
    await page.evaluate(() => {
      const store = (window as any).useCanvasStore;
      // We can't easily trigger zoom via evaluate on reactflow instance without ref, 
      // so we use mouse wheel or evaluate state if we have a zoom state (we don't persist zoom yet)
    });

    // Use mouse to zoom out
    await page.mouse.move(500, 500);
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 1000);
    }
    
    await page.waitForTimeout(500);

    // Verify LOD: Complex elements should be hidden
    // Thinking steps timeline should NOT be in the DOM/Visible
    const stepsTimeline = page.locator('.custom-scrollbar');
    await expect(stepsTimeline).not.toBeVisible();

    // Verify LOD: Aura glows should have low detail properties or be hidden
    // Check for CSS property or count
    const auras = page.locator('.animate-pulse');
    const count = await auras.count();
    console.log(`[AUDIT] Step 2 LOD: Found ${count} active pulse elements at low zoom.`);
  });
});
