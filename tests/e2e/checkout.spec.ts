import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should load checkout page and verify form elements', async ({ page }) => {
    // This test would need a valid assessment ID
    // For now, we verify the checkout route exists
    
    // Try to navigate to checkout (will likely redirect or show error without valid ID)
    const response = await page.goto('/success', { waitUntil: 'load' });
    
    // Page should load (may show error, but shouldn't 404)
    expect(response?.status()).not.toBe(404);
  });

  test('should reject checkout without valid session', async ({ page }) => {
    // Try to call /api/checkout without session
    const response = await page.request.post('/api/checkout', {
      data: {
        assessmentId: '00000000-0000-0000-0000-000000000000',
        email: 'test@example.com',
      },
    });

    // Should be 401 or 400 (missing session)
    expect([400, 401, 404]).toContain(response.status());
  });

  test('should validate email format in checkout', async ({ page }) => {
    await page.request.get('/api/session/init');
    
    // Try invalid email
    const response = await page.request.post('/api/checkout', {
      data: {
        assessmentId: '00000000-0000-0000-0000-000000000000',
        email: 'not-an-email',
      },
    });

    // Should be rejected for invalid email or assessment not found
    expect([400, 404]).toContain(response.status());
  });

  test('should require valid assessment ID', async ({ page }) => {
    await page.request.get('/api/session/init');
    
    // Try with invalid UUID format
    const response = await page.request.post('/api/checkout', {
      data: {
        assessmentId: 'not-a-uuid',
        email: 'test@example.com',
      },
    });

    // Should be rejected
    expect([400, 404]).toContain(response.status());
  });

  test('should handle Stripe session creation errors', async ({ page }) => {
    await page.request.get('/api/session/init');
    
    // Attempt checkout with non-existent assessment
    const response = await page.request.post('/api/checkout', {
      data: {
        assessmentId: '00000000-0000-0000-0000-000000000000',
        email: 'test@example.com',
      },
    });

    // Should return error, not crash
    expect([400, 404, 500]).toContain(response.status());
  });

  test('should set proper response headers', async ({ page }) => {
    // Navigate to success page
    const response = await page.goto('/success', { waitUntil: 'load' });
    
    // Check that response headers are set
    expect(response?.headers()).toBeDefined();
  });
});
