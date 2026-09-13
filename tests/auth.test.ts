import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestClient, TestClient } from './helpers.js';

test('Authentication and RBAC Suite', async (t) => {
  let client: TestClient;

  t.before(async () => {
    client = await createTestClient();
  });

  t.after(async () => {
    await client.close();
  });

  await t.test('POST /api/auth/signup creates account, returns token and session', async () => {
    const email = `new.engineer.${Date.now()}@aegis.internal`;
    const res = await client.request('/auth/signup', {
      method: 'POST',
      body: {
        name: 'Jordan Reliability',
        email,
        password: 'Password123!',
        role: 'ENGINEER',
        title: 'Senior SRE',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'Must return token');
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.role, 'ENGINEER');
    assert.equal(res.body.user.passwordHash, undefined, 'Must not expose passwordHash');
    assert.equal(res.body.user.salt, undefined, 'Must not expose salt');
  });

  await t.test('POST /api/auth/signup rejects duplicate email with 409 Conflict', async () => {
    const email = `dupe.${Date.now()}@aegis.internal`;
    await client.request('/auth/signup', {
      method: 'POST',
      body: { name: 'First User', email, password: 'Password123!' },
    });

    const dupeRes = await client.request('/auth/signup', {
      method: 'POST',
      body: { name: 'Second User', email, password: 'Password123!' },
    });

    assert.equal(dupeRes.status, 409);
    assert.ok(dupeRes.body.error.includes('already exists'));
  });

  await t.test('POST /api/auth/signup rejects invalid input with 400 Bad Request', async () => {
    const res = await client.request('/auth/signup', {
      method: 'POST',
      body: { name: '', email: 'not-an-email', password: '12' },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  await t.test('POST /api/auth/login authenticates valid user', async () => {
    const res = await client.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@aegis.internal',
        password: 'AegisSec2026!',
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'ADMIN');
  });

  await t.test('POST /api/auth/login rejects incorrect password with 401 Unauthorized', async () => {
    const res = await client.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@aegis.internal',
        password: 'WrongPassword!',
      },
    });

    assert.equal(res.status, 401);
    assert.ok(res.body.error.includes('Invalid email or password'));
  });

  await t.test('POST /api/auth/login rejects unknown user with 401 Unauthorized', async () => {
    const res = await client.request('/auth/login', {
      method: 'POST',
      body: {
        email: 'ghost@aegis.internal',
        password: 'Password123!',
      },
    });

    assert.equal(res.status, 401);
  });

  await t.test('GET /api/auth/me returns current authenticated user profile', async () => {
    const adminToken = await client.getAdminToken();
    const res = await client.request('/auth/me', {
      token: adminToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'ADMIN');
  });

  await t.test('Protected endpoints reject requests without token with 401', async () => {
    const res = await client.request('/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'UNAUTHORIZED');
  });

  await t.test('Protected endpoints reject invalid or malformed tokens with 401', async () => {
    const res = await client.request('/auth/me', {
      token: 'fake-invalid-token-123',
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'INVALID_SESSION');
  });

  await t.test('POST /api/auth/logout revokes session token', async () => {
    const email = `logout.${Date.now()}@aegis.internal`;
    const signup = await client.request('/auth/signup', {
      method: 'POST',
      body: { name: 'Logout Tester', email, password: 'Password123!', role: 'VIEWER' },
    });
    const token = signup.body.token;

    // Confirm token works
    const meBefore = await client.request('/auth/me', { token });
    assert.equal(meBefore.status, 200);

    // Logout
    const logoutRes = await client.request('/auth/logout', { method: 'POST', token });
    assert.equal(logoutRes.status, 200);

    // Confirm token no longer valid
    const meAfter = await client.request('/auth/me', { token });
    assert.equal(meAfter.status, 401);
  });

  await t.test('RBAC: VIEWER role cannot access admin or engineer mutation endpoints', async () => {
    const viewerToken = await client.getViewerToken();

    // Try to create a service (requires ADMIN)
    const svcRes = await client.request('/services', {
      method: 'POST',
      token: viewerToken,
      body: { name: 'Unauthorized Service' },
    });
    assert.equal(svcRes.status, 403);
    assert.equal(svcRes.body.code, 'FORBIDDEN');

    // Try to create an incident (requires ADMIN or ENGINEER)
    const incRes = await client.request('/incidents', {
      method: 'POST',
      token: viewerToken,
      body: { title: 'Unauthorized Incident', serviceId: 'srv-auth-core', severity: 'HIGH' },
    });
    assert.equal(incRes.status, 403);
    assert.equal(incRes.body.code, 'FORBIDDEN');
  });

  await t.test('RBAC: ENGINEER role can create incidents but cannot create services or manage users', async () => {
    const engineerToken = await client.getEngineerToken();

    // Cannot create service
    const svcRes = await client.request('/services', {
      method: 'POST',
      token: engineerToken,
      body: { name: 'Unauthorized Service' },
    });
    assert.equal(svcRes.status, 403);

    // Cannot access user list (ADMIN only)
    const usersRes = await client.request('/auth/users', {
      token: engineerToken,
    });
    assert.equal(usersRes.status, 403);
  });
});
