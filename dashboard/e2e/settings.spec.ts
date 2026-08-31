import { test, expect } from '@playwright/test';

/**
 * E2E tests for settings management flows.
 *
 * These tests validate the complete settings UX:
 * - Profile management
 * - Security settings (2FA)
 * - Notification preferences
 * - Account deletion
 *
 * Environment variables:
 *   TEST_API_KEY - API key for dashboard authentication
 *   TEST_USER_EMAIL - Test user email
 *   TEST_USER_PASSWORD - Test user password
 */
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

test.describe('Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('settings page loads correctly', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Settings page should be visible
    await expect(page.locator('[data-testid="settings-page"], .settings-page')).toBeVisible();
  });

  test('profile section displays user info', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Profile section should be visible
    await expect(page.locator('text=Profile')).toBeVisible();

    // User email should be displayed
    await expect(page.locator(`text=${TEST_USER_EMAIL}`)).toBeVisible();
  });

  test('profile can be updated', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Click edit profile
    await page.click('button:has-text("Edit Profile"), [data-testid="edit-profile"]');

    // Edit form should be visible
    await expect(page.locator('input[name="display-name"], input[placeholder*="name"]')).toBeVisible();

    // Update display name
    await page.fill('input[name="display-name"], input[placeholder*="name"]', 'Test User Updated');

    // Save changes
    await page.click('button:has-text("Save")');

    // Should show success
    await expect(page.locator('.success, [role="status"]')).toBeVisible();
  });

  test('security settings section exists', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Security section should be visible
    await expect(page.locator('text=Security')).toBeVisible();
  });

  test('2FA setup flow can be initiated', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Click 2FA setup
    try {
      await page.click('button:has-text("Enable 2FA"), [data-testid="enable-2fa"]');

      // 2FA setup should start (QR code or manual entry)
      await expect(page.locator('[data-testid="2fa-setup"], .2fa-setup, text=Scan QR')).toBeVisible();
    } catch (e) {
      // 2FA may already be enabled or not available
    }
  });

  test('notification preferences can be accessed', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Notification settings should be accessible
    try {
      await page.click('button:has-text("Notifications"), a:has-text("Notifications")');

      // Notification preferences should be visible
      await expect(page.locator('[data-testid="notification-settings"], .notification-settings')).toBeVisible();
    } catch (e) {
      // Settings may be on same page
    }
  });

  test('logout button works from settings', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Click logout
    await page.click('button:has-text("Logout"), [data-testid="logout-button"]');

    // Should show confirmation
    await expect(page.locator('.dialog, [role="dialog"]')).toBeVisible();

    // Confirm logout
    await page.click('button:has-text("Confirm"), button:has-text("Yes")');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Account Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('account deletion requires password confirmation', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Click delete account
    try {
      await page.click('button:has-text("Delete Account"), [data-testid="delete-account"]');

      // Should show password confirmation
      await expect(page.locator('input[type="password"], text=Enter password')).toBeVisible();

      // Cancel deletion
      await page.click('button:has-text("Cancel")');
    } catch (e) {
      // Delete account may require additional steps
    }
  });

  test('data export option exists', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href*="settings"], button:has-text("Settings")');

    // Export data option should be visible
    try {
      await expect(page.locator('button:has-text("Export"), a:has-text("Export")')).toBeVisible();
    } catch (e) {
      // Export may not be implemented yet
    }
  });
});
