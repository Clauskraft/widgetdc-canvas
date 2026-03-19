import { test, expect } from '@playwright/test';

/**
 * CANVAS STABILITY AUDIT (DAY 5)
 * Step 3: State Transition Latency
 * Step 4: Virtualization Boundary Check
 */
test.describe('Canvas Stability Audit - Steps 3 & 4', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Ensure the store is ready and has the required methods
    await page.waitForFunction(() => {
      const store = (window as any).useCanvasStore?.getState();
      return store && typeof store.alignLayout === 'function';
    }, { timeout: 10000 });
  });

  test('Step 3: State Transition Latency (H10 Alignment)', async ({ page }) => {
    // 1. Create a messy canvas with 100 nodes
    await page.evaluate(() => {
      const store = (window as any).useCanvasStore;
      const nodes = [];
      for (let i = 0; i < 100; i++) {
        nodes.push({
          id: `align-node-${i}`,
          type: 'insight',
          position: { x: Math.random() * 5000, y: Math.random() * 5000 },
          data: { label: `Node ${i}`, nodeType: 'insight' }
        });
      }
      store.setState({ nodes });
    });

    // 2. Measure time to execute alignLayout
    const startTime = await page.evaluate(() => {
      const store = (window as any).useCanvasStore.getState();
      const start = performance.now();
      store.alignLayout();
      return { start, end: performance.now() };
    });

    const latency = startTime.end - startTime.start;
    console.log(`[AUDIT] Step 3 Latency: alignLayout took ${latency.toFixed(2)}ms for 100 nodes.`);
    
    // Threshold: alignLayout logic should be sub-100ms for 100 nodes
    expect(latency).toBeLessThan(100);
  });

  test('Step 4: Virtualization Boundary Check', async ({ page }) => {
    // 1. Create a massive horizontal canvas
    await page.evaluate(() => {
      const store = (window as any).useCanvasStore;
      const nodes = [];
      for (let i = 0; i < 200; i++) {
        nodes.push({
          id: `virt-node-${i}`,
          type: 'Entity',
          position: { x: i * 500, y: 500 },
          data: { label: `Far Node ${i}`, nodeType: 'Entity' }
        });
      }
      store.setState({ nodes });
    });

    // 2. Fast pan
    const pane = page.locator('.react-flow__pane');
    await page.mouse.move(500, 500);
    await page.mouse.down();
    await page.mouse.move(0, 500, { steps: 20 });
    await page.mouse.up();

    // 3. Verify virtualization
    const renderedCount = await page.locator('.react-flow__node').count();
    console.log(`[AUDIT] Step 4 Virtualization: ${renderedCount} nodes rendered out of 200.`);
    
    expect(renderedCount).toBeLessThan(100); 
  });
});
