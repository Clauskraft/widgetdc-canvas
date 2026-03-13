import { test, expect } from '@playwright/test';

test.describe('Steve Jobs Vision - Den Ultimative Test', () => {
  test.beforeEach(async ({ page }) => {
    // Log alt hvad der sker i browseren
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    await page.goto('/');
  });

  test('skal render lærredet med den visionære start-node', async ({ page }) => {
    // Vent på at appen er loadet
    await page.waitForLoadState('networkidle');
    
    // Tjek om vi ser knappen til cockpit-versionen
    await expect(page.locator('button:has-text("Se Cockpit-version")')).toBeVisible({ timeout: 15000 });

    // Tjek om start-noden er der (første input i lærredet)
    const initialInput = page.locator('input').first();
    await expect(initialInput).toHaveValue('Markedsstrategi 2026');
  });

  test('skal skabe en ny tanke ved dobbeltklik', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const pane = page.locator('.react-flow__pane');
    await pane.dblclick({ position: { x: 600, y: 400 } });

    // Tjek om der er kommet et nyt tomt input felt
    const newNodeInput = page.locator('input').last();
    await expect(newNodeInput).toHaveAttribute('placeholder', 'Hvad tænker du?');
  });

  test('skal aktivere Oraklet ved træk-og-slip', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // 1. Klik på start-noden for at aktivere den blå prik
    const initialNode = page.locator('input').first();
    await initialNode.click();
    
    // 2. Find den blå prik (handle)
    const handle = page.locator('.react-flow__handle-right');
    await expect(handle).toBeVisible();

    // 3. Træk fra prikken ud på lærredet
    const startBox = await handle.boundingBox();
    if (startBox) {
      await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(startBox.x + 300, startBox.y + 100);
      await page.mouse.up();

      // 4. Se Oraklet tænke
      await expect(page.locator('text=Oraklet mærker energien...')).toBeVisible();
      
      // 5. Vent på at Oraklets svar manifesterer sig
      await expect(page.locator('text=Konkurrent A Pivot')).toBeVisible({ timeout: 10000 });
    }
  });
});
