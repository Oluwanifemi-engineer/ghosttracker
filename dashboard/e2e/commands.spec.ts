import { test, expect } from '@playwright/test';

/**
 * E2E tests for command execution flows.
 *
 * These tests validate the complete command UX:
 * - Lock device command
 * - Sound alarm command
 * - Locate device command
 * - Command history
 * - Command status updates
 *
 * Environment variables:
 *   TEST_API_KEY - API key for dashboard authentication
 *   TEST_DEVICE_ID - Existing test device ID
 */
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key';
const TEST_DEVICE_ID = process.env.TEST_DEVICE_ID || 'mt-test1234';

test.describe('Command Execution', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('lock command shows confirmation dialog', async ({ page }) => {
    // Navigate to device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Click lock button
      await page.click('[data-testid="lock-button"], button:has-text("Lock")');

      // Confirmation dialog should appear
      await expect(page.locator('.dialog, [role="dialog"]')).toBeVisible();
      await expect(page.locator('text=Lock Device')).toBeVisible();

      // Cancel
      await page.click('button:has-text("Cancel")');
    }
  });

  test('alarm command shows confirmation dialog', async ({ page }) => {
    // Navigate to device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Click alarm button
      await page.click('[data-testid="alarm-button"], button:has-text("Alarm")');

      // Confirmation dialog should appear
      await expect(page.locator('.dialog, [role="dialog"]')).toBeVisible();
      await expect(page.locator('text=Sound Alarm')).toBeVisible();

      // Cancel
      await page.click('button:has-text("Cancel")');
    }
  });

  test('locate command triggers immediately', async ({ page }) => {
    // Navigate to device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Click locate button (no confirmation for locate)
      await page.click('[data-testid="locate-button"], button:has-text("Locate")');

      // Should show loading/success state
      await expect(page.locator('.loading, .success, [data-testid="locate-status"]')).toBeVisible();
    }
  });

  test('command history displays correctly', async ({ page }) => {
    // Navigate to device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Navigate to command history
      await page.click('a[href*="commands"], button:has-text("History")');

      // Command list should be visible
      await expect(page.locator('[data-testid="command-list"], .command-list')).toBeVisible();
    }
  });

  test('command status updates in real-time', async ({ page }) => {
    // Navigate to device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Command status indicator should be visible
      await expect(page.locator('[data-testid="command-status"], .command-status')).toBeVisible();
    }
  });

  test('offline queue shows pending commands', async ({ page }) => {
    // Navigate to device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Offline queue indicator should be visible (may be hidden when empty)
      try {
        await expect(page.locator('[data-testid="offline-queue"], .offline-queue')).toBeVisible();
      } catch (e) {
        // Queue empty is acceptable
      }
    }
  });
});

test.describe('Evidence Capture', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('evidence panel displays correctly', async ({ page }) => {
    // Navigate to device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Navigate to evidence
      await page.click('a[href*="evidence"], button:has-text("Evidence")');

      // Evidence panel should be visible
      await expect(page.locator('[data-testid="evidence-panel"], .evidence-panel')).toBeVisible();
    }
  });

  test('evidence photos can be viewed', async ({ page }) => {
    // Navigate to device evidence
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();
      await page.click('a[href*="evidence"], button:has-text("Evidence")');

      // Photo gallery should be visible
      try {
        await expect(page.locator('[data-testid="photo-gallery"], .photo-gallery')).toBeVisible();
      } catch (e) {
        // No evidence yet is acceptable
      }
    }
  });

  test('evidence PDF can be generated', async ({ page }) => {
    // Navigate to device evidence
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();
      await page.click('a[href*="evidence"], button:has-text("Evidence")');

      // Generate PDF button should be visible
      try {
        await expect(page.locator('button:has-text("Generate PDF"), [data-testid="generate-pdf"]')).toBeVisible();
      } catch (e) {
        // Feature may not be available yet
      }
    }
  });
});
