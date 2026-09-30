import { test, expect } from '@playwright/test';

test.describe('Session Management', () => {
  test('should initialize session on app load', async ({ page, context }) => {
    await page.request.get('/api/session/init');

    // Check that cookies are set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'gguard_session');
    
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');
  });

  test('should persist session across page navigation', async ({ page, context }) => {
    await page.request.get('/api/session/init');

    // Get initial session cookie
    let cookies = await context.cookies();
    const initialSession = cookies.find(c => c.name === 'gguard_session')?.value;

    // Navigate to home
    await page.goto('/');
    await page.waitForTimeout(500);

    // Session should still exist
    cookies = await context.cookies();
    const persistedSession = cookies.find(c => c.name === 'gguard_session')?.value;

    expect(persistedSession).toBe(initialSession);
  });
});
