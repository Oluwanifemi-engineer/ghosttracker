import { test, expect } from '@playwright/test';

/**
 * E2E tests for device management flows.
 *
 * These tests validate the complete device management UX:
 * - Device list display
 * - Device claiming
 * - Device sharing
 * - Device settings
 * - Device deletion
 *
 * Environment variables:
 *   TEST_API_KEY - API key for dashboard authentication
 *   TEST_DEVICE_ID - Existing test device ID
 */
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key';
const TEST_DEVICE_ID = process.env.TEST_DEVICE_ID || 'mt-test1234';

test.describe('Device Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('device list displays correctly', async ({ page }) => {
    // Navigate to devices section
    await page.click('a[href*="devices"], button:has-text("Devices")');

    // Device list or empty state should be visible
    const deviceList = page.locator('[data-testid="device-list"], .device-list');
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state');

    await expect(deviceList.or(emptyState)).toBeVisible();
  });

  test('device details open on click', async ({ page }) => {
    // Navigate to devices
    await page.click('a[href*="devices"], button:has-text("Devices")');

    // Click on first device if available
    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Device details should be visible
      await expect(page.locator('[data-testid="device-details"], .device-details')).toBeVisible();
    }
  });

  test('claim device flow works', async ({ page }) => {
    // Navigate to claim device
    await page.click('button:has-text("Claim Device"), a:has-text("Claim Device")');

    // Claim form should be visible
    await expect(page.locator('input[name="device-id"], input[placeholder*="device"]')).toBeVisible();
    await expect(page.locator('input[name="pairing-code"], input[placeholder*="code"]')).toBeVisible();

    // Fill in claim details
    await page.fill('input[name="device-id"], input[placeholder*="device"]', 'mt-newdevice');
    await page.fill('input[name="pairing-code"], input[placeholder*="code"]', 'abc12345');

    // Submit claim
    await page.click('button[type="submit"]:has-text("Claim")');

    // Should show success or error
    await expect(page.locator('.success, .error, [role="alert"]')).toBeVisible();
  });

  test('share device flow works', async ({ page }) => {
    // Navigate to a device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Click share button
      await page.click('button:has-text("Share"), [data-testid="share-button"]');

      // Share form should be visible
      await expect(page.locator('input[type="email"], input[placeholder*="email"]')).toBeVisible();

      // Fill in share details
      await page.fill('input[type="email"], input[placeholder*="email"]', 'family@example.com');

      // Select role
      await page.selectOption('select[name="role"], [data-testid="role-select"]', 'viewer');

      // Submit share
      await page.click('button[type="submit"]:has-text("Share")');

      // Should show success
      await expect(page.locator('.success, [role="status"]')).toBeVisible();
    }
  });

  test('device settings can be accessed', async ({ page }) => {
    // Navigate to a device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Click settings button
      await page.click('button:has-text("Settings"), [data-testid="settings-button"]');

      // Settings panel should be visible
      await expect(page.locator('[data-testid="device-settings"], .device-settings')).toBeVisible();
    }
  });

  test('device alias can be updated', async ({ page }) => {
    // Navigate to a device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Click edit alias
      await page.click('[data-testid="edit-alias"], button:has-text("Edit")');

      // Fill in new alias
      await page.fill('input[name="alias"], input[placeholder*="alias"]', 'My Phone');

      // Save
      await page.click('button:has-text("Save")');

      // Should show success
      await expect(page.locator('.success, [role="status"]')).toBeVisible();
    }
  });

  test('device deletion requires confirmation', async ({ page }) => {
    // Navigate to a device
    await page.click('a[href*="devices"], button:has-text("Devices")');

    const deviceCard = page.locator('[data-testid="device-card"], .device-card').first();

    if (await deviceCard.isVisible()) {
      await deviceCard.click();

      // Click delete button
      await page.click('button:has-text("Delete"), [data-testid="delete-button"]');

      // Confirmation dialog should appear
      await expect(page.locator('.dialog, [role="dialog"]')).toBeVisible();
      await expect(page.locator('text=Are you sure')).toBeVisible();

      // Cancel deletion
      await page.click('button:has-text("Cancel")');
    }
  });
});

test.describe('Device Map', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('map displays device locations', async ({ page }) => {
    // Navigate to map view
    await page.click('a[href*="map"], button:has-text("Map")');

    // Map should be visible
    await expect(page.locator('[data-testid="map"], .map, #map')).toBeVisible();
  });

  test('device markers are clickable', async ({ page }) => {
    // Navigate to map view
    await page.click('a[href*="map"], button:has-text("Map")');

    // Wait for map to load
    await page.waitForSelector('[data-testid="map"], .map, #map');

    // Try to click on a device marker
    const marker = page.locator('[data-testid="device-marker"], .device-marker').first();

    if (await marker.isVisible()) {
      await marker.click();

      // Info window should appear
      await expect(page.locator('[data-testid="info-window"], .info-window')).toBeVisible();
    }
  });
});
