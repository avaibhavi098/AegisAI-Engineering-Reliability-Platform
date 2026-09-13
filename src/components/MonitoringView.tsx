import React, { useState, useEffect, useCallback } from 'react';
import {
  HeartPulse,
  Server,
  Database,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Activity,
  ShieldCheck,
  AlertOctagon,
  ArrowUpRight,
  TrendingUp,
  Trash2,
  Lock,
} from 'lucide-react';
import {
  MonitoringOverview,
  ComponentHealthStatus,
  Incident,
  Service,
} from '../types/index.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

interface MonitoringViewProps {
  onSelectIncident?: (incident: Incident) => void;
  onSelectService?: (serviceId: string) => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  onSelectIncident,
  onSelectService,
}) => {
  const { role, canMutateIncidents } = useAuth();
  const [data, setData] = useState<MonitoringOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProbing, setIsProbing] = useState(false);
  const [probingServiceId, setProbingServiceId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toISOString());

  const fetchOverview = useCallback(async () => {
    try {
      const overview = await api.getMonitoringOverview();
      setData(overview);
      setLastRefreshedAt(new Date().toISOString());
    } catch (err: unknown) {
      console.error('Failed to fetch monitoring overview:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    // Auto-refresh monitoring metrics every 15 seconds
    const interval = setInterval(fetchOverview, 15000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const handleRunHealthProbe = async () => {
    if (!canMutateIncidents) {
      setFeedbackMessage({ text: 'Active health probes require Engineer or Admin role', type: 'error' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    setIsProbing(true);
    try {
      await api.triggerHealthProbe();
      setFeedbackMessage({ text: 'Live health probe completed successfully', type: 'success' });
      await fetchOverview();
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || 'Live probe encountered an issue', type: 'error' });
    } finally {
      setIsProbing(false);
      setTimeout(() => setFeedbackMessage(null), 3500);
    }
  };

  const handleProbeService = async (serviceId: string, serviceName: string) => {
    if (!canMutateIncidents) {
      setFeedbackMessage({ text: 'Service probes require Engineer or Admin role', type: 'error' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    setProbingServiceId(serviceId);
    try {
      const updated = await api.triggerServiceProbe(serviceId);
      setFeedbackMessage({ text: `Probe completed for ${serviceName}: ${updated.status} (${updated.latencyMs}ms)`, type: 'success' });
      await fetchOverview();
    } catch (err: any) {
      setFeedbackMessage({ text: `Failed to probe ${serviceName}`, type: 'error' });
    } finally {
      setProbingServiceId(null);
      setTimeout(() => setFeedbackMessage(null), 3500);
    }
  };

  const handleClearErrors = async () => {
    if (role !== 'ADMIN') return;
    try {
      await api.clearMonitoringErrors();
      setFeedbackMessage({ text: 'System error logs cleared', type: 'success' });
      await fetchOverview();
    } catch {
      setFeedbackMessage({ text: 'Failed to clear error logs', type: 'error' });
    } finally {
      setTimeout(() => setFeedbackMessage(null), 3500);
    }
  };

  const getStatusBadge = (status: ComponentHealthStatus | 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN') => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>HEALTHY</span>
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>DEGRADED</span>
          </span>
        );
      case 'DOWN':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
            <span>DOWN</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <span>UNKNOWN</span>
          </span>
        );
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec && sec !== 0) return 'No data available';
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'No data available';
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-sm text-slate-400">Connecting to system telemetry probes...</p>
      </div>
    );
  }

  const systemHealth = data?.systemHealth;
  const apiPerf = data?.apiPerformance;
  const servicesHealth = data?.servicesHealth || [];
  const incidentStats = data?.incidentMonitoring;

  return (
    <div id="monitoring-view" className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <HeartPulse className="w-5 h-5 text-rose-400" />
            <span>Real-time System Health & Telemetry Probes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuous backend availability, database round-trips, Gemini AI connectivity, and measured API request latencies
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            Last updated: <span className="text-slate-200">{formatTimestamp(lastRefreshedAt)}</span>
          </div>

          <button
            id="refresh-monitoring-btn"
            onClick={fetchOverview}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            id="run-health-probe-btn"
            disabled={isProbing || !canMutateIncidents}
            onClick={handleRunHealthProbe}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all shadow-sm ${
              !canMutateIncidents
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : isProbing
                ? 'bg-indigo-600/70 text-indigo-200 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
            title={!canMutateIncidents ? 'Requires Engineer or Admin privileges' : 'Send active test probe to DB and Gemini AI'}
          >
            <Zap className={`w-3.5 h-3.5 ${isProbing ? 'animate-bounce' : ''}`} />
            <span>{isProbing ? 'Probing...' : 'Run Live Health Probe'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center space-x-2 transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* RBAC Viewer notice if applicable */}
      {!canMutateIncidents && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-3 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <span>
            Logged in with read-only (<strong className="text-slate-300">Viewer</strong>) privileges. Real-time telemetry is visible; running active health probes requires an Engineer or Admin session.
          </span>
        </div>
      )}

      {/* 1. SYSTEM HEALTH CARDS */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span>Core Subsystem Availability & Health</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall System Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Overall System Status</span>
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="pt-1">
              {getStatusBadge(systemHealth?.systemStatus || 'UNKNOWN')}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Aggregated from API, DB connectivity & Gemini AI state
            </p>
          </div>

          {/* Backend / API Availability */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Backend Node.js API</span>
              </span>
              {getStatusBadge(systemHealth?.checks.api.status || 'UNKNOWN')}
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold text-white font-mono">
                {systemHealth?.checks.api.uptimeSeconds !== undefined
                  ? formatSeconds(systemHealth.checks.api.uptimeSeconds)
                  : 'No data available'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Process Memory:</span>
                <span className="font-mono text-slate-300">
                  {systemHealth?.checks.api.memoryUsageMb !== undefined
                    ? `${systemHealth.checks.api.memoryUsageMb} MB`
                    : 'No data available'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Checked at {formatTimestamp(systemHealth?.checks.api.checkedAt)}
            </p>
          </div>

          {/* Database Connectivity */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>SQLite Persistence</span>
              </span>
              {getStatusBadge(systemHealth?.checks.database.status || 'UNKNOWN')}
            </div>
            <div className="space-y-1">
              <div className="text-xl font-bold text-white font-mono">
                {systemHealth?.checks.database.latencyMs !== undefined
                  ? `${systemHealth.checks.database.latencyMs} ms`
                  : 'No data available'}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Active Tables:</span>
                <span className="font-mono text-slate-300">
                  {systemHealth?.checks.database.totalTables ?? 'No data available'} tables
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Direct probe at {formatTimestamp(systemHealth?.checks.database.checkedAt)}
            </p>
          </div>

          {/* Gemini AI Service */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Gemini AI Engine</span>
              </span>
              {getStatusBadge(systemHealth?.checks.geminiAi.status || 'UNKNOWN')}
            </div>
            <div className="space-y-1">
              <div className="text-xs font-mono font-semibold text-white truncate" title={systemHealth?.checks.geminiAi.model}>
                {systemHealth?.checks.geminiAi.model || 'gemini-3.8-flash'}
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
                {systemHealth?.checks.geminiAi.message || (systemHealth?.checks.geminiAi.configured ? 'Key configured & ready' : 'API Key missing')}
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Status at {formatTimestamp(systemHealth?.checks.geminiAi.checkedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* 2. REAL API PERFORMANCE TELEMETRY */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span>Real API Performance Telemetry (Measured from Live Requests)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Request Count */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total API Requests</span>
            <div className="text-2xl font-bold text-white font-mono">
              {apiPerf ? apiPerf.requestCount.toLocaleString() : 'No data available'}
            </div>
            <p className="text-[11px] text-slate-400">Counted across all live endpoints</p>
          </div>

          {/* Average Response Time */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Average Response Time</span>
            <div className="text-2xl font-bold text-white font-mono">
              {apiPerf && apiPerf.requestCount > 0
                ? `${apiPerf.averageResponseTimeMs} ms`
                : 'No data available'}
            </div>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400 pt-0.5">
              <span>Min: {apiPerf && apiPerf.requestCount > 0 ? `${apiPerf.minResponseTimeMs}ms` : '—'}</span>
              <span>Max: {apiPerf && apiPerf.requestCount > 0 ? `${apiPerf.maxResponseTimeMs}ms` : '—'}</span>
            </div>
          </div>

          {/* Error Count & Error Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Error Count & Rate</span>
            <div className="text-2xl font-bold font-mono flex items-baseline space-x-2">
              <span className={apiPerf && apiPerf.errorCount > 0 ? 'text-amber-400' : 'text-white'}>
                {apiPerf ? apiPerf.errorCount : 'No data available'}
              </span>
              <span className="text-xs text-slate-400">
                ({apiPerf && apiPerf.requestCount > 0 ? `${apiPerf.errorRatePct}%` : '0%'})
              </span>
            </div>
            <p className="text-[11px] text-slate-400">4xx and 5xx responses</p>
          </div>

          {/* 95th Percentile Latency */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">P95 Tail Latency</span>
            <div className="text-2xl font-bold text-indigo-400 font-mono">
              {apiPerf && apiPerf.requestCount > 0 && apiPerf.p95ResponseTimeMs > 0
                ? `${apiPerf.p95ResponseTimeMs} ms`
                : apiPerf && apiPerf.requestCount > 0
                ? `${apiPerf.averageResponseTimeMs} ms`
                : 'No data available'}
            </div>
            <p className="text-[11px] text-slate-400">95% of requests completed faster</p>
          </div>
        </div>

        {/* Recent API Errors Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Recent API Errors (Sanitized - No Secrets or Keys Exposed)</span>
            </h3>
            {role === 'ADMIN' && apiPerf && apiPerf.recentErrors.length > 0 && (
              <button
                onClick={handleClearErrors}
                className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center space-x-1"
                title="Clear error logs"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Error History</span>
              </button>
            )}
          </div>

          {apiPerf && apiPerf.recentErrors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-medium">Timestamp</th>
                    <th className="pb-2 font-medium">Method</th>
                    <th className="pb-2 font-medium">Path</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {apiPerf.recentErrors.slice(0, 6).map((err) => (
                    <tr key={err.id} className="hover:bg-slate-800/30">
                      <td className="py-2 text-slate-400">{formatTimestamp(err.timestamp)}</td>
                      <td className="py-2 font-semibold text-slate-300">{err.method}</td>
                      <td className="py-2 text-slate-300 max-w-[200px] truncate">{err.path}</td>
                      <td className="py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            err.statusCode >= 500
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {err.statusCode}
                        </span>
                      </td>
                      <td className="py-2 text-slate-400">{err.durationMs}ms</td>
                      <td className="py-2 text-slate-300 max-w-[300px] truncate" title={err.message}>
                        {err.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400 flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>No API errors recorded. All recent API requests have responded successfully.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. REGISTERED SERVICES HEALTH */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Server className="w-4 h-4 text-indigo-400" />
          <span>Registered Service Probes & Health Status</span>
        </h2>

        {servicesHealth.length > 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50 font-medium">
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Response Time</th>
                    <th className="py-3 px-4">Last Checked</th>
                    <th className="py-3 px-4">Incidents</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {servicesHealth.map((srv) => (
                    <tr key={srv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{srv.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{srv.key}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {srv.tier}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(srv.status)}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {srv.responseTimeMs !== null ? (
                          <span className="text-white font-medium">{srv.responseTimeMs} ms</span>
                        ) : (
                          <span className="text-slate-500">No data available</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {formatTimestamp(srv.lastHealthCheck)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="text-white font-semibold">{srv.incidentCount}</span>
                        {srv.activeIncidentCount > 0 && (
                          <span className="ml-1 text-rose-400 font-bold">({srv.activeIncidentCount} active)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          disabled={probingServiceId === srv.id || !canMutateIncidents}
                          onClick={() => handleProbeService(srv.id, srv.name)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            probingServiceId === srv.id
                              ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                              : !canMutateIncidents
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {probingServiceId === srv.id ? 'Testing...' : 'Probe'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
            No registered services found in database.
          </div>
        )}
      </div>

      {/* 4. PERSISTENT INCIDENT MONITORING */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          <span>Incident Monitoring & Resolution Benchmarks (from Database)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Incidents */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Total Recorded</span>
            <div className="text-xl font-bold text-white font-mono">
              {incidentStats ? incidentStats.totalIncidents : 'No data available'}
            </div>
          </div>

          {/* Open Incidents */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Open</span>
            <div className="text-xl font-bold text-rose-400 font-mono">
              {incidentStats ? incidentStats.openIncidents : 'No data available'}
            </div>
          </div>

          {/* Investigating */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Investigating</span>
            <div className="text-xl font-bold text-amber-400 font-mono">
              {incidentStats ? incidentStats.investigatingIncidents : 'No data available'}
            </div>
          </div>

          {/* Critical P0 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Active Critical (P0)</span>
            <div className="text-xl font-bold text-rose-500 font-mono">
              {incidentStats ? incidentStats.criticalIncidents : 'No data available'}
            </div>
          </div>

          {/* Resolved */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Resolved</span>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {incidentStats ? incidentStats.resolvedIncidents : 'No data available'}
            </div>
          </div>

          {/* Average Resolution Time */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] text-slate-400">Avg Resolution</span>
            <div className="text-xl font-bold text-white font-mono">
              {incidentStats?.averageResolutionMinutes !== null && incidentStats?.averageResolutionMinutes !== undefined
                ? `${incidentStats.averageResolutionMinutes} min`
                : 'No data available'}
            </div>
          </div>
        </div>

        {/* Recent Incidents Table */}
        {incidentStats && incidentStats.recentIncidents.length > 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-950/30 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Recent Incident Records</span>
              <span className="text-[11px] text-slate-400">Persistent database logs</span>
            </div>
            <div className="divide-y divide-slate-800">
              {incidentStats.recentIncidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident?.(inc)}
                  className="p-3 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400'
                            : inc.severity === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-indigo-500/20 text-indigo-400'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span className="text-xs font-medium text-white hover:text-indigo-400 transition-colors">
                        {inc.title}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">({inc.serviceName})</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Started: {formatTimestamp(inc.startedAt)}
                      {inc.resolvedAt && ` • Resolved: ${formatTimestamp(inc.resolvedAt)}`}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        inc.status === 'RESOLVED' || inc.status === 'CLOSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : inc.status === 'INVESTIGATING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {inc.status}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            No incidents recorded in database.
          </div>
        )}
      </div>
    </div>
  );
};
