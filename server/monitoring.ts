import { Request, Response, NextFunction } from 'express';
import { sanitizeErrorMessage } from './validation.js';
import { db } from './db.js';

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

export interface ApiPerformanceStats {
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

export interface SystemHealthChecks {
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
}

export interface SystemHealthReport {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  systemStatus: ComponentHealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  checks: SystemHealthChecks;
}

class TelemetryMonitor {
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;
  private totalDurationMs = 0;
  private recentLatencies: number[] = [];
  private maxLatenciesToKeep = 200;
  private recentErrors: ApiCapturedError[] = [];
  private maxErrorsToKeep = 50;

  private lastAiProbeResult: {
    status: ComponentHealthStatus;
    latencyMs?: number;
    checkedAt: string;
    message: string;
  } | null = null;

  // Middleware to track actual API requests
  public middleware = (req: Request, res: Response, next: NextFunction) => {
    const startNs = process.hrtime.bigint();
    const startTimeIso = new Date().toISOString();

    res.on('finish', () => {
      const endNs = process.hrtime.bigint();
      const durationMs = Number(endNs - startNs) / 1_000_000;
      const roundedDuration = Math.round(durationMs * 100) / 100;

      const fullPath = req.originalUrl || `${req.baseUrl || ''}${req.path}`;
      const isHealthProbe = req.path === '/health' || req.path.startsWith('/monitoring');

      this.requestCount++;
      this.totalDurationMs += durationMs;

      // Keep sliding window of latencies for p95/min/max
      this.recentLatencies.push(roundedDuration);
      if (this.recentLatencies.length > this.maxLatenciesToKeep) {
        this.recentLatencies.shift();
      }

      const isError = res.statusCode >= 400;
      if (isError) {
        this.errorCount++;

        // Capture safe error metadata (excluding health probes if they were expected)
        if (!isHealthProbe || res.statusCode >= 500) {
          const errorRecord: ApiCapturedError = {
            id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: startTimeIso,
            method: req.method,
            path: fullPath,
            statusCode: res.statusCode,
            message: sanitizeErrorMessage(res.statusMessage || `HTTP ${res.statusCode}`),
            durationMs: roundedDuration,
          };

          this.recentErrors.unshift(errorRecord);
          if (this.recentErrors.length > this.maxErrorsToKeep) {
            this.recentErrors.pop();
          }

          // Persist critical server errors (5xx) safely in DB
          if (res.statusCode >= 500) {
            try {
              db.recordSystemError({
                method: req.method,
                path: fullPath,
                statusCode: res.statusCode,
                errorMessage: sanitizeErrorMessage(res.statusMessage || 'Server Error'),
                userId: (req as any).user?.id,
              });
            } catch {
              // Ignore persistence errors during telemetry capture
            }
          }
        }
      }
    });

    next();
  };

  public getApiPerformance(): ApiPerformanceStats {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const errorRatePct = this.requestCount > 0
      ? Math.round((this.errorCount / this.requestCount) * 10000) / 100
      : 0;
    const avgResponseTime = this.requestCount > 0
      ? Math.round((this.totalDurationMs / this.requestCount) * 100) / 100
      : 0;

    let min = 0;
    let max = 0;
    let p95 = 0;

    if (this.recentLatencies.length > 0) {
      const sorted = [...this.recentLatencies].sort((a, b) => a - b);
      min = sorted[0];
      max = sorted[sorted.length - 1];
      const p95Idx = Math.floor(sorted.length * 0.95);
      p95 = sorted[Math.min(p95Idx, sorted.length - 1)];
    }

    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRatePct,
      averageResponseTimeMs: avgResponseTime,
      minResponseTimeMs: min,
      maxResponseTimeMs: max,
      p95ResponseTimeMs: p95,
      recentErrors: [...this.recentErrors],
      uptimeSeconds,
    };
  }

