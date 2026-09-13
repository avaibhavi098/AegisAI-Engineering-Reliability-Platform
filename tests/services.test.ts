import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient, TestClient } from './helpers.js';

test('Services CRUD and Validation Suite', async (t) => {
  let client: TestClient;
  let adminToken: string;
  let engineerToken: string;
  let viewerToken: string;

  t.before(async () => {
    client = await createTestClient();
    adminToken = await client.getAdminToken();
    engineerToken = await client.getEngineerToken();
    viewerToken = await client.getViewerToken();
  });

  t.after(async () => {
    await client.close();
  });

  await t.test('GET /api/services returns list of persisted services', async () => {
    const res = await client.request('/services', { token: viewerToken });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.services));
    assert.ok(res.body.services.length > 0);
  });

  let createdServiceId = '';

  await t.test('POST /api/services allows ADMIN to create a new service', async () => {
    const payload = {
      name: 'Kafka Message Bus',
      key: 'srv-kafka-eventstream',
      tier: 'TIER-1',
      description: 'Distributed event streaming backbone.',
      status: 'HEALTHY',
      latencyMs: 14,
      errorRate: 0.002,
      uptimePercent: 99.995,
      requestRateRps: 4500,
      dependencies: ['srv-zookeeper'],
      ownerTeam: 'Data Infrastructure',
    };

    const res = await client.request('/services', {
      method: 'POST',
      token: adminToken,
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.service);
    assert.equal(res.body.service.name, 'Kafka Message Bus');
    assert.equal(res.body.service.tier, 'TIER-1');
    assert.equal(res.body.service.status, 'HEALTHY');
    createdServiceId = res.body.service.id;
  });

  await t.test('GET /api/services/:id retrieves newly created service from database', async () => {
    assert.ok(createdServiceId, 'Service ID should be set');
    const res = await client.request(`/services/${createdServiceId}`, { token: viewerToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.service.id, createdServiceId);
    assert.equal(res.body.service.name, 'Kafka Message Bus');
  });

  await t.test('GET /api/services/:id returns 404 for non-existent service ID', async () => {
    const res = await client.request('/services/non-existent-service-999', { token: viewerToken });
    assert.equal(res.status, 404);
    assert.ok(res.body.error);
  });

  await t.test('PATCH /api/services/:id allows ADMIN to update service status and metrics', async () => {
    const res = await client.request(`/services/${createdServiceId}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'DEGRADED',
        latencyMs: 120,
        errorRate: 0.045,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.service.status, 'DEGRADED');
    assert.equal(res.body.service.latencyMs, 120);
    assert.equal(res.body.service.errorRate, 0.045);
  });

  await t.test('POST /api/services rejects invalid parameters with 400', async () => {
    // Missing name
    const missingName = await client.request('/services', {
      method: 'POST',
      token: adminToken,
      body: { tier: 'TIER-1' },
    });
    assert.equal(missingName.status, 400);

    // Invalid tier
    const invalidTier = await client.request('/services', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Faulty Service', tier: 'TIER-99' },
    });
    assert.equal(invalidTier.status, 400);

    // Invalid error rate (> 1)
    const invalidErrorRate = await client.request('/services', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Faulty Service', errorRate: 2.5 },
    });
    assert.equal(invalidErrorRate.status, 400);
  });

  await t.test('POST /api/services forbidden for non-admin roles', async () => {
    const engRes = await client.request('/services', {
      method: 'POST',
      token: engineerToken,
      body: { name: 'Eng Attempt' },
    });
    assert.equal(engRes.status, 403);

    const viewRes = await client.request('/services', {
      method: 'POST',
      token: viewerToken,
      body: { name: 'Viewer Attempt' },
    });
    assert.equal(viewRes.status, 403);
  });

  await t.test('DELETE /api/services/:id forbidden for non-admin roles', async () => {
    const engRes = await client.request(`/services/${createdServiceId}`, {
      method: 'DELETE',
      token: engineerToken,
    });
    assert.equal(engRes.status, 403);
  });

  await t.test('DELETE /api/services/:id removes service from database for ADMIN', async () => {
    const delRes = await client.request(`/services/${createdServiceId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    // Verify it is no longer retrievable
    const getRes = await client.request(`/services/${createdServiceId}`, { token: adminToken });
    assert.equal(getRes.status, 404);
  });
});
