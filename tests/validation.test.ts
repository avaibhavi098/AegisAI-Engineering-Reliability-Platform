import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeText,
  isValidEmail,
  sanitizeErrorMessage,
  validateSignup,
  validateLogin,
  validateServiceCreate,
  validateServiceUpdate,
  validateIncidentCreate,
  validateIncidentUpdate,
  VALID_SEVERITIES,
  VALID_INCIDENT_STATUSES,
  VALID_USER_ROLES,
} from '../server/validation.js';

test('Input Sanitization: sanitizeText', async (t) => {
  await t.test('strips null bytes and control characters while preserving clean text', () => {
    const raw = 'Payment \u0000Gateway\u0007 Service\r\n';
    const clean = sanitizeText(raw);
    assert.equal(clean, 'Payment Gateway Service');
  });

  await t.test('trims surrounding whitespace', () => {
    assert.equal(sanitizeText('   User Auth   '), 'User Auth');
  });

  await t.test('caps output at specified maximum length', () => {
    const longString = 'A'.repeat(500);
    assert.equal(sanitizeText(longString, 50).length, 50);
  });

  await t.test('handles non-string values safely', () => {
    assert.equal(sanitizeText(null), '');
    assert.equal(sanitizeText(undefined), '');
    assert.equal(sanitizeText(12345), '');
  });
});

test('Email Validation: isValidEmail', async (t) => {
  await t.test('accepts valid RFC email formats', () => {
    assert.equal(isValidEmail('admin@aegis.internal'), true);
    assert.equal(isValidEmail('engineer.john+oncall@domain.co'), true);
    assert.equal(isValidEmail('test_user.12@example.org'), true);
  });

  await t.test('rejects malformed email formats', () => {
    assert.equal(isValidEmail('plainaddress'), false);
    assert.equal(isValidEmail('@missingusername.com'), false);
    assert.equal(isValidEmail('username@.com'), false);
    assert.equal(isValidEmail('username@domain'), false);
    assert.equal(isValidEmail(''), false);
    assert.equal(isValidEmail(null), false);
  });
});

test('Error Message Sanitization: sanitizeErrorMessage', async (t) => {
  await t.test('scrubs potential Gemini API keys', () => {
    const errorWithKey = new Error('Call failed with AIzaSyD3x94L0kE892Nmp12V89xK198234123AB');
    const sanitized = sanitizeErrorMessage(errorWithKey);
    assert.ok(!sanitized.includes('AIzaSyD'));
    assert.ok(sanitized.includes('[REDACTED_KEY]'));
  });

  await t.test('scrubs bearer auth tokens', () => {
    const raw = 'Authentication rejected for Bearer eyJhbGciOiJIUzI1NiJ9.testToken';
    const sanitized = sanitizeErrorMessage(raw);
    assert.ok(!sanitized.includes('eyJhbGciOi'));
    assert.ok(sanitized.includes('Bearer [REDACTED_TOKEN]'));
  });

  await t.test('scrubs server absolute file system paths', () => {
    const raw = 'File read error at /var/app/server/secrets/credentials.json: not found';
    const sanitized = sanitizeErrorMessage(raw);
    assert.ok(!sanitized.includes('/var/app/server'));
    assert.ok(sanitized.includes('[INTERNAL_PATH]'));
  });
});

test('Signup Validation: validateSignup', async (t) => {
  await t.test('approves valid signup payload', () => {
    const res = validateSignup({
      name: 'Alice SRE',
      email: 'alice@aegis.internal',
      password: 'SecurePassword123!',
      role: 'ENGINEER',
    });
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  await t.test('rejects short names or invalid emails', () => {
    const res = validateSignup({
      name: 'A',
      email: 'invalid-email',
      password: '123',
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Name must be at least')));
    assert.ok(res.errors.some((e) => e.includes('valid email')));
    assert.ok(res.errors.some((e) => e.includes('Password must be at least')));
  });

  await t.test('rejects unrecognized role values', () => {
    const res = validateSignup({
      name: 'Bob Admin',
      email: 'bob@aegis.internal',
      password: 'SecurePassword123!',
      role: 'SUPERUSER_INVALID',
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Invalid role')));
  });
});

test('Login Validation: validateLogin', async (t) => {
  await t.test('approves non-empty email and password', () => {
    assert.equal(validateLogin({ email: 'user@aegis.internal', password: 'pass' }).valid, true);
  });

  await t.test('rejects missing or empty credentials', () => {
    assert.equal(validateLogin({ email: '', password: '123' }).valid, false);
    assert.equal(validateLogin({ email: 'user@aegis.internal' }).valid, false);
    assert.equal(validateLogin(null).valid, false);
  });
});

test('Service Validation: validateServiceCreate & validateServiceUpdate', async (t) => {
  await t.test('validates service creation with acceptable values', () => {
    const res = validateServiceCreate({
      name: 'User Authentication Gateway',
      tier: 'TIER-1',
      status: 'HEALTHY',
      latencyMs: 45,
      errorRate: 0.02,
      uptimePercent: 99.95,
    });
    assert.equal(res.valid, true);
  });

  await t.test('rejects invalid tier and out-of-range metrics', () => {
    const res = validateServiceCreate({
      name: 'S',
      tier: 'TIER-INVALID',
      status: 'UNKNOWN_STATUS',
      latencyMs: -10,
      errorRate: 5.5, // > 1
      uptimePercent: 150, // > 100
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('Service name')));
    assert.ok(res.errors.some((e) => e.includes('Invalid tier')));
    assert.ok(res.errors.some((e) => e.includes('Invalid status')));
    assert.ok(res.errors.some((e) => e.includes('latencyMs')));
    assert.ok(res.errors.some((e) => e.includes('errorRate')));
    assert.ok(res.errors.some((e) => e.includes('uptimePercent')));
  });
});

test('Incident Validation: validateIncidentCreate & validateIncidentUpdate', async (t) => {
  await t.test('validates incident creation with valid enum and required fields', () => {
    const res = validateIncidentCreate({
      title: 'Database connection pool saturation',
      serviceId: 'srv-db-01',
      severity: 'CRITICAL',
      status: 'OPEN',
    });
    assert.equal(res.valid, true);
  });

  await t.test('rejects missing fields and invalid severity enum', () => {
    const res = validateIncidentCreate({
      title: 'Db',
      severity: 'ULTRA_HIGH', // invalid
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('at least 3 characters')));
    assert.ok(res.errors.some((e) => e.includes('serviceId is required')));
    assert.ok(res.errors.some((e) => e.includes('Invalid or missing severity')));
  });
});
