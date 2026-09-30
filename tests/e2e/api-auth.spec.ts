import { test, expect } from '@playwright/test';

test.describe('API Authentication & Session', () => {
  test('should get session token from /api/session/init', async ({ page, context }) => {
    const response = await page.request.get('/api/session/init');
    expect(response.status()).toBe(200);
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'gguard_session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);
  });

  test('should reject requests without session token', async ({ page }) => {
    const response = await page.request.post('/api/assessments', {
      data: {
        zip_code: '90210',
        door_type: 'single',
        problems: ['wont_open'],
        email: 'test@example.com',
        tier: 'standard',
        evidence: [],
        ai_processing_consent: true,
      },
    });
    expect(response.status()).toBe(401);
  });

  test('should accept requests with valid session cookie', async ({ page, context }) => {
    await page.request.get('/api/session/init');
    const cookies = await context.cookies();
    const response = await page.request.post('/api/assessments', {
      headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') },
      data: {
        zip_code: '90210',
        door_type: 'single',
        problems: ['wont_open'],
        email: 'test@example.com',
        tier: 'standard',
        evidence: [],
        quote_key: null,
        ai_processing_consent: true,
      },
    });
    expect([200, 400, 500]).toContain(response.status());
    expect(response.status()).not.toBe(401);
  });

  test('should reject missing guided evidence', async ({ page }) => {
    await page.request.get('/api/session/init');
    const response = await page.request.post('/api/assessments', {
      data: {
        zip_code: '90210',
        door_type: 'single',
        problems: ['wont_open'],
        email: 'test@example.com',
        phone: null,
        property_label: null,
        contractor_name: null,
        contractor_quote_cents: null,
        quote_key: null,
        tier: 'standard',
        evidence: [],
        ai_processing_consent: true,
      },
    });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('required assessment details'),
    });
  });

  test('should require one photo but not exact evidence categories', async ({ page, context }) => {
    await page.request.get('/api/session/init');
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === 'gguard_session');
    expect(session?.value).toBeTruthy();

    const response = await page.request.post('/api/assessments', {
      data: {
        address: '123 Main Street',
        zip_code: '90210',
        door_type: 'single',
        problems: ['uneven_door'],
        description: '',
        email: 'test@example.com',
        tier: 'standard',
        evidence: [{
          key: `uploads/${session?.value}/video/operation.webm`,
          category: 'operation_video',
          media_type: 'video',
        }],
        ai_processing_consent: true,
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('at least one safe garage-door photo'),
    });
  });

  test('should expose the session endpoint', async ({ page }) => {
    const initResponse = await page.request.get('/api/session/init');
    expect(initResponse.status()).toBe(200);
  });

  test('should reject malformed requests', async ({ page, context }) => {
    await page.request.get('/api/session/init');
    const cookies = await context.cookies();
    const response = await page.request.post('/api/assessments', {
      headers: { 'Cookie': cookies.map(c => `${c.name}=${c.value}`).join('; ') },
      data: 'not json',
    });
    expect(response.status()).toBe(400);
  });
});
