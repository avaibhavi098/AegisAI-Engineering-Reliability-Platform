export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';
export type ServiceTier = 'TIER-1' | 'TIER-2' | 'TIER-3';

export type UserRole = 'ADMIN' | 'ENGINEER' | 'VIEWER';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title?: string;
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  user: UserProfile;
  token: string;
}

export interface Service {
  id: string;
  name: string;
  key: string;
  tier: 'TIER-1' | 'TIER-2' | 'TIER-3';
  description: string;
  status: ServiceStatus;
  latencyMs: number;
  errorRate: number; // percentage (e.g. 0.04)
  uptimePercent: number; // percentage (e.g. 99.98)
  requestRateRps: number;
  dependencies: string[];
  ownerTeam: string;
  lastCheckedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Engineer {
  id: string;
  name: string;
  email: string;
  role: 'SRE Lead' | 'Staff Reliability Engineer' | 'Senior DevOps' | 'Platform Engineer' | 'Backend Tech Lead';
  avatar: string;
  status: 'ON_CALL' | 'AVAILABLE' | 'OFF_SHIFT';
  currentIncidentsCount: number;
  shift_end?: string;
}

export interface AIAnalysisResult {
  id?: string;
  incidentId?: string;
  // Required structured fields from Gemini AI
  incidentSummary: string;
  probableRootCause: string;
  possibleAlternativeCauses: string[];
  recommendedTroubleshootingSteps: string[];
  riskFactors: string[];
  severityAssessment: string;
  confidenceScore: number;
  preventionSuggestions: string[];

  // Runbook & Operational Telemetry
  runbookCommands?: string[];
  analyzedAt: string;
  modelUsed: string;
  isAiGenerated?: boolean;

  // Backward compatibility aliases
  confidence?: number;
  summary?: string;
  generatedAt?: string;
  possibleCauses?: string[];
  recommendedActions?: string[];
  rootCauseSummary?: string;
  blastRadius?: string;
  probableCauseChain?: string[];
  impactedServices?: string[];
  suggestedFix?: string;
  mitigationSteps?: string[];
  preventionRecommendations?: string[];
}

export interface Incident {
  id: string; // e.g. INC-4029
  title: string;
  description: string;
  serviceId: string;
  serviceName: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  assignedEngineer: Engineer;
  errorLogs: string;
  aiAnalysis?: AIAnalysisResult;
  recommendedActions?: string[];
  resolutionNotes: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  serviceId: string;
  serviceName: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  traceId: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

export interface ReliabilityMetrics {
  totalServices: number;
  healthyServices: number;
  warningServices: number;
  downServices: number;
  activeIncidents: number;
  criticalIncidents: number;
  averageResolutionMinutes: number | null;
  meanTimeToDetectMinutes: number | null;
  systemAvailability: number | null;
  errorBudgetBurnRate: number | null; // percentage
}

export interface AdminSettings {
  slackAlerts: boolean;
  slackWebhookUrl: string;
  pagerDutyAlerts: boolean;
  pagerDutyRoutingKey: string;
  emailAlerts: boolean;
  alertEmail: string;
  geminiModel: string;
  autoAiAnalysisOnCritical: boolean;
  latencyWarningThresholdMs: number;
  errorRateWarningThresholdPct: number;
  sloTargetAvailability: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: string;
  createdAt: string;
}

export interface IncidentHistoryEntry {
  id: string;
  incidentId: string;
  actionType: 'CREATED' | 'STATUS_CHANGED' | 'SEVERITY_CHANGED' | 'ASSIGNED' | 'AI_ANALYZED' | 'RESOLVED' | 'UPDATED';
  oldValue?: string;
  newValue?: string;
  description: string;
  performedById: string;
  performedByName: string;
  createdAt: string;
}

export interface ServiceMetricEntry {
  id: string;
  serviceId: string;
  timestamp: string;
  uptime: number;
  latencyMs: number;
  errorRatePct: number;
  requestVolume: number;
  createdAt: string;
}

// --- Real System Health & Monitoring Telemetry Types ---
export type ComponentHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export interface ApiCapturedError {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  durationMs: number;
}

export interface ApiPerformanceMetrics {
  requestCount: number;
  errorCount: number;
  errorRatePct: number;
  averageResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  p95ResponseTimeMs: number;
  recentErrors: ApiCapturedError[];
  uptimeSeconds: number;
}

export interface SystemHealthReport {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  systemStatus: ComponentHealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    api: {
      status: ComponentHealthStatus;
      uptimeSeconds: number;
      memoryUsageMb: number;
      requestCount: number;
      errorCount: number;
      errorRatePct: number;
      avgResponseTimeMs: number;
      checkedAt: string;
    };
    database: {
      status: ComponentHealthStatus;
      latencyMs: number;
      connected: boolean;
      type: string;
      totalTables: number;
      checkedAt: string;
      details?: string;
    };
    geminiAi: {
      status: ComponentHealthStatus;
      configured: boolean;
      model: string;
      latencyMs?: number;
      checkedAt: string;
      message: string;
    };
  };
}

export interface ServiceHealthDetail {
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
}

export interface IncidentMonitoringStats {
  openIncidents: number;
  investigatingIncidents: number;
  criticalIncidents: number;
  resolvedIncidents: number;
  totalIncidents: number;
  recentIncidents: Incident[];
  averageResolutionMinutes: number | null;
}

export interface MonitoringOverview {
  systemHealth: SystemHealthReport;
  apiPerformance: ApiPerformanceMetrics;
  servicesHealth: ServiceHealthDetail[];
  incidentMonitoring: IncidentMonitoringStats;
}


