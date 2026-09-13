import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Search,
  Sparkles,
  Terminal,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Play,
  CheckCircle2,
  Upload,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  X,
  Plus,
  Lock,
} from 'lucide-react';
import { LogEntry, Service, AIAnalysisResult, Severity } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useDebounce } from '../hooks/useDebounce.js';

interface LogAnalysisViewProps {
  logs: LogEntry[];
  services: Service[];
  onRefreshLogs: () => void;
  onSimulateLog: (payload: {
    serviceId: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
    message: string;
    stackTrace?: string;
  }) => void;
  onAnalyzeLogsWithAI: (params: {
    serviceName?: string;
    serviceId?: string;
    rawLogs?: string;
    logs?: string[];
  }) => Promise<AIAnalysisResult>;
  onOpenCreateIncident?: (prefill?: {
    title: string;
    description: string;
    serviceId?: string;
    severity: Severity;
    errorLogs?: string;
  }) => void;
}

const SAMPLE_LOG_PRESETS = [
  {
    name: 'PostgreSQL Connection Exhaustion',
    service: 'Core Database Cluster',
    content: `2026-09-12T10:14:02.102Z ERROR [Database-Master] FATAL: remaining connection slots are reserved for non-replication superuser connections
2026-09-12T10:14:02.145Z ERROR [Database-Master] org.postgresql.util.PSQLException: FATAL: sorry, too many clients already
  at org.postgresql.core.v3.ConnectionFactoryImpl.doAuthentication(ConnectionFactoryImpl.java:514)
  at org.postgresql.core.v3.ConnectionFactoryImpl.tryConnect(ConnectionFactoryImpl.java:146)
  at org.postgresql.jdbc.PgConnection.<init>(PgConnection.java:247)
  at com.zaxxer.hikari.pool.PoolBase.newConnection(PoolBase.java:364)
  at com.zaxxer.hikari.pool.HikariPool.checkFailFast(HikariPool.java:566)
2026-09-12T10:14:03.001Z WARN  [Database-Master] PoolBase: Connection acquisition timeout after 30002ms: HikariPool-1 (total=100, active=100, idle=0, waiting=42)
2026-09-12T10:14:04.218Z ERROR [API-Gateway] 504 Gateway Timeout upstream database cluster unresponsive on port 5432`,
  },
  {
    name: 'Redis Cache Eviction Storm',
    service: 'Redis Caching Cluster',
    content: `2026-09-12T08:33:11.200Z WARN  [Redis-Cluster-01] # Warning: 95% of maxmemory (16.00 GiB) consumed. maxmemory-policy: allkeys-lru
2026-09-12T08:33:14.412Z ERROR [Redis-Cluster-01] (error) OOM command not allowed when used memory > 'maxmemory'.
2026-09-12T08:33:14.502Z ERROR [Auth-Service] RedisCommandExecutionException: OOM command not allowed when used memory > 'maxmemory'. Key: session_token:89a12c8e
  at io.lettuce.core.ExceptionFactory.createExecutionException(ExceptionFactory.java:147)
  at io.lettuce.core.protocol.AsyncCommand.await(AsyncCommand.java:93)
2026-09-12T08:33:15.110Z WARN  [Auth-Service] Cache miss fallback triggered - cascading reads hitting primary Postgres replica
2026-09-12T08:33:18.990Z ERROR [Auth-Service] Latency threshold breached: P99 degraded to 2840ms (SLA target: 50ms)`,
  },
  {
    name: 'Kubernetes Pod OOMKilled & CrashLoop',
    service: 'Payment Gateway',
    content: `2026-09-12T11:02:19.000Z WARN  [k8s-kubelet] Pod payment-gateway-7b9dc5649b-xq29m exceeded memory limit (2048Mi).
2026-09-12T11:02:19.410Z ERROR [k8s-kubelet] Killing container "payment-gateway": Container failed liveness probe, OOMKilled with exit code 137
2026-09-12T11:02:22.180Z WARN  [k8s-controller] Back-off restarting failed container payment-gateway in pod payment-gateway-7b9dc5649b-xq29m
2026-09-12T11:02:25.012Z ERROR [k8s-ingress] Ingress nginx upstream connection error: 502 Bad Gateway while connecting to upstream pod 10.244.2.14:8080`,
  },
];

