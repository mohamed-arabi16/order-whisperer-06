import { test, expect } from '@playwright/test';

// These tests verify guards on the POSSystem route.
// - An authenticated user should not be redirected from the POS page, even if the tenant lookup fails or is slow.

test.describe('POS access guard', () => {
  // Mock a logged-in user before each test to ensure the guard logic is tested correctly.
  test.beforeEach(async ({ page }) => {
    const mockAuthState = {
      user: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'owner@example.com' },
      profile: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', role: 'restaurant_owner' },
      tenantId: null,
      loading: false,
      session: { access_token: 'mock-token', user: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' } },
    };

    // Use addInitScript to set up the mock state in localStorage before the page loads.
    // This ensures the application boots with the mock authenticated state.
    await page.addInitScript((state) => {
      window.localStorage.setItem('mock-auth-state', JSON.stringify(state));
    }, mockAuthState);
  });

  test('does not redirect to POS Access when tenant is unknown', async ({ page }) => {
    await page.goto('/#/pos-system/unknown-slug', { waitUntil: 'domcontentloaded' });

    // Allow the app a brief moment to potentially navigate.
    await page.waitForTimeout(1200);

    // Verify we are still on the POS System route and not redirected.
    // The poll assertion ensures we wait for any async operations to complete.
    await expect.poll(() => page.url(), { timeout: 5000 }).toContain('/#/pos-system/unknown-slug');
    expect(page.url()).not.toContain('/#/pos-access/');
  });

  test('does not redirect to POS Access during tenant lookup delay', async ({ page }) => {
    // Artificially delay the tenants request to simulate a slow network or backend.
    await page.route('**/rest/v1/tenants*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await page.goto('/#/pos-system/dummy-slug', { waitUntil: 'domcontentloaded' });

    // Shortly after navigation, ensure no premature redirect has occurred.
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain('/#/pos-access/');
  });
});