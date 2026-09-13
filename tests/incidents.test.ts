import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient, TestClient } from './helpers.js';

test('Incidents CRUD, Lifecycle and History Suite', async (t) => {
  let client: TestClient;
  let adminToken: string;
  let engineerToken: string;
  let viewerToken: string;
  let targetServiceId: string;
  let targetEngineerId: string;

  t.before(async () => {
    client = await createTestClient();
    adminToken = await client.getAdminToken();
    engineerToken = await client.getEngineerToken();
    viewerToken = await client.getViewerToken();

    // Get an existing service
    const svcRes = await client.request('/services', { token: viewerToken });
    assert.ok(svcRes.body.services.length > 0, 'Must have at least one service');
    targetServiceId = svcRes.body.services[0].id;

    // Get an existing engineer
    const engRes = await client.request('/engineers', { token: viewerToken });
    assert.ok(engRes.body.engineers.length > 0, 'Must have at least one engineer');
    targetEngineerId = engRes.body.engineers[0].id;
  });

  t.after(async () => {
    await client.close();
  });

  await t.test('GET /api/incidents returns persisted incidents', async () => {
    const res = await client.request('/incidents', { token: viewerToken });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.incidents));
  });

  let createdIncidentId = '';

  await t.test('POST /api/incidents allows ENGINEER to declare an incident', async () => {
    const payload = {
      title: 'Redis Cache Cluster Latency Spike',
      description: 'Latency on cache lookups has exceeded 80ms causing request queuing.',
      serviceId: targetServiceId,
      severity: 'HIGH',
      errorLogs: 'WARN Redis cluster node 3 memory usage 94%\nERROR SocketTimeoutException: Read timed out after 5000ms',
      assignedEngineerId: targetEngineerId,
    };

    const res = await client.request('/incidents', {
      method: 'POST',
      token: engineerToken,
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.incident);
    assert.equal(res.body.incident.title, 'Redis Cache Cluster Latency Spike');
    assert.equal(res.body.incident.severity, 'HIGH');
    assert.equal(res.body.incident.status, 'OPEN');
    assert.equal(res.body.incident.serviceId, targetServiceId);
    assert.ok(res.body.incident.createdAt);
    assert.ok(res.body.incident.id);
    createdIncidentId = res.body.incident.id;
  });

  await t.test('POST /api/incidents rejects declaration with invalid serviceId', async () => {
    const res = await client.request('/incidents', {
      method: 'POST',
      token: engineerToken,
      body: {
        title: 'Valid title',
        serviceId: 'non-existent-service-12345',
        severity: 'MEDIUM',
      },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('does not exist'));
  });

  await t.test('POST /api/incidents rejects invalid severity or missing fields', async () => {
    const missingTitle = await client.request('/incidents', {
      method: 'POST',
      token: engineerToken,
      body: { serviceId: targetServiceId, severity: 'LOW' },
    });
    assert.equal(missingTitle.status, 400);

    const invalidSeverity = await client.request('/incidents', {
      method: 'POST',
      token: engineerToken,
      body: { title: 'Test Incident', serviceId: targetServiceId, severity: 'UNKNOWN_SEV' },
    });
    assert.equal(invalidSeverity.status, 400);
  });

  await t.test('GET /api/incidents/:id retrieves incident and its assigned engineer', async () => {
    const res = await client.request(`/incidents/${createdIncidentId}`, { token: viewerToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.incident.id, createdIncidentId);
    assert.equal(res.body.incident.title, 'Redis Cache Cluster Latency Spike');
    assert.ok(res.body.incident.assignedEngineer);
  });

  await t.test('PATCH /api/incidents/:id updates incident status and severity', async () => {
    const res = await client.request(`/incidents/${createdIncidentId}`, {
      method: 'PATCH',
      token: engineerToken,
      body: {
        status: 'INVESTIGATING',
        severity: 'CRITICAL',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.incident.status, 'INVESTIGATING');
    assert.equal(res.body.incident.severity, 'CRITICAL');
  });

  await t.test('POST /api/incidents/:id/assign updates engineer assignment and persists', async () => {
    const engList = await client.request('/engineers', { token: viewerToken });
    const engineer = engList.body.engineers[0];

    const res = await client.request(`/incidents/${createdIncidentId}/assign`, {
      method: 'POST',
      token: engineerToken,
      body: { engineerId: engineer.id },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.incident.assignedEngineer?.id, engineer.id);
  });

  await t.test('POST /api/incidents/:id/resolve marks incident RESOLVED and sets notes', async () => {
    const res = await client.request(`/incidents/${createdIncidentId}/resolve`, {
      method: 'POST',
      token: engineerToken,
      body: {
        resolutionNotes: 'Redis node memory evicted and key cache re-warmed. Latency returned to <10ms.',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.incident.status, 'RESOLVED');
    assert.ok(res.body.incident.resolvedAt);
    assert.ok(res.body.incident.resolutionNotes.includes('evicted and key cache re-warmed'));
  });

  await t.test('GET /api/incidents/:id/history returns timeline history records', async () => {
    const res = await client.request(`/incidents/${createdIncidentId}/history`, { token: viewerToken });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.history));
    assert.ok(res.body.history.length >= 2, 'History must have recorded lifecycle events');
    assert.ok(
      res.body.history.some(
        (h: any) =>
          (h.actionType && h.actionType.includes('STATUS')) ||
          (h.description && h.description.includes('RESOLVED')) ||
          (h.actionType && h.actionType.includes('ASSIGN'))
      )
    );
  });

  await t.test('DELETE /api/incidents/:id allows ADMIN and removes incident from database', async () => {
    // Non-admin cannot delete
    const engAttempt = await client.request(`/incidents/${createdIncidentId}`, {
      method: 'DELETE',
      token: engineerToken,
    });
    assert.equal(engAttempt.status, 403);

    // Admin can delete
    const adminDel = await client.request(`/incidents/${createdIncidentId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert.equal(adminDel.status, 200);

    // Confirm deleted
    const getRes = await client.request(`/incidents/${createdIncidentId}`, { token: viewerToken });
    assert.equal(getRes.status, 404);
  });
});
