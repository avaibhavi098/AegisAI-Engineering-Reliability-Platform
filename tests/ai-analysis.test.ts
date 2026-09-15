import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient, TestClient } from './helpers.js';
import { setMockGeminiClient, resetGeminiClient } from '../server/gemini.js';
import { db } from '../server/db.js';

test('AI Analysis and Resilient Error Handling Suite', async (t) => {
  let client: TestClient;
  let adminToken: string;
  let engineerToken: string;
  let viewerToken: string;
  let testIncidentId: string;

  t.before(async () => {
    client = await createTestClient();
    adminToken = await client.getAdminToken();
    engineerToken = await client.getEngineerToken();
    viewerToken = await client.getViewerToken();

    // Create a target incident for testing AI diagnostics
    const svcRes = await client.request('/services', { token: viewerToken });
    const serviceId = svcRes.body.services[0].id;

    const incRes = await client.request('/incidents', {
      method: 'POST',
      token: engineerToken,
      body: {
        title: 'PostgreSQL Replication Lag Anomaly',
        description: 'Read replicas are falling behind primary by 450MB WAL segments.',
        serviceId,
        severity: 'HIGH',
        triggerAI: false,
      },
    });
    assert.equal(incRes.status, 201);
    testIncidentId = incRes.body.incident.id;
  });

  t.after(async () => {
    resetGeminiClient();
    await client.close();
  });

  await t.test('Database persistence: saveAiAnalysis stores all 11 required analysis dimensions', async () => {
    const saved = await db.saveAiAnalysis({
      incidentId: testIncidentId,
      modelUsed: 'gemini-3.8-flash',
      summary: 'WAL receiver buffer saturation due to unindexed batch deletion on primary.',
      probableRootCause: 'Massive unindexed cascade delete query locking pg_stat_activity.',
      possibleCauses: [
        'Disk I/O bandwidth throttle on replica EBS volume',
        'Large maintenance batch transaction holding exclusive lock',
      ],
      recommendedActions: [
        'Terminate blocking PID in pg_stat_activity',
        'Increase max_wal_size temporarily to prevent checkpoint thrashing',
      ],
      severityAssessment: 'HIGH',
      confidence: 92,
      riskFactors: ['Potential read replica failover timeout', 'Stale analytics read traffic'],
      preventionSuggestions: [
        'Add index on foreign key cascade delete columns',
        'Chunk deletions into maximum 1000 row transactions',
      ],
      runbookCommands: [
        'SELECT pid, query, state, age(clock_timestamp(), query_start) FROM pg_stat_activity WHERE state != \'idle\';',
      ],
      analyzedByUserId: 'usr-admin-1',
      analyzedByUserName: 'Elena Rostova',
    });

    assert.ok(saved.id);
    assert.equal(saved.incidentId, testIncidentId);
    assert.equal(saved.modelUsed, 'gemini-3.8-flash');
    assert.equal(saved.confidence, 92);
    assert.equal(saved.probableRootCause, 'Massive unindexed cascade delete query locking pg_stat_activity.');
    assert.equal(saved.possibleCauses.length, 2);
    assert.equal(saved.recommendedActions.length, 2);
    assert.equal(saved.riskFactors.length, 2);
    assert.equal(saved.preventionSuggestions.length, 2);
    assert.ok(saved.generatedAt, 'Must have generated timestamp');

    // Verify it is retrievable through getAnalysesForIncident
    const retrieved = await db.getAnalysesForIncident(testIncidentId);
    assert.ok(retrieved.length > 0);
    const found = retrieved.find((a) => a.id === saved.id);
    assert.ok(found);
    assert.equal(found.confidence, 92);
  });

  await t.test('POST /api/ai/analyze-incident with mock Gemini returns structured RCA and persists to DB', async () => {
    const mockAiResponse = {
      incidentSummary: 'High WAL replication lag triggered by lock contention during bulk data purge.',
      probableRootCause: 'Exclusive table lock acquired on customer_sessions table.',
      possibleAlternativeCauses: [
        'Network throttling between availability zones',
        'Checkpointer process I/O starvation',
      ],
      recommendedTroubleshootingSteps: [
        'Inspect blocking transactions in pg_stat_activity',
        'Scale replication connection pool',
      ],
      riskFactors: ['Replica split-brain risk', 'Read request latency degradation'],
      severityAssessment: 'HIGH',
      confidenceScore: 94,
      preventionSuggestions: [
        'Enforce small batch deletions with sleep delays',
        'Configure statement_timeout = 30000ms',
      ],
      runbookCommands: ['SELECT pg_is_in_recovery();'],
    };

    setMockGeminiClient({
      models: {
        generateContent: async () => ({
          text: JSON.stringify(mockAiResponse),
        }),
      },
    });

    const res = await client.request('/ai/analyze-incident', {
      method: 'POST',
      token: engineerToken,
      body: {
        incidentId: testIncidentId,
        title: 'PostgreSQL Replication Lag Anomaly',
        serviceName: 'Database Cluster',
        severity: 'HIGH',
        status: 'INVESTIGATING',
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.analysis);
    assert.equal(res.body.savedWithIncident, true);
    assert.equal(res.body.analysis.confidence, 94);
    assert.equal(res.body.analysis.probableRootCause, mockAiResponse.probableRootCause);
    assert.equal(res.body.analysis.summary, mockAiResponse.incidentSummary);

    // Verify incident record contains the updated analysis
    const incRes = await client.request(`/incidents/${testIncidentId}`, { token: viewerToken });
    assert.equal(incRes.status, 200);
    assert.ok(incRes.body.incident.aiAnalysis);
    assert.equal(incRes.body.incident.aiAnalysis.confidence, 94);
  });

  await t.test('POST /api/ai/analyze-incident gracefully handles Gemini 429 Rate Limit error', async () => {
    setMockGeminiClient({
      models: {
        generateContent: async () => {
          const err = new Error('Resource has been exhausted (e.g. check quota). [429 Quota Exceeded]');
          (err as any).status = 429;
          throw err;
        },
      },
    });

    const res = await client.request('/ai/analyze-incident', {
      method: 'POST',
      token: engineerToken,
      body: {
        incidentId: testIncidentId,
        title: 'PostgreSQL Replication Lag Anomaly',
      },
    });

    assert.equal(res.status, 429);
    assert.equal(res.body.isRateLimit, true);
    assert.equal(res.body.confidenceUnavailable, true);
    assert.ok(res.body.error.includes('rate limit or quota'));
    // Ensure fake diagnostic data is not fabricated
    assert.equal(res.body.analysis, undefined);
  });

  await t.test('POST /api/ai/analyze-incident gracefully handles Gemini 503 High Demand / Overloaded error', async () => {
    setMockGeminiClient({
      models: {
        generateContent: async () => {
          const err = new Error('The model is temporarily overloaded. Please try again later. [503]');
          (err as any).status = 503;
          throw err;
        },
      },
    });

    const res = await client.request('/ai/analyze-incident', {
      method: 'POST',
      token: engineerToken,
      body: {
        incidentId: testIncidentId,
        title: 'PostgreSQL Replication Lag Anomaly',
      },
    });

    assert.equal(res.status, 503);
    assert.equal(res.body.isHighDemand, true);
    assert.equal(res.body.confidenceUnavailable, true);
    assert.ok(res.body.error.includes('high demand'));
    assert.equal(res.body.analysis, undefined);
  });

  await t.test('POST /api/ai/analyze-incident gracefully handles timeout error', async () => {
    setMockGeminiClient({
      models: {
        generateContent: async () => {
          throw new Error('Gemini AI analysis timed out after 30s. Please retry.');
        },
      },
    });

    const res = await client.request('/ai/analyze-incident', {
      method: 'POST',
      token: engineerToken,
      body: {
        incidentId: testIncidentId,
        title: 'PostgreSQL Replication Lag Anomaly',
      },
    });

    assert.equal(res.status, 504);
    assert.equal(res.body.isTimeout, true);
    assert.equal(res.body.confidenceUnavailable, true);
    assert.ok(res.body.error.includes('timed out'));
    assert.equal(res.body.analysis, undefined);
  });

  await t.test('POST /api/ai/analyze-incident is forbidden for VIEWER role', async () => {
    const res = await client.request('/ai/analyze-incident', {
      method: 'POST',
      token: viewerToken,
      body: { title: 'Unauthorized analysis request' },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FORBIDDEN');
  });
});
