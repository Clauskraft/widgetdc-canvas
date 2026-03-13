import { test, expect } from '@playwright/test';

test.describe('Steve Jobs Vision - 100,000 feet Cruising Altitude', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the AutoLoader showcase to finish loading
    await page.waitForLoadState('networkidle');
  });

  test('UI is clean and minimalist (Vision Edition)', async ({ page }) => {
    // Header should say Vision Edition
    await expect(page.locator('text=Vision Edition')).toBeVisible();

    // Check that we have nodes loaded from the showcase
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15000 });
    const nodesCount = await page.locator('.react-flow__node').count();
    expect(nodesCount).toBeGreaterThan(0);
  });

  test('Double click creates a new thought node', async ({ page }) => {
    const pane = page.locator('.react-flow__pane');
    
    // Double click an empty area. Need a known empty spot, or just far right
    await pane.dblclick({ position: { x: 800, y: 100 } });

    // The new thought node should have an input with placeholder
    const newNodeInput = page.getByPlaceholder('Hvad tænker du?');
    await expect(newNodeInput).toBeVisible({ timeout: 5000 });
  });

  test('Oracle simulation via drag and drop connection', async ({ page }) => {
    const pane = page.locator('.react-flow__pane');
    
    // 1. Double click to create a fresh node we can easily identify and drag from
    await pane.dblclick({ position: { x: 500, y: 500 } });
    
    const newNodeInput = page.getByPlaceholder('Hvad tænker du?');
    await expect(newNodeInput).toBeVisible();

    // Fill it
    await newNodeInput.fill('Test Oracle Drag');
    await newNodeInput.press('Enter');

    // Click it to select
    const theNewNode = page.locator('.react-flow__node').last();
    await theNewNode.click();

    // Find the right handle for the newly selected node
    const handle = theNewNode.locator('.react-flow__handle-right');
    await expect(handle).toBeVisible();

    // Wait for Framer Motion animation to complete
    await page.waitForTimeout(500);

    const startBox = await handle.boundingBox();
    if (startBox) {
      await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
      await page.mouse.down();
      // drag it away
      await page.mouse.move(startBox.x + 300, startBox.y + 100);
      await page.mouse.up();

      // See Oracle thinking overlay
      await expect(page.locator('text=Oraklet søger i grafen...')).toBeVisible();
    }
  });
});