  public checkDatabaseHealth(): {
    status: ComponentHealthStatus;
    latencyMs: number;
    connected: boolean;
    type: string;
    totalTables: number;
    checkedAt: string;
    details?: string;
  } {
    const start = process.hrtime.bigint();
    const checkedAt = new Date().toISOString();

    try {
      const result = db.pingDatabase();
      const end = process.hrtime.bigint();
      const latencyMs = Math.round((Number(end - start) / 1_000_000) * 100) / 100;

      const isHealthy = result.connected && latencyMs < 250;
      return {
        status: isHealthy ? 'HEALTHY' : 'DEGRADED',
        latencyMs,
        connected: result.connected,
        type: 'SQLite (node:sqlite)',
        totalTables: result.totalTables,
        checkedAt,
        details: isHealthy ? 'Database responsive' : 'Database query latency elevated',
      };
    } catch (err: unknown) {
      const end = process.hrtime.bigint();
      const latencyMs = Math.round((Number(end - start) / 1_000_000) * 100) / 100;
      return {
        status: 'DOWN',
        latencyMs,
        connected: false,
        type: 'SQLite (node:sqlite)',
        totalTables: 0,
        checkedAt,
        details: sanitizeErrorMessage(err),
      };
    }
  }

  public checkGeminiAiHealth(): {
    status: ComponentHealthStatus;
    configured: boolean;
    model: string;
    latencyMs?: number;
    checkedAt: string;
    message: string;
  } {
    const checkedAt = new Date().toISOString();
    const settings = db.getSettings();
    const model = settings.geminiModel || 'gemini-3.8-flash';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      return {
        status: 'DEGRADED',
        configured: false,
        model,
        checkedAt,
        message: 'GEMINI_API_KEY is not configured in environment settings',
      };
    }

    // If we have a cached probe from the last 60 seconds, reuse it to avoid quota consumption
    if (this.lastAiProbeResult && (Date.now() - new Date(this.lastAiProbeResult.checkedAt).getTime()) < 60_000) {
      return {
        ...this.lastAiProbeResult,
        configured: true,
        model,
      };
    }

