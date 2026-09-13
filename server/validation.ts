import type { UserRole, Severity, IncidentStatus, ServiceTier, ServiceStatus } from '../src/types/index.js';

export const VALID_USER_ROLES: readonly UserRole[] = ['ADMIN', 'ENGINEER', 'VIEWER'] as const;
export const VALID_SEVERITIES: readonly Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const VALID_INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'CLOSED',
] as const;
export const VALID_SERVICE_STATUSES: readonly ServiceStatus[] = ['HEALTHY', 'DEGRADED', 'DOWN'] as const;
export const VALID_SERVICE_TIERS: readonly ServiceTier[] = ['TIER-1', 'TIER-2', 'TIER-3'] as const;

/**
 * Sanitize untrusted text input by stripping control characters and null bytes,
 * trimming leading/trailing whitespace, and capping length.
 */
export function sanitizeText(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return '';
  return value
    // Remove control characters except standard whitespace (newlines, tabs)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate standard email format.
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // RFC 5322 compatible regex check
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    trimmed
  );
}

/**
 * Sanitize error message to ensure no secrets, passwords, or system file paths leak.
 */
export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred';
  let message = err instanceof Error ? err.message : String(err);

  // Strip possible API keys or tokens
  message = message.replace(/(AIza[0-9A-Za-z-_]{20,60})/g, '[REDACTED_KEY]');
  message = message.replace(/(Bearer\s+[A-Za-z0-9-_.]+)/gi, 'Bearer [REDACTED_TOKEN]');
  message = message.replace(/(password|secret|salt|key)\s*[:=]\s*['"][^'"]+['"]/gi, '$1: "[REDACTED]"');

  // Strip absolute server paths
  message = message.replace(/\/[\w.-]+(\/[\w.-]+)+/g, '[INTERNAL_PATH]');

  return message;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSignup(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }

  const name = sanitizeText(body.name, 100);
  if (!name || name.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (!isValidEmail(body.email)) {
    errors.push('A valid email address is required');
  }

  if (typeof body.password !== 'string' || body.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (body.role && !VALID_USER_ROLES.includes(body.role)) {
    errors.push(`Invalid role "${body.role}". Allowed roles: ${VALID_USER_ROLES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateLogin(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('Email is required');
  }
  if (!body.password || typeof body.password !== 'string') {
    errors.push('Password is required');
  }

  return { valid: errors.length === 0, errors };
}

export function validateServiceCreate(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }

  const name = sanitizeText(body.name, 100);
  if (!name || name.length < 2) {
    errors.push('Service name must be at least 2 characters long');
  }

  if (body.tier && !VALID_SERVICE_TIERS.includes(body.tier)) {
    errors.push(`Invalid tier "${body.tier}". Allowed tiers: ${VALID_SERVICE_TIERS.join(', ')}`);
  }

  if (body.status && !VALID_SERVICE_STATUSES.includes(body.status)) {
    errors.push(`Invalid status "${body.status}". Allowed statuses: ${VALID_SERVICE_STATUSES.join(', ')}`);
  }

  if (body.latencyMs !== undefined) {
    const lat = Number(body.latencyMs);
    if (isNaN(lat) || lat < 0 || lat > 60000) {
      errors.push('latencyMs must be a positive number up to 60000');
    }
  }

  if (body.errorRate !== undefined) {
    const errRate = Number(body.errorRate);
    if (isNaN(errRate) || errRate < 0 || errRate > 1) {
      errors.push('errorRate must be a decimal number between 0 and 1');
    }
  }

  if (body.uptimePercent !== undefined) {
    const uptime = Number(body.uptimePercent);
    if (isNaN(uptime) || uptime < 0 || uptime > 100) {
      errors.push('uptimePercent must be a number between 0 and 100');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateServiceUpdate(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }

  if (body.name !== undefined) {
    const name = sanitizeText(body.name, 100);
    if (!name || name.length < 2) {
      errors.push('Service name must be at least 2 characters long');
    }
  }

  if (body.tier !== undefined && !VALID_SERVICE_TIERS.includes(body.tier)) {
    errors.push(`Invalid tier "${body.tier}". Allowed tiers: ${VALID_SERVICE_TIERS.join(', ')}`);
  }

  if (body.status !== undefined && !VALID_SERVICE_STATUSES.includes(body.status)) {
    errors.push(`Invalid status "${body.status}". Allowed statuses: ${VALID_SERVICE_STATUSES.join(', ')}`);
  }

  if (body.latencyMs !== undefined) {
    const lat = Number(body.latencyMs);
    if (isNaN(lat) || lat < 0 || lat > 60000) {
      errors.push('latencyMs must be a positive number up to 60000');
    }
  }

  if (body.errorRate !== undefined) {
    const errRate = Number(body.errorRate);
    if (isNaN(errRate) || errRate < 0 || errRate > 1) {
      errors.push('errorRate must be a decimal number between 0 and 1');
    }
  }

  if (body.uptimePercent !== undefined) {
    const uptime = Number(body.uptimePercent);
    if (isNaN(uptime) || uptime < 0 || uptime > 100) {
      errors.push('uptimePercent must be a number between 0 and 100');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateIncidentCreate(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }

  const title = sanitizeText(body.title, 200);
  if (!title || title.length < 3) {
    errors.push('Incident title is required and must be at least 3 characters long');
  }

  if (!body.serviceId || typeof body.serviceId !== 'string' || !body.serviceId.trim()) {
    errors.push('serviceId is required');
  }

  if (!body.severity || !VALID_SEVERITIES.includes(body.severity)) {
    errors.push(`Invalid or missing severity "${body.severity}". Allowed severities: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (body.status && !VALID_INCIDENT_STATUSES.includes(body.status)) {
    errors.push(`Invalid status "${body.status}". Allowed statuses: ${VALID_INCIDENT_STATUSES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateIncidentUpdate(body: any): ValidationResult {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object'] };
  }

  if (body.title !== undefined) {
    const title = sanitizeText(body.title, 200);
    if (!title || title.length < 3) {
      errors.push('Incident title must be at least 3 characters long');
    }
  }

  if (body.severity !== undefined && !VALID_SEVERITIES.includes(body.severity)) {
    errors.push(`Invalid severity "${body.severity}". Allowed severities: ${VALID_SEVERITIES.join(', ')}`);
  }

  if (body.status !== undefined && !VALID_INCIDENT_STATUSES.includes(body.status)) {
    errors.push(`Invalid status "${body.status}". Allowed statuses: ${VALID_INCIDENT_STATUSES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}
