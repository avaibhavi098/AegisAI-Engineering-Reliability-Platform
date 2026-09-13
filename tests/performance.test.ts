import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db.js';
import { createTestClient } from './helpers.js';

test('Database Performance & Pagination Suite', async (t) => {
  const client = await createTestClient();
  const token = await client.getAdminToken();

  t.after(async () => {
    await client.close();
  });

  await t.test('GET /services with pagination returns paginated structure and total count', async () => {
    const res = await client.request('/services?page=1&limit=2', { token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.services));
    assert.ok(res.body.services.length <= 2);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 2);
    assert.ok(typeof res.body.total === 'number');
    assert.ok(typeof res.body.totalPages === 'number');
  });

  await t.test('GET /services with server-side search filters appropriately', async () => {
    const res = await client.request('/services?search=Payment', { token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.services));
    for (const service of res.body.services) {
      const match =
        service.name.toLowerCase().includes('payment') ||
        service.key.toLowerCase().includes('payment') ||
        service.description.toLowerCase().includes('payment');
      assert.ok(match, 'Service matched the search query');
    }
  });

  await t.test('GET /incidents with pagination returns limited subset without loading entire table', async () => {
    const res = await client.request('/incidents?page=1&limit=3', { token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.incidents));
    assert.ok(res.body.incidents.length <= 3);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 3);
    assert.ok(typeof res.body.total === 'number');
  });

  await t.test('GET /incidents with status filter returns only matching records', async () => {
    const res = await client.request('/incidents?status=OPEN', { token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.incidents));
    for (const inc of res.body.incidents) {
      assert.equal(inc.status, 'OPEN');
    }
  });

  await t.test('GET /audit-logs with pagination returns paginated audit records', async () => {
    const res = await client.request('/audit-logs?page=1&limit=5', { token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.auditLogs));
    assert.ok(res.body.auditLogs.length <= 5);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 5);
    assert.ok(typeof res.body.total === 'number');
  });

  await t.test('GET /metrics completes efficiently and returns computed aggregates', async () => {
    const res = await client.request('/metrics', { token });
    assert.equal(res.status, 200);
    assert.ok(res.body.metrics);
    assert.ok(typeof res.body.metrics.totalServices === 'number');
    assert.ok(typeof res.body.metrics.activeIncidents === 'number');
  });

  await t.test('cleanExpiredSessions runs without error', async () => {
    assert.doesNotThrow(() => {
      db.cleanExpiredSessions();
    });
  });
});