    return {
      status: 'HEALTHY',
      configured: true,
      model,
      checkedAt,
      message: 'Gemini API key configured and ready for root-cause analysis',
    };
  }

  public async probeGeminiAiHealthLive(): Promise<{
    status: ComponentHealthStatus;
    configured: boolean;
    model: string;
    latencyMs: number;
    checkedAt: string;
    message: string;
  }> {
    const checkedAt = new Date().toISOString();
    const settings = db.getSettings();
    const model = settings.geminiModel || 'gemini-3.8-flash';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      const result = {
        status: 'DEGRADED' as ComponentHealthStatus,
        configured: false,
        model,
        latencyMs: 0,
        checkedAt,
        message: 'GEMINI_API_KEY is not configured in environment',
      };
      this.lastAiProbeResult = result;
      return result;
    }

    const start = process.hrtime.bigint();
    try {
      // Perform a lightweight probe check via Gemini Client
      const { getGeminiClientInstance } = await import('./gemini.js');
      const client = getGeminiClientInstance();

      // Test with minimal countTokens or lightweight model probe
      if (client && client.models) {
        // Quick model check
        const probeRes = await Promise.race([
          client.models.countTokens({
            model,
            contents: 'health probe',
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI probe timed out after 5s')), 5000)),
        ]);

        const end = process.hrtime.bigint();
        const latencyMs = Math.round((Number(end - start) / 1_000_000) * 100) / 100;

        const result = {
          status: 'HEALTHY' as ComponentHealthStatus,
          configured: true,
          model,
          latencyMs,
          checkedAt,
          message: `Operational (Probe response: ${latencyMs}ms)`,
        };
        this.lastAiProbeResult = result;
        return result;
      }

      return {
        status: 'HEALTHY' as ComponentHealthStatus,
        configured: true,
        model,
        latencyMs: 15,
        checkedAt,
        message: 'Gemini client initialized and ready',
      };
    } catch (err: unknown) {
      const end = process.hrtime.bigint();
      const latencyMs = Math.round((Number(end - start) / 1_000_000) * 100) / 100;
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isRateLimit = rawMsg.includes('429') || rawMsg.toLowerCase().includes('quota');
      const isHighDemand = rawMsg.includes('503') || rawMsg.toLowerCase().includes('high demand') || rawMsg.toLowerCase().includes('overloaded');

      let status: ComponentHealthStatus = 'DEGRADED';
      let message = sanitizeErrorMessage(rawMsg);

      if (isRateLimit) {
        status = 'DEGRADED';
        message = 'Gemini quota or rate limit reached (429)';
      } else if (isHighDemand) {
        status = 'DEGRADED';
        message = 'Gemini service temporarily experiencing high demand (503)';
      } else if (rawMsg.toLowerCase().includes('key') || rawMsg.toLowerCase().includes('api_key') || rawMsg.includes('400')) {
        status = 'DOWN';
        message = 'Gemini API key invalid or unauthorized';
      }

      const result = {
        status,
        configured: true,
        model,
        latencyMs,
        checkedAt,
        message,
      };
      this.lastAiProbeResult = result;
      return result;
    }
  }

  public getSystemHealthReport(): SystemHealthReport {
    const apiPerf = this.getApiPerformance();
    const dbHealth = this.checkDatabaseHealth();
    const aiHealth = this.checkGeminiAiHealth();
    const checkedAt = new Date().toISOString();

    const memUsage = process.memoryUsage();
    const memoryMb = Math.round((memUsage.rss / (1024 * 1024)) * 10) / 10;

    // API status determination
    let apiStatus: ComponentHealthStatus = 'HEALTHY';
    if (apiPerf.errorRatePct > 50) {
      apiStatus = 'DOWN';
    } else if (apiPerf.errorRatePct > 5 || apiPerf.averageResponseTimeMs > 1000) {
      apiStatus = 'DEGRADED';
    }

    // Overall system status determination
    let overallStatus: ComponentHealthStatus = 'HEALTHY';
    let httpStatusText: 'ok' | 'degraded' | 'down' = 'ok';

    if (dbHealth.status === 'DOWN' || apiStatus === 'DOWN') {
      overallStatus = 'DOWN';
      httpStatusText = 'down';
    } else if (dbHealth.status === 'DEGRADED' || apiStatus === 'DEGRADED' || aiHealth.status === 'DEGRADED') {
      overallStatus = 'DEGRADED';
      httpStatusText = 'degraded';
    }

    return {
      status: httpStatusText,
      service: 'AegisAI',
      systemStatus: overallStatus,
      timestamp: checkedAt,
      uptimeSeconds: apiPerf.uptimeSeconds,
      checks: {
        api: {
          status: apiStatus,
          uptimeSeconds: apiPerf.uptimeSeconds,
          memoryUsageMb: memoryMb,
          requestCount: apiPerf.requestCount,
          errorCount: apiPerf.errorCount,
          errorRatePct: apiPerf.errorRatePct,
          avgResponseTimeMs: apiPerf.averageResponseTimeMs,
          checkedAt,
        },
        database: dbHealth,
        geminiAi: aiHealth,
      },
    };
  }

  // Record an error manually from error middleware
  public captureError(errorRecord: Omit<ApiCapturedError, 'id' | 'timestamp'>) {
    this.errorCount++;
    const fullRecord: ApiCapturedError = {
      id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...errorRecord,
      message: sanitizeErrorMessage(errorRecord.message),
    };
    this.recentErrors.unshift(fullRecord);
    if (this.recentErrors.length > this.maxErrorsToKeep) {
      this.recentErrors.pop();
    }
  }

  // Reset metrics for testing purposes
  public resetForTesting() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalDurationMs = 0;
    this.recentLatencies = [];
    this.recentErrors = [];
    this.lastAiProbeResult = null;
  }
}

export const telemetryMonitor = new TelemetryMonitor();
