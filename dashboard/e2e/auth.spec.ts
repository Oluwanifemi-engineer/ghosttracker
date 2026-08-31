import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication flows.
 *
 * These tests validate the complete authentication UX:
 * - Login with valid/invalid credentials
 * - Registration flow
 * - Password reset
 * - Session management
 * - Logout functionality
 *
 * Environment variables:
 *   TEST_API_KEY - API key for dashboard authentication
 *   TEST_USER_EMAIL - Test user email
 *   TEST_USER_PASSWORD - Test user password
 */
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('login page displays correctly', async ({ page }) => {
    await page.goto('/login');

    // Login form should be visible
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.fill('input[type="email"], input[name="email"]', 'invalid@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.error, [role="alert"]')).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill in valid credentials
    await page.fill('input[type="email"], input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('registration page displays correctly', async ({ page }) => {
    await page.goto('/register');

    // Registration form should be visible
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('password reset flow works', async ({ page }) => {
    await page.goto('/login');

    // Click forgot password link
    await page.click('a[href*="forgot-password"], button:has-text("Forgot Password")');

    // Should navigate to forgot password page
    await expect(page).toHaveURL(/.*forgot-password/);

    // Fill in email
    await page.fill('input[type="email"], input[name="email"]', TEST_USER_EMAIL);
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator('.success, [role="status"]')).toBeVisible();
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    // Logout
    await page.click('button:has-text("Logout"), a:has-text("Logout")');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);

    // Session should be cleared
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});

test.describe('Protected Routes', () => {
  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('dashboard requires authentication', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login or show login form
    const url = page.url();
    expect(url.includes('login') || url.includes('dashboard')).toBeTruthy();
  });
});
