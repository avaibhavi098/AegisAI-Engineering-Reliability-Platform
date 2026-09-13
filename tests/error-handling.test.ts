import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient, TestClient } from './helpers.js';
import { sanitizeErrorMessage } from '../server/validation.js';

test('Centralized Error Handling and Safety Suite', async (t) => {
  let client: TestClient;
  let adminToken: string;

  t.before(async () => {
    client = await createTestClient();
    adminToken = await client.getAdminToken();
  });

  t.after(async () => {
    await client.close();
  });

  await t.test('404 for undefined API routes returns consistent JSON error', async () => {
    const res = await client.request('/undefined-endpoint-route');
    assert.equal(res.status, 404);
  });

  await t.test('Malformed JSON payloads are rejected safely without crashing the server', async () => {
    const rawRes = await fetch(`${client.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalidJson": malformed...',
    });

    assert.equal(rawRes.status, 400);
    const body = await rawRes.json().catch(() => null);
    assert.ok(body);
    assert.ok(body.error || body.message);
  });

  await t.test('Error sanitization prevents API keys from leaking into response payloads', () => {
    const mockErrorWithSecret = new Error(
      'GoogleGenAI call failed: API key AIzaSyD982kXyZ10928aBcDeFgHiJkLmNoPqRs is invalid or suspended'
    );
    const sanitized = sanitizeErrorMessage(mockErrorWithSecret);

    assert.ok(!sanitized.includes('AIzaSyD982kXyZ10928aBcDeFgHiJkLmNoPqRs'));
    assert.ok(sanitized.includes('[REDACTED_KEY]'));
  });

  await t.test('Error sanitization prevents server disk file paths from leaking', () => {
    const mockErrorWithPath = new Error(
      'SQLite write failure at /var/run/app/database.sqlite: disk I/O error'
    );
    const sanitized = sanitizeErrorMessage(mockErrorWithPath);

    assert.ok(!sanitized.includes('/var/run/app'));
    assert.ok(sanitized.includes('[INTERNAL_PATH]'));
  });

  await t.test('Missing required query parameters return 400 Bad Request with helpful error', async () => {
    const res = await client.request('/incidents', {
      method: 'POST',
      token: adminToken,
      body: {},
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });
});
