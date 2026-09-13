import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient } from './helpers.js';
import { db } from '../server/db.js';

test('1. System Health - GET /api/health returns structured system status', async () => {
  const client = await createTestClient();
  try {
    const res = await client.request('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.service, 'AegisAI');
    assert.ok(res.body.status === 'ok' || res.body.status === 'degraded');
    assert.ok(res.body.systemStatus);
    assert.ok(res.body.timestamp);
    assert.ok(typeof res.body.uptimeSeconds === 'number');

    // Subsystem checks
    assert.ok(res.body.checks);
    assert.ok(res.body.checks.api);
    assert.equal(res.body.checks.api.status, 'HEALTHY');
    assert.ok(res.body.checks.api.uptimeSeconds >= 0);

    assert.ok(res.body.checks.database);
    assert.equal(res.body.checks.database.status, 'HEALTHY');
    assert.ok(typeof res.body.checks.database.latencyMs === 'number');
    assert.ok(res.body.checks.database.totalTables > 0);

    assert.ok(res.body.checks.geminiAi);
    assert.ok(res.body.checks.geminiAi.status);
    assert.ok(res.body.checks.geminiAi.model);
  } finally {
    await client.close();
  }
});

test('2. API Performance - Telemetry tracks live requests, latencies, and errors', async () => {
  const client = await createTestClient();
  try {
    const token = await client.getAdminToken();

    // Fetch initial performance stats
    const perf1 = await client.request('/monitoring/performance', { token });
    assert.equal(perf1.status, 200);
    const initialCount = perf1.body.apiPerformance.requestCount;

    // Issue a few real requests to measure
    await client.request('/services', { token });
    await client.request('/incidents', { token });
    await client.request('/metrics', { token });

    // Issue an invalid request that produces a 400 error to test error tracking
    const errRes = await client.request('/services', {
      method: 'POST',
      token,
      body: { name: '' }, // invalid payload
    });
    assert.equal(errRes.status, 400);

    // Fetch updated performance metrics
    const perf2 = await client.request('/monitoring/performance', { token });
    assert.equal(perf2.status, 200);
    const updated = perf2.body.apiPerformance;

    assert.ok(updated.requestCount > initialCount, 'Request count must increment from live requests');
    assert.ok(updated.averageResponseTimeMs >= 0, 'Average response time must be calculated');
    assert.ok(updated.minResponseTimeMs >= 0);
    assert.ok(updated.maxResponseTimeMs >= updated.minResponseTimeMs);
    assert.ok(updated.errorCount >= 1, 'Error count must capture 400 error');
    assert.ok(updated.errorRatePct >= 0);

    // Verify recent error captured without secrets
    assert.ok(Array.isArray(updated.recentErrors));
    const captured400 = updated.recentErrors.find((e: any) => e.statusCode === 400);
    assert.ok(captured400, 'Must record recent 400 error');
    assert.equal(captured400.method, 'POST');
    assert.equal(captured400.path, '/api/services');
    assert.ok(!captured400.message.includes('password'), 'Error log must not leak passwords');
  } finally {
    await client.close();
  }
});

test('3. Service Health - Detailed status, response time, and probe execution', async () => {
  const client = await createTestClient();
  try {
    const token = await client.getAdminToken();
    const res = await client.request('/monitoring/overview', { token });
    assert.equal(res.status, 200);

    const services = res.body.servicesHealth;
    assert.ok(Array.isArray(services));
    assert.ok(services.length > 0, 'Should have registered services');

    const firstService = services[0];
    assert.ok(firstService.id);
    assert.ok(firstService.name);
    assert.ok(['HEALTHY', 'DEGRADED', 'DOWN'].includes(firstService.status));
    assert.ok(firstService.lastHealthCheck);
    assert.ok(typeof firstService.incidentCount === 'number');
    assert.ok(Array.isArray(firstService.recentErrors));

    // Probe service
    const probeRes = await client.request(`/monitoring/services/${firstService.id}/probe`, {
      method: 'POST',
      token,
    });
    assert.equal(probeRes.status, 200);
    assert.equal(probeRes.body.service.id, firstService.id);
    assert.ok(typeof probeRes.body.service.latencyMs === 'number');
  } finally {
    await client.close();
  }
});

test('4. Incident Monitoring - Calculated from database records', async () => {
  const client = await createTestClient();
  try {
    const token = await client.getAdminToken();
    const res = await client.request('/monitoring/overview', { token });
    assert.equal(res.status, 200);

    const im = res.body.incidentMonitoring;
    assert.ok(im, 'incidentMonitoring must be present');
    assert.ok(typeof im.totalIncidents === 'number');
    assert.ok(typeof im.openIncidents === 'number');
    assert.ok(typeof im.investigatingIncidents === 'number');
    assert.ok(typeof im.criticalIncidents === 'number');
    assert.ok(typeof im.resolvedIncidents === 'number');
    assert.ok(Array.isArray(im.recentIncidents));

    // Check MTTR: should be number or null if no resolved incidents
    if (im.resolvedIncidents > 0) {
      assert.ok(typeof im.averageResolutionMinutes === 'number');
    } else {
      assert.equal(im.averageResolutionMinutes, null);
    }
  } finally {
    await client.close();
  }
});

test('5. Security & RBAC - Monitoring endpoints enforce authorization', async () => {
  const client = await createTestClient();
  try {
    const adminToken = await client.getAdminToken();
    const engineerToken = await client.getEngineerToken();
    const viewerToken = await client.getViewerToken();

    // 1. Unauthenticated requests to /monitoring/* are rejected with 401
    const unauth = await client.request('/monitoring/overview');
    assert.equal(unauth.status, 401);

    // 2. Viewer can view overview and performance
    const viewerOverview = await client.request('/monitoring/overview', { token: viewerToken });
    assert.equal(viewerOverview.status, 200);

    const viewerPerf = await client.request('/monitoring/performance', { token: viewerToken });
    assert.equal(viewerPerf.status, 200);

    // 3. Viewer CANNOT access detailed error logs (requires ADMIN or ENGINEER)
    const viewerErrors = await client.request('/monitoring/errors', { token: viewerToken });
    assert.equal(viewerErrors.status, 403);

    // 4. Engineer CAN access error logs and run probes
    const engErrors = await client.request('/monitoring/errors', { token: engineerToken });
    assert.equal(engErrors.status, 200);

    const engProbe = await client.request('/monitoring/probe', { method: 'POST', token: engineerToken });
    assert.equal(engProbe.status, 200);
    assert.ok(engProbe.body.geminiAi);
    assert.ok(engProbe.body.database);

    // 5. Engineer CANNOT clear error logs (requires ADMIN)
    const engClear = await client.request('/monitoring/errors/clear', { method: 'POST', token: engineerToken });
    assert.equal(engClear.status, 403);

    // 6. Admin CAN clear error logs
    const adminClear = await client.request('/monitoring/errors/clear', { method: 'POST', token: adminToken });
    assert.equal(adminClear.status, 200);
    assert.equal(adminClear.body.success, true);
  } finally {
    await client.close();
  }
});