export const LogAnalysisView: React.FC<LogAnalysisViewProps> = ({
  logs,
  services,
  onRefreshLogs,
  onSimulateLog,
  onAnalyzeLogsWithAI,
  onOpenCreateIncident,
}) => {
  const { canRunAi, canMutateIncidents, showForbiddenNotice } = useAuth();

  // Main view state
  const [activeTab, setActiveTab] = useState<'stream' | 'custom-logs'>('stream');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Custom pasted / uploaded logs state
  const [customLogText, setCustomLogText] = useState('');
  const [customServiceName, setCustomServiceName] = useState(services[0]?.name || 'Payment Gateway');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Diagnosis Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiSourceMode, setAiSourceMode] = useState<'stream' | 'custom'>('stream');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [aiDiagnosisError, setAiDiagnosisError] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIAnalysisResult | null>(null);

  // Simulate log form state
  const [showSimulateDrawer, setShowSimulateDrawer] = useState(false);
  const [simServiceId, setSimServiceId] = useState(services[0]?.id || '');
  const [simLevel, setSimLevel] = useState<'INFO' | 'WARN' | 'ERROR' | 'FATAL'>('ERROR');
  const [simMessage, setSimMessage] = useState('');
  const [simTrace, setSimTrace] = useState('');

  const filteredLogs = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    return logs.filter((l) => {
      const matchesSearch =
        !term ||
        l.message.toLowerCase().includes(term) ||
        l.traceId.toLowerCase().includes(term) ||
        (l.stackTrace && l.stackTrace.toLowerCase().includes(term));
      const matchesLevel = levelFilter === 'ALL' || l.level === levelFilter;
      const matchesService = serviceFilter === 'ALL' || l.serviceId === serviceFilter;
      return matchesSearch && matchesLevel && matchesService;
    });
  }, [logs, debouncedSearch, levelFilter, serviceFilter]);

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'FATAL':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
      case 'ERROR':
        return 'bg-red-500/15 text-red-400 border border-red-500/30';
      case 'WARN':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case 'INFO':
        return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // Trigger AI Analysis
  const handleTriggerAiDiagnosis = async (source: 'stream' | 'custom' = aiSourceMode) => {
    if (!canRunAi) {
      showForbiddenNotice('Execute Gemini AI Log Analysis', ['ADMIN', 'ENGINEER']);
      return;
    }

    setIsDiagnosing(true);
    setAiDiagnosisError(null);
    setShowAiModal(true);
    setAiSourceMode(source);

    try {
      if (source === 'custom') {
        if (!customLogText.trim()) {
          throw new Error('Please paste log content or upload a log file before requesting AI analysis.');
        }

        const result = await onAnalyzeLogsWithAI({
          serviceName: customServiceName,
          rawLogs: customLogText,
        });
        setAiAnalysisResult(result);
      } else {
        // Stream mode
        const targetService =
          serviceFilter !== 'ALL'
            ? services.find((s) => s.id === serviceFilter)?.name || 'Target Service'
            : 'Multi-Service Cluster';

        const streamSnippets = filteredLogs.slice(0, 35).map(
          (l) => `[${l.timestamp}] ${l.level} [${l.serviceName}] ${l.message}\n${l.stackTrace || ''}`
        );

        if (streamSnippets.length === 0) {
          throw new Error('No logs match the current filters. Please adjust filters or inject logs first.');
        }

        const result = await onAnalyzeLogsWithAI({
          serviceName: targetService,
          logs: streamSnippets,
        });
        setAiAnalysisResult(result);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to complete AI log analysis';
      setAiDiagnosisError(msg);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size exceeds 2MB limit. Please upload a smaller log sample.');
      return;
    }

    setUploadError(null);
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCustomLogText(content);
        setActiveTab('custom-logs');
      }
    };
    reader.readAsText(file);
  };

  // Handle Drag and Drop
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size exceeds 2MB limit. Please upload a smaller log sample.');
      return;
    }

    setUploadError(null);
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCustomLogText(content);
        setActiveTab('custom-logs');
      }
    };
    reader.readAsText(file);
  };

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessage.trim()) return;

    onSimulateLog({
      serviceId: simServiceId,
      level: simLevel,
      message: simMessage,
      stackTrace: simTrace || undefined,
    });

    setSimMessage('');
    setSimTrace('');
    setShowSimulateDrawer(false);
  };

  return (
    <div id="log-analysis-view" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>Centralized Log & Telemetry Explorer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Distributed trace log streams, custom stack traces, file uploads, and Gemini 3.8 Flash AI pattern diagnosis
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="inject-log-btn"
            onClick={() => {
              if (!canMutateIncidents) {
                showForbiddenNotice('Inject Simulated Log', ['ADMIN', 'ENGINEER']);
                return;
              }
              setShowSimulateDrawer(true);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              canMutateIncidents
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-850 text-slate-400 border-slate-800'
            }`}
          >
            {canMutateIncidents ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
            <span>Inject Log</span>
          </button>

          {/* Primary "Analyze with AI" Action Button */}
          <button
            id="analyze-logs-ai-btn"
            onClick={() => handleTriggerAiDiagnosis(activeTab === 'stream' ? 'stream' : 'custom')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
              canRunAi
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {canRunAi ? <Sparkles className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
            <span>{canRunAi ? 'Analyze with AI' : 'Analyze with AI (Engineer)'}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation: Stream Explorer vs Custom Log Workbench */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-1">
        <button
          id="tab-stream-explorer"
          onClick={() => setActiveTab('stream')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'stream'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Live Stream Explorer ({filteredLogs.length} events)</span>
        </button>

        <button
          id="tab-custom-logs"
          onClick={() => setActiveTab('custom-logs')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'custom-logs'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Paste / Upload Sample Logs</span>
          {customLogText.trim() && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
          )}
        </button>
      </div>

      {/* TAB 1: STREAM EXPLORER */}
      {activeTab === 'stream' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/80 rounded-xl p-3">
            {/* Search */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-logs-input"
                type="text"
                placeholder="Search message, trace ID, or stack frames..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>

            {/* Level Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700/60">
                {(['ALL', 'FATAL', 'ERROR', 'WARN', 'INFO'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    id={`filter-log-level-${lvl.toLowerCase()}`}
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      levelFilter === lvl
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              {/* Service Dropdown */}
              <select
                id="filter-log-service-select"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Services ({services.length})</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <button
                onClick={onRefreshLogs}
                title="Refresh log feed"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal-style Log Stream */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl font-mono text-xs">
            {/* Terminal Header */}
            <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span className="text-slate-300 font-semibold ml-2">stdout / stderr stream</span>
              </div>
              <div className="flex items-center space-x-3">
                <span>Showing {filteredLogs.length} events</span>
                <button
                  id="diagnose-current-stream-btn"
                  onClick={() => handleTriggerAiDiagnosis('stream')}
                  className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-sans text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze Stream</span>
                </button>
              </div>
            </div>

            {/* Logs List */}
            <div className="divide-y divide-slate-900 max-h-[600px] overflow-y-auto custom-scrollbar p-2">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No logs found matching current query or filters.</div>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div
                      key={log.id}
                      id={`log-entry-${log.id}`}
                      className="p-2.5 hover:bg-slate-900/80 rounded-lg transition-colors group cursor-pointer"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-400 text-[10px] select-none">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded font-mono ${getLevelBadge(log.level)}`}>
                            {log.level}
                          </span>
                          <span className="text-indigo-400 font-medium text-[11px]">{log.serviceName}</span>
                          <span className="text-slate-400 text-[10px]">[{log.traceId}]</span>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                          <button
                            id={`copy-log-${log.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(`${log.message}\n${log.stackTrace || ''}`, log.id);
                            }}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                            title="Copy log entry"
                          >
                            {copiedId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-200 mt-1 leading-relaxed break-all font-sans text-xs">
                        {log.message}
                      </p>

                      {/* Expandable Stack Trace */}
                      {log.stackTrace && isExpanded && (
                        <pre className="mt-2 p-3 bg-slate-900 rounded-lg border border-slate-800 text-rose-300 text-[11px] overflow-x-auto select-all leading-relaxed font-mono">
                          {log.stackTrace}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PASTE / UPLOAD SAMPLE LOGS WORKBENCH */}
      {activeTab === 'custom-logs' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span>Custom Log & Trace Analyzer</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Paste raw application logs, stack traces, or upload log files (.log, .txt, .json) for instant AI diagnosis.
                </p>
              </div>

              {/* Sample Presets */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">Quick Samples:</span>
                <select
                  id="sample-preset-select"
                  onChange={(e) => {
                    const preset = SAMPLE_LOG_PRESETS.find((p) => p.name === e.target.value);
                    if (preset) {
                      setCustomLogText(preset.content);
                      setCustomServiceName(preset.service);
                      setUploadedFileName(preset.name);
                    }
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
                  defaultValue=""
                >
                  <option value="" disabled>Load Sample Scenario...</option>
                  {SAMPLE_LOG_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Service Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Service Name</label>
                <input
                  type="text"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder="e.g. Payment Gateway, Auth Service..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              {/* Drag and drop file upload trigger */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Upload File (.log / .txt / .json)</label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/60 rounded-lg px-3 py-1.5 text-xs text-slate-300 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="truncate">
                    {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Drag & drop or click to upload log file'}
                  </span>
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".log,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {uploadError && (
              <div className="bg-rose-950/60 border border-rose-800/80 rounded-lg p-2.5 text-xs text-rose-300 flex items-center justify-between">
                <span>{uploadError}</span>
                <button
                  onClick={() => setUploadError(null)}
                  className="text-rose-400 hover:text-white font-bold ml-2 text-xs"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Raw Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Raw Log Buffer / Stack Frames</label>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {customLogText.length.toLocaleString()} chars
                  </span>
                  {customLogText && (
                    <button
                      onClick={() => {
                        setCustomLogText('');
                        setUploadedFileName(null);
                      }}
                      className="text-[11px] text-slate-400 hover:text-rose-400"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                id="custom-logs-textarea"
                rows={10}
                placeholder="Paste application stack traces, NGINX error logs, or container stdout here..."
                value={customLogText}
                onChange={(e) => setCustomLogText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 custom-scrollbar"
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Gemini AI will cross-examine these logs against service topology, performance thresholds, and error signatures.
              </span>

              <button
                id="analyze-custom-logs-btn"
                onClick={() => handleTriggerAiDiagnosis('custom')}
                disabled={!customLogText.trim() || isDiagnosing}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-slate-400 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
                <span>{isDiagnosing ? 'Diagnosing...' : 'Analyze with AI'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Log Diagnosis Modal / Drawer */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div
            id="ai-log-diagnosis-modal"
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-900/90">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-white">Gemini AI Log Pattern Diagnostic</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      AI-Generated Analysis
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Model: <span className="font-mono text-slate-300">gemini-3.8-flash</span>
                    {aiAnalysisResult?.analyzedAt && ` • Generated ${new Date(aiAnalysisResult.analyzedAt).toLocaleTimeString()}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="regenerate-log-analysis-btn"
                  onClick={() => handleTriggerAiDiagnosis(aiSourceMode)}
                  disabled={isDiagnosing}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                  <span>{isDiagnosing ? 'Diagnosing...' : 'Regenerate Analysis'}</span>
                </button>

                <button
                  onClick={() => setShowAiModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5">
              {/* Error State */}
              {aiDiagnosisError && (
                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
                      aiDiagnosisError.includes('503') || aiDiagnosisError.toLowerCase().includes('high demand')
                        ? 'bg-amber-950/60 border-amber-800/80 text-amber-200'
                        : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                    }`}
                  >
                    <AlertCircle
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        aiDiagnosisError.includes('503') || aiDiagnosisError.toLowerCase().includes('high demand')
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    />
                    <div className="flex-1 space-y-1">
                      <div
                        className={`font-semibold ${
                          aiDiagnosisError.includes('503') || aiDiagnosisError.toLowerCase().includes('high demand')
                            ? 'text-amber-300'
                            : 'text-rose-300'
                        }`}
                      >
                        {aiDiagnosisError.includes('503') || aiDiagnosisError.toLowerCase().includes('high demand')
                          ? 'Gemini AI Service Temporarily Busy (503)'
                          : 'Log AI Analysis Failed'}
                      </div>
                      <p className="leading-relaxed font-sans opacity-90">{aiDiagnosisError}</p>
                      <div className="pt-2 flex items-center space-x-3">
                        <button
                          onClick={() => handleTriggerAiDiagnosis(aiSourceMode)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                            aiDiagnosisError.includes('503') || aiDiagnosisError.toLowerCase().includes('high demand')
                              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                              : 'bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-700'
                          }`}
                        >
                          Retry Now
                        </button>
                        <span className="text-[11px] text-slate-400">
                          Automated backoff retry will run up to 3 times.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                      AI confidence based on available evidence:
                    </span>
                    <span className="font-mono font-bold text-amber-400">Confidence unavailable</span>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isDiagnosing && (
                <div className="py-20 text-center space-y-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <RefreshCw className="w-9 h-9 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-white">Analyzing Log Telemetry Stream with Gemini 3.8 Flash...</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Evaluating exception signatures, memory exhaustion patterns, network timeouts, and thread concurrency bottlenecks.
                  </p>
                </div>
              )}

              {/* Success State: 8 Structured Sections */}
              {aiAnalysisResult && !isDiagnosing && (
                <div className="space-y-4">
                  {/* Top Stats Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Confidence Score Bar */}
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                          AI confidence based on available evidence
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {typeof aiAnalysisResult.confidenceScore === 'number' && !isNaN(aiAnalysisResult.confidenceScore)
                            ? `${aiAnalysisResult.confidenceScore}%`
                            : 'Confidence unavailable'}
                        </span>
                      </div>
                      {typeof aiAnalysisResult.confidenceScore === 'number' && !isNaN(aiAnalysisResult.confidenceScore) ? (
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-emerald-400"
                            style={{ width: `${aiAnalysisResult.confidenceScore}%` }}
                          ></div>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-400 font-medium">Confidence unavailable</div>
                      )}
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        AI confidence based on available evidence
                      </span>
                    </div>

                    {/* 6. Severity Assessment */}
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block mb-1">
                        6. Severity Assessment
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        {aiAnalysisResult.severityAssessment}
                      </p>
                    </div>
                  </div>

                  {/* 1. Incident / Anomaly Summary */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>1. Incident & Anomaly Summary</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-100 font-sans leading-relaxed">
                      {aiAnalysisResult.incidentSummary}
                    </p>
                  </div>

                  {/* 2. Probable Root Cause */}
                  <div className="bg-slate-800/80 border border-amber-500/30 rounded-xl p-4 bg-gradient-to-br from-slate-900 to-amber-950/20">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>2. Probable Root Cause</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-100 font-sans font-medium leading-relaxed">
                      {aiAnalysisResult.probableRootCause}
                    </p>
                  </div>

                  {/* 3. Possible Alternative Causes */}
                  {aiAnalysisResult.possibleAlternativeCauses && aiAnalysisResult.possibleAlternativeCauses.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                        <HelpCircle className="w-4 h-4 text-indigo-400" />
                        <span>3. Possible Alternative Causes</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiAnalysisResult.possibleAlternativeCauses.map((cause, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-indigo-400 font-bold shrink-0">&bull;</span>
                            <span className="text-slate-200">{cause}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 4. Recommended Troubleshooting Steps */}
                  {aiAnalysisResult.recommendedTroubleshootingSteps && aiAnalysisResult.recommendedTroubleshootingSteps.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>4. Recommended Troubleshooting Steps</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        {aiAnalysisResult.recommendedTroubleshootingSteps.map((step, idx) => (
                          <div key={idx} className="flex items-start space-x-2.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 flex items-center justify-center font-mono font-bold shrink-0 text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="text-slate-200 mt-0.5">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Risk Factors */}
                  {aiAnalysisResult.riskFactors && aiAnalysisResult.riskFactors.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>5. Risk Factors & Cascading Failures</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiAnalysisResult.riskFactors.map((risk, idx) => (
                          <li key={idx} className="flex items-start space-x-2 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30">
                            <span className="text-rose-400 font-bold shrink-0">&bull;</span>
                            <span className="text-rose-200">{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* SRE Runbook Commands */}
                  {aiAnalysisResult.runbookCommands && aiAnalysisResult.runbookCommands.length > 0 && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                          <Terminal className="w-4 h-4" />
                          <span>Recommended Mitigation Runbook Commands</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">Bash / CLI</span>
                      </div>

                      <div className="space-y-2 font-mono text-xs">
                        {aiAnalysisResult.runbookCommands.map((cmd, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 group"
                          >
                            <span className="text-emerald-300 overflow-x-auto custom-scrollbar select-all pr-2">
                              {cmd}
                            </span>
                            <button
                              id={`copy-log-cmd-${idx}`}
                              onClick={() => handleCopyCommand(cmd)}
                              title="Copy command to clipboard"
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                            >
                              {copiedCmd === cmd ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 8. Prevention Suggestions */}
                  {aiAnalysisResult.preventionSuggestions && aiAnalysisResult.preventionSuggestions.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                        <span>8. Prevention Suggestions & Long-Term Hardening</span>
                      </h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                        {aiAnalysisResult.preventionSuggestions.map((rec, idx) => (
                          <li key={idx} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer Action: Convert Diagnosis into Incident */}
                  {onOpenCreateIncident && (
                    <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-white block">Escalate to Active Incident?</span>
                        <span className="text-xs text-slate-400">
                          Pre-fill a new incident declaration with this AI root-cause analysis and attach the logs.
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setShowAiModal(false);
                          const matchingService = services.find((s) => s.name === customServiceName);
                          onOpenCreateIncident({
                            title: aiAnalysisResult.probableRootCause.slice(0, 100),
                            description: aiAnalysisResult.incidentSummary,
                            serviceId: matchingService?.id,
                            severity: aiAnalysisResult.severityAssessment.toUpperCase().includes('CRITICAL') ? 'CRITICAL' : 'HIGH',
                            errorLogs: customLogText || 'Logs extracted from stream diagnosis.',
                          });
                        }}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Declare Incident from Diagnosis</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simulate Log Drawer/Modal */}
      {showSimulateDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-1">Inject Simulated Test Log</h3>
            <p className="text-xs text-slate-400 mb-4">
              Emit synthetic runtime telemetry to test alerting channels and log indexing.
            </p>

            <form onSubmit={handleSimulateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Service</label>
                <select
                  value={simServiceId}
                  onChange={(e) => setSimServiceId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Log Level</label>
                <select
                  value={simLevel}
                  onChange={(e) => setSimLevel(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                >
                  <option value="FATAL">FATAL</option>
                  <option value="ERROR">ERROR</option>
                  <option value="WARN">WARN</option>
                  <option value="INFO">INFO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Log Message</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unhandled promise rejection: Redis connection dropped"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Stack Trace (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Paste stack frames..."
                  value={simTrace}
                  onChange={(e) => setSimTrace(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-rose-300 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSimulateDrawer(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 cursor-pointer"
                >
                  Emit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
