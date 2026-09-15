import fs from 'fs';
import dotenv from 'dotenv';
import type {
  Service,
  Incident,
  Engineer,
  LogEntry,
  AdminSettings,
  ReliabilityMetrics,
  AIAnalysisResult,
  UserRole,
  UserProfile,
  AuditLogEntry,
  IncidentHistoryEntry,
  ServiceMetricEntry,
  IncidentStatus,
  Severity,
  ServiceStatus,
} from '../src/types/index.js';
import { PostgresDatabaseManager, StoredUser, UserSession, isValidPostgresUrl, normalizePostgresUrl } from './db-postgres.js';
import { SqliteDatabaseManager } from './db-sqlite.js';

export type { StoredUser, UserSession };
export { PostgresDatabaseManager, SqliteDatabaseManager, isValidPostgresUrl, normalizePostgresUrl };

export interface DatabaseInterface {
  getEngineName(): string;
  close(): Promise<void> | void;
  getUserByEmail(email: string): Promise<StoredUser | null> | StoredUser | null;
  getUserById(id: string): Promise<StoredUser | null> | StoredUser | null;
  getAllUsers(): Promise<UserProfile[]> | UserProfile[];
  createUser(userData: {
    email: string;
    name: string;
    role: UserRole;
    title?: string;
    avatar?: string;
    passwordHash: string;
    salt: string;
  }): Promise<StoredUser> | StoredUser;
  updateUserRole(userId: string, newRole: UserRole): Promise<UserProfile | null> | UserProfile | null;
  recordUserLogin(userId: string): Promise<void> | void;
  updateUserPassword(userId: string, passwordHash: string, salt: string): Promise<void> | void;
  createSession(userId: string, token: string, expiresInMs?: number): Promise<UserSession> | UserSession;
  getSession(token: string): Promise<UserSession | null> | UserSession | null;
  deleteSession(token: string): Promise<void> | void;
  cleanExpiredSessions(): Promise<number> | number;
  getAllServices(): Promise<Service[]> | Service[];
  getServicesPaginated(options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tier?: string;
  }): Promise<{ services: Service[]; total: number; page: number; limit: number; totalPages: number }> | { services: Service[]; total: number; page: number; limit: number; totalPages: number };
  getServiceById(id: string): Promise<Service | null> | Service | null;
  getServiceByKey(key: string): Promise<Service | null> | Service | null;
  createService(serviceData: {
    name: string;
    key?: string;
    tier: 'TIER-1' | 'TIER-2' | 'TIER-3';
    description: string;
    ownerTeam: string;
    dependencies?: string[];
    status?: ServiceStatus;
    latencyMs?: number;
    errorRate?: number;
    uptimePercent?: number;
    requestRateRps?: number;
  }): Promise<Service> | Service;
  updateService(id: string, updates: Partial<Service>): Promise<Service | null> | Service | null;
  deleteService(id: string): Promise<boolean> | boolean;
  getAllIncidents(): Promise<Incident[]> | Incident[];
  getIncidentsPaginated(options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    severity?: string;
    serviceId?: string;
  }): Promise<{ incidents: Incident[]; total: number; page: number; limit: number; totalPages: number }> | { incidents: Incident[]; total: number; page: number; limit: number; totalPages: number };
  getIncidentById(id: string): Promise<Incident | null> | Incident | null;
  createIncident(data: {
    title: string;
    description: string;
    serviceId: string;
    serviceName?: string;
    severity: Severity;
    status?: IncidentStatus;
    assignedEngineerId?: string;
    errorLogs?: string;
    createdByUserId?: string;
    createdByUserName?: string;
  }): Promise<Incident> | Incident;
  updateIncident(
    id: string,
    updates: Partial<Incident>,
    performedBy?: { id: string; name: string }
  ): Promise<Incident | null> | Incident | null;
  resolveIncident(
    id: string,
    resolutionNotes: string,
    performedBy?: { id: string; name: string }
  ): Promise<Incident | null> | Incident | null;
  deleteIncident(id: string): Promise<boolean> | boolean;
  saveAiAnalysis(analysisData: {
    incidentId: string;
    modelUsed: string;
    summary: string;
    probableRootCause: string;
    possibleCauses: string[];
    recommendedActions: string[];
    severityAssessment: string;
    confidence: number;
    riskFactors: string[];
    preventionSuggestions: string[];
    runbookCommands?: string[];
    analyzedByUserId?: string;
    analyzedByUserName?: string;
  }): Promise<AIAnalysisResult> | AIAnalysisResult;
  getLatestAiAnalysisForIncident(incidentId: string): Promise<AIAnalysisResult | null> | AIAnalysisResult | null;
  getAllAiAnalysesForIncident(incidentId: string): Promise<AIAnalysisResult[]> | AIAnalysisResult[];
  getAnalysesForIncident(incidentId: string): Promise<AIAnalysisResult[]> | AIAnalysisResult[];
  recordIncidentHistory(entry: {
    incidentId: string;
    actionType: 'CREATED' | 'STATUS_CHANGED' | 'SEVERITY_CHANGED' | 'ASSIGNED' | 'AI_ANALYZED' | 'RESOLVED' | 'UPDATED';
    oldValue?: string | null;
    newValue?: string | null;
    description: string;
    performedById: string;
    performedByName: string;
  }): Promise<IncidentHistoryEntry> | IncidentHistoryEntry;
  getHistoryForIncident(incidentId: string): Promise<IncidentHistoryEntry[]> | IncidentHistoryEntry[];
  getHistoryForIncidentPaginated(
    incidentId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ history: IncidentHistoryEntry[]; total: number; page: number; limit: number; totalPages: number }> | { history: IncidentHistoryEntry[]; total: number; page: number; limit: number; totalPages: number };
  recordAuditLog(entry: {
    userId: string;
    userName: string;
    userRole: UserRole | string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details: string;
  }): Promise<AuditLogEntry> | AuditLogEntry;
  getAuditLogs(limit?: number): Promise<AuditLogEntry[]> | AuditLogEntry[];
  getAuditLogsPaginated(options?: {
    page?: number;
    limit?: number;
    search?: string;
    action?: string;
    userId?: string;
  }): Promise<{ auditLogs: AuditLogEntry[]; total: number; page: number; limit: number; totalPages: number }> | { auditLogs: AuditLogEntry[]; total: number; page: number; limit: number; totalPages: number };
  recordServiceMetric(metric: {
    serviceId: string;
    uptime: number;
    latencyMs: number;
    errorRatePct: number;
    requestVolume: number;
  }): Promise<ServiceMetricEntry> | ServiceMetricEntry;
  getServiceMetrics(serviceId: string, limit?: number): Promise<ServiceMetricEntry[]> | ServiceMetricEntry[];
  getReliabilityMetrics(): Promise<ReliabilityMetrics> | ReliabilityMetrics;
  pingDatabase(): Promise<{ connected: boolean; totalTables: number }> | { connected: boolean; totalTables: number };
  recordSystemError(entry: {
    method: string;
    path: string;
    statusCode: number;
    errorMessage: string;
    errorCode?: string;
    userId?: string;
  }): Promise<{ id: string; timestamp: string }> | { id: string; timestamp: string };
  getSystemErrors(limit?: number): Promise<Array<{
    id: string;
    timestamp: string;
    method: string;
    path: string;
    statusCode: number;
    errorMessage: string;
    errorCode?: string;
    userId?: string;
  }>> | Array<{
    id: string;
    timestamp: string;
    method: string;
    path: string;
    statusCode: number;
    errorMessage: string;
    errorCode?: string;
    userId?: string;
  }>;
  clearSystemErrors(): Promise<void> | void;
  getIncidentMonitoringStats(): Promise<{
    openIncidents: number;
    investigatingIncidents: number;
    criticalIncidents: number;
    resolvedIncidents: number;
    totalIncidents: number;
    recentIncidents: Incident[];
    averageResolutionMinutes: number | null;
  }> | {
    openIncidents: number;
    investigatingIncidents: number;
    criticalIncidents: number;
    resolvedIncidents: number;
    totalIncidents: number;
    recentIncidents: Incident[];
    averageResolutionMinutes: number | null;
  };
  getServiceHealthDetails(): Promise<Array<{
    id: string;
    name: string;
    key: string;
    tier: string;
    status: ServiceStatus;
    lastHealthCheck: string;
    responseTimeMs: number | null;
    uptimePercent: number;
    incidentCount: number;
    activeIncidentCount: number;
    recentErrors: Array<{ timestamp: string; message: string; level: string }>;
  }>> | Array<{
    id: string;
    name: string;
    key: string;
    tier: string;
    status: ServiceStatus;
    lastHealthCheck: string;
    responseTimeMs: number | null;
    uptimePercent: number;
    incidentCount: number;
    activeIncidentCount: number;
    recentErrors: Array<{ timestamp: string; message: string; level: string }>;
  }>;
  probeServiceHealth(serviceId: string): Promise<Service | null> | Service | null;
  getAllEngineers(): Promise<Engineer[]> | Engineer[];
  getEngineerById(id: string): Promise<Engineer | null> | Engineer | null;
  updateEngineer(id: string, updates: Partial<Engineer>): Promise<Engineer | null> | Engineer | null;
  getLogs(filter?: { serviceId?: string; level?: string; search?: string }): Promise<LogEntry[]> | LogEntry[];
  addLog(log: {
    serviceId: string;
    serviceName: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
    message: string;
    traceId: string;
    stackTrace?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LogEntry> | LogEntry;
  getSettings(): Promise<AdminSettings> | AdminSettings;
  updateSettings(newSettings: Partial<AdminSettings>): Promise<AdminSettings> | AdminSettings;
  ensureInitialData?(forceReset?: boolean): Promise<void> | void;
  init?(): Promise<void>;
}

let activeDatabaseInstance: DatabaseInterface | null = null;

export function resolveEffectiveDatabaseUrl(): string | undefined {
  if (isValidPostgresUrl(process.env.DATABASE_URL)) {
    return normalizePostgresUrl(process.env.DATABASE_URL) || undefined;
  }
  try {
    if (fs.existsSync('.env')) {
      const parsed = dotenv.parse(fs.readFileSync('.env', 'utf8'));
      if (isValidPostgresUrl(parsed.DATABASE_URL)) {
        const cleaned = normalizePostgresUrl(parsed.DATABASE_URL) || parsed.DATABASE_URL;
        process.env.DATABASE_URL = cleaned;
        return cleaned;
      }
    }
  } catch {
    // fallback to undefined
  }
  return undefined;
}

export function getDatabase(): DatabaseInterface {
  if (activeDatabaseInstance) return activeDatabaseInstance;

  const isProduction = process.env.NODE_ENV === 'production';
  const effectiveUrl = resolveEffectiveDatabaseUrl();
  const hasValidPostgresUrl = !!effectiveUrl;

  if (hasValidPostgresUrl) {
    try {
      console.log('[Database] Initializing PostgreSQL engine (pg pool)...');
      const pgManager = new PostgresDatabaseManager({ connectionString: effectiveUrl });
      pgManager.init().catch((err) => {
        console.error('[Database] PostgreSQL startup initialization error:', err.message);
      });
      activeDatabaseInstance = pgManager;
      return activeDatabaseInstance;
    } catch (err) {
      console.error('[Database] Failed to instantiate PostgreSQL manager:', err instanceof Error ? err.message : err);
      if (isProduction) {
        throw new Error(
          `[Database] Fatal: PostgreSQL initialization failed in production: ${err instanceof Error ? err.message : String(err)}. SQLite fallback is restricted to development/non-production.`
        );
      }
      console.log('[Database] Falling back to SQLite engine (node:sqlite) for development...');
      activeDatabaseInstance = new SqliteDatabaseManager();
      return activeDatabaseInstance;
    }
  }

  if (isProduction) {
    throw new Error(
      '[Database] Fatal: Valid DATABASE_URL (postgres:// or postgresql://) is strictly required in production mode (NODE_ENV=production). SQLite fallback is restricted to development/non-production environments.'
    );
  }

  console.log('[Database] Initializing SQLite engine for development (node:sqlite)...');
  activeDatabaseInstance = new SqliteDatabaseManager();
  return activeDatabaseInstance;
}

export function setDatabase(instance: DatabaseInterface): void {
  activeDatabaseInstance = instance;
}

// Global proxy export so all existing callers `db.method(...)` work transparently
export const db = new Proxy({} as DatabaseInterface, {
  get(_target, prop) {
    const instance = getDatabase();
    const val = (instance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
});
