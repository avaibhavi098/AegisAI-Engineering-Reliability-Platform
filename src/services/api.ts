import {
  Service,
  Incident,
  Engineer,
  LogEntry,
  AdminSettings,
  ReliabilityMetrics,
  AIAnalysisResult,
  Severity,
  IncidentStatus,
  UserProfile,
  AuthResponse,
  UserRole,
  MonitoringOverview,
  SystemHealthReport,
  ApiPerformanceMetrics,
  ApiCapturedError,
} from '../types/index.js';

class ApiService {
  private token: string | null = null;
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    // Attempt restoring token from localStorage on initialization
    try {
      if (typeof window !== 'undefined') {
        this.token = localStorage.getItem('aegis_auth_token');
      }
    } catch {
      this.token = null;
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    try {
      if (typeof window !== 'undefined') {
        if (token) {
          localStorage.setItem('aegis_auth_token', token);
        } else {
          localStorage.removeItem('aegis_auth_token');
        }
      }
    } catch {
      // ignore
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const isGet = !options?.method || options.method.toUpperCase() === 'GET';

    // Deduplicate identical in-flight GET requests
    if (isGet && this.inFlightRequests.has(endpoint)) {
      return this.inFlightRequests.get(endpoint)! as Promise<T>;
    }

    const execRequest = async (): Promise<T> => {
      const maxRetries = isGet ? 1 : 0;
      let attempt = 0;

      while (attempt <= maxRetries) {
        attempt++;
        const controller = new AbortController();
        const timeoutMs = options?.method === 'POST' && endpoint.includes('/ai/') ? 60000 : 25000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options?.headers as Record<string, string>),
          };

          if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
          }

          const res = await fetch(`/api${endpoint}`, {
            ...options,
            headers,
            signal: options?.signal || controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorBody = await res.json().catch(() => ({ error: res.statusText }));
            const error: any = new Error(errorBody.error || `HTTP error ${res.status}`);
            error.status = res.status;
            error.code = errorBody.code;
            error.userRole = errorBody.userRole;
            error.requiredRoles = errorBody.requiredRoles;

            if (typeof window !== 'undefined' && (res.status === 401 || res.status === 403)) {
              window.dispatchEvent(
                new CustomEvent('aegis:auth_error', {
                  detail: {
                    status: res.status,
                    error: errorBody.error || 'Access Denied',
                    requiredRoles: errorBody.requiredRoles,
                    userRole: errorBody.userRole,
                  },
                })
              );
            }

            // Retry safe idempotent GET on 503 or transient failure
            if (isGet && attempt <= maxRetries && (res.status === 503 || res.status === 504)) {
              await new Promise((r) => setTimeout(r, 500));
              continue;
            }

            throw error;
          }

          return (await res.json()) as T;
        } catch (err: any) {
          clearTimeout(timeoutId);
          const isAbort = err?.name === 'AbortError';
          if (isAbort) {
            throw new Error(`Request timed out for endpoint ${endpoint}`);
          }
          if (isGet && attempt <= maxRetries) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          throw err;
        }
      }
      throw new Error(`Failed to complete request for ${endpoint}`);
    };

    if (isGet) {
      const promise = execRequest().finally(() => {
        this.inFlightRequests.delete(endpoint);
      });
      this.inFlightRequests.set(endpoint, promise);
      return promise;
    }

    return execRequest();
  }

  // Auth
  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async signup(payload: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    title?: string;
  }): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(data.token);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // continue clearing token regardless
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser(): Promise<UserProfile> {
    const data = await this.request<{ user: UserProfile }>('/auth/me');
    return data.user;
  }

  async getUsers(): Promise<UserProfile[]> {
    const data = await this.request<{ users: UserProfile[] }>('/auth/users');
    return data.users;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<UserProfile> {
    const data = await this.request<{ user: UserProfile }>(`/auth/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    return data.user;
  }

  // Services
  async getServices(): Promise<Service[]> {
    const data = await this.request<{ services: Service[] }>('/services');
    return data.services;
  }

  async createService(payload: Partial<Service>): Promise<Service> {
    const data = await this.request<{ service: Service }>('/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.service;
  }

  async updateService(id: string, updates: Partial<Service>): Promise<Service> {
    const data = await this.request<{ service: Service }>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data.service;
  }

  // Incidents
  async getIncidents(): Promise<Incident[]> {
    const data = await this.request<{ incidents: Incident[] }>('/incidents');
    return data.incidents;
  }

  async getIncident(id: string): Promise<Incident> {
    const data = await this.request<{ incident: Incident }>(`/incidents/${id}`);
    return data.incident;
  }

  async createIncident(payload: {
    title: string;
    description: string;
    serviceId: string;
    severity: Severity;
    errorLogs?: string;
    assignedEngineerId?: string;
    triggerAI?: boolean;
  }): Promise<Incident> {
    const data = await this.request<{ incident: Incident }>('/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.incident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident> {
    const data = await this.request<{ incident: Incident }>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data.incident;
  }

  async assignEngineer(incidentId: string, engineerId: string): Promise<Incident> {
    const data = await this.request<{ incident: Incident }>(`/incidents/${incidentId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ engineerId }),
    });
    return data.incident;
  }

  async resolveIncident(incidentId: string, resolutionNotes: string): Promise<Incident> {
    const data = await this.request<{ incident: Incident }>(`/incidents/${incidentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionNotes }),
    });
    return data.incident;
  }

  // AI
  async analyzeIncident(payload: {
    incidentId?: string;
    title: string;
    description?: string;
    serviceName?: string;
    serviceId?: string;
    severity?: Severity;
    status?: IncidentStatus;
    errorLogs?: string;
    performanceMetrics?: Record<string, unknown>;
    recentIncidents?: Array<Record<string, unknown>>;
  }): Promise<AIAnalysisResult> {
    const data = await this.request<{ analysis: AIAnalysisResult; incident?: Incident }>('/ai/analyze-incident', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.analysis;
  }

  async analyzeLogs(payload: {
    serviceName?: string;
    serviceId?: string;
    rawLogs?: string;
    logs?: string[];
  }): Promise<AIAnalysisResult> {
    const data = await this.request<{
      analysis: AIAnalysisResult;
    }>('/ai/analyze-logs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.analysis;
  }

  // Logs
  async getLogs(params?: { serviceId?: string; level?: string; search?: string }): Promise<LogEntry[]> {
    const query = new URLSearchParams();
    if (params?.serviceId) query.append('serviceId', params.serviceId);
    if (params?.level) query.append('level', params.level);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    const data = await this.request<{ logs: LogEntry[] }>(`/logs${qs ? `?${qs}` : ''}`);
    return data.logs;
  }

  async simulateLog(payload: {
    serviceId: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
    message: string;
    stackTrace?: string;
  }): Promise<LogEntry> {
    const data = await this.request<{ log: LogEntry }>('/logs/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.log;
  }

  // Engineers
  async getEngineers(): Promise<Engineer[]> {
    const data = await this.request<{ engineers: Engineer[] }>('/engineers');
    return data.engineers;
  }

  async updateEngineer(id: string, updates: Partial<Engineer>): Promise<Engineer> {
    const data = await this.request<{ engineer: Engineer }>(`/engineers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data.engineer;
  }

  // Metrics
  async getMetrics(): Promise<ReliabilityMetrics> {
    const data = await this.request<{ metrics: ReliabilityMetrics }>('/metrics');
    return data.metrics;
  }

  // Audit Logs & Incident History
  async getAuditLogs(limit = 50): Promise<import('../types/index.js').AuditLogEntry[]> {
    const data = await this.request<{ auditLogs: import('../types/index.js').AuditLogEntry[] }>(`/audit-logs?limit=${limit}`);
    return data.auditLogs;
  }

  async getIncidentHistory(incidentId: string): Promise<import('../types/index.js').IncidentHistoryEntry[]> {
    const data = await this.request<{ history: import('../types/index.js').IncidentHistoryEntry[] }>(`/incidents/${incidentId}/history`);
    return data.history;
  }

  async getServiceMetrics(serviceId: string): Promise<import('../types/index.js').ServiceMetricEntry[]> {
    const data = await this.request<{ metrics: import('../types/index.js').ServiceMetricEntry[] }>(`/services/${serviceId}/metrics`);
    return data.metrics;
  }

  // Settings
  async getSettings(): Promise<AdminSettings> {
    const data = await this.request<{ settings: AdminSettings }>('/settings');
    return data.settings;
  }

  async updateSettings(settings: Partial<AdminSettings>): Promise<AdminSettings> {
    const data = await this.request<{ settings: AdminSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return data.settings;
  }

  // Seed Reset
  async resetSeed(): Promise<void> {
    await this.request('/reset-seed', { method: 'POST' });
  }

  // System Health & Monitoring
  async getHealth(): Promise<SystemHealthReport> {
    return this.request<SystemHealthReport>('/health');
  }

  async getMonitoringOverview(): Promise<MonitoringOverview> {
    return this.request<MonitoringOverview>('/monitoring/overview');
  }

  async getApiPerformance(): Promise<ApiPerformanceMetrics> {
    const data = await this.request<{ apiPerformance: ApiPerformanceMetrics }>('/monitoring/performance');
    return data.apiPerformance;
  }

  async getMonitoringErrors(limit = 50): Promise<{ errors: any[]; recentApiErrors: ApiCapturedError[] }> {
    return this.request<{ errors: any[]; recentApiErrors: ApiCapturedError[] }>(`/monitoring/errors?limit=${limit}`);
  }

  async clearMonitoringErrors(): Promise<void> {
    await this.request('/monitoring/errors/clear', { method: 'POST' });
  }

  async triggerHealthProbe(): Promise<{ geminiAi: any; database: any; systemReport: SystemHealthReport }> {
    return this.request<{ geminiAi: any; database: any; systemReport: SystemHealthReport }>('/monitoring/probe', {
      method: 'POST',
    });
  }

  async triggerServiceProbe(serviceId: string): Promise<Service> {
    const data = await this.request<{ service: Service }>(`/monitoring/services/${serviceId}/probe`, {
      method: 'POST',
    });
    return data.service;
  }
}

export const api = new ApiService();
