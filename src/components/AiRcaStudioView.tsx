import React, { useState } from 'react';
import {
  Sparkles,
  Terminal,
  RefreshCw,
  Copy,
  Check,
  Zap,
  AlertTriangle,
  ShieldCheck,
  FileCode,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Play,
  Lock,
} from 'lucide-react';
import { Service, Incident, AIAnalysisResult, Severity } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

interface AiRcaStudioViewProps {
  services: Service[];
  incidents: Incident[];
  onPerformAdHocAnalysis: (params: {
    serviceName: string;
    title: string;
    description: string;
    severity: Severity;
    errorLogs: string;
  }) => Promise<AIAnalysisResult>;
}

export const AiRcaStudioView: React.FC<AiRcaStudioViewProps> = ({
  services,
  incidents,
  onPerformAdHocAnalysis,
}) => {
  const { canRunAi, role, showForbiddenNotice } = useAuth();
  const [selectedService, setSelectedService] = useState(services[0]?.name || 'Payment Orchestrator');
  const [title, setTitle] = useState('Outbound Connection Timeout to Banking Gateway');
  const [severity, setSeverity] = useState<Severity>('CRITICAL');
  const [description, setDescription] = useState('Worker threads exhausted after partner TLS latency spiked beyond 5000ms.');
  const [errorLogs, setErrorLogs] = useState(`[2026-09-12T17:15:02.194Z] ERROR [payment-orchestrator] (thread-pool-42): ETIMEDOUT connection to stripe-proxy.bank.internal:443
  at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1146:16)
  at Timeout.connectionTimeout (node_modules/axios/lib/adapters/http.js:280:19)
[2026-09-12T17:15:04.810Z] FATAL [payment-orchestrator] CircuitBreaker[BankingConnector]: State changed from CLOSED to OPEN after 15 consecutive 504 errors.
[2026-09-12T17:15:05.002Z] ERROR [payment-orchestrator] [trace_id: 8f9b1c20-a8] Aborting transaction order_id=988172 - circuit breaker rejection`);

  const [isLoading, setIsLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const sampleScenarios = [
    {
      name: 'Redis Eviction Storm',
      service: 'Inventory Redis Cluster',
      severity: 'HIGH' as Severity,
      title: 'Redis OOM Command Eviction & Latency Degrade',
      description: 'Key count reached maxmemory (8GB) with no TTL set on promo cart objects.',
      logs: `[2026-09-12T14:22:01.901Z] ERROR [inventory-cache] OOM command not allowed when used memory > 'maxmemory'.
[2026-09-12T14:22:02.042Z] WARN [inventory-cache] maxmemory-policy volatile-lru found 0 volatile keys out of 4,800,000 keys.
[2026-09-12T14:22:03.119Z] ERROR [order-fulfillment] Cache miss cascade triggered direct unthrottled queries on primary postgres DB.`,
    },
    {
      name: 'PostgreSQL Lock Contention',
      service: 'Primary PostgreSQL Cluster',
      severity: 'HIGH' as Severity,
      title: 'Lock Contention on order_lines Primary Table',
      description: 'Analytics migration worker acquired AccessExclusiveLock during operational peak.',
      logs: `[2026-09-12T16:35:11.882Z] WARN [db-primary] process 48921 still waiting for ExclusiveLock on relation 16401
[2026-09-12T16:35:16.901Z] ERROR [db-primary] canceling statement due to statement_timeout: UPDATE order_lines SET status = 'ALLOCATED'
[2026-09-12T16:35:19.412Z] ERROR [order-fulfillment-api] org.postgresql.util.PSQLException: canceling statement due to statement_timeout (5002ms)`,
    },
    {
      name: 'Kafka Consumer Lag Spike',
      service: 'Push Notification Dispatcher',
      severity: 'MEDIUM' as Severity,
      title: 'Kafka Consumer Group Rebalance Storm',
      description: 'Heartbeat thread starved while consumer thread parsed large JSON payloads.',
      logs: `[2026-09-12T12:40:02.102Z] WARN [notification-dispatcher] CommitFailedException: Commit cannot be completed since group has already rebalanced.
[2026-09-12T12:40:05.109Z] ERROR [notification-dispatcher] MaxPollIntervalException: message processing took 45000ms > max.poll.interval.ms=30000ms`,
    },
  ];

  const handleApplyScenario = (scenario: typeof sampleScenarios[0]) => {
    setSelectedService(scenario.service);
    setSeverity(scenario.severity);
    setTitle(scenario.title);
    setDescription(scenario.description);
    setErrorLogs(scenario.logs);
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRunAi) {
      showForbiddenNotice('Execute Gemini AI Root-Cause Analysis', ['ADMIN', 'ENGINEER']);
      return;
    }
    setIsLoading(true);
    setAnalysisError(null);
    try {
      const result = await onPerformAdHocAnalysis({
        serviceName: selectedService,
        title,
        description,
        severity,
        errorLogs,
      });
      setAnalysisResult(result);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to complete AI RCA analysis';
      setAnalysisError(msg);
      console.error('AI RCA Studio run failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div id="ai-rca-studio-view" className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>AI Root-Cause Analysis (RCA) Studio</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate stack traces, system logs, and failure telemetry with Gemini 3.8 Flash to generate structured root causes and runbooks
          </p>
        </div>

        {/* Quick Scenario Pills */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 mr-1 flex items-center">
            <Play className="w-3 h-3 mr-1 text-indigo-400" />
            Presets:
          </span>
          {sampleScenarios.map((scen) => (
            <button
              key={scen.name}
              id={`preset-${scen.name.toLowerCase().replace(/\s+/g, '-')}`}
              type="button"
              onClick={() => handleApplyScenario(scen)}
              className="text-[11px] font-mono px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              {scen.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Panel: Diagnostic Input (5 cols on lg) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span>Incident Telemetry & Stack Trace</span>
          </h2>

          <form onSubmit={handleRunAnalysis} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Service</label>
              <select
                id="rca-service-select"
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.tier})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Severity</label>
                <select
                  id="rca-severity-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                >
                  <option value="CRITICAL">CRITICAL (P0)</option>
                  <option value="HIGH">HIGH (P1)</option>
                  <option value="MEDIUM">MEDIUM (P2)</option>
                  <option value="LOW">LOW (P3)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Incident Headline</label>
                <input
                  id="rca-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Symptom Description</label>
              <input
                id="rca-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Error Logs & Stack Trace</label>
              <textarea
                id="rca-logs-input"
                rows={9}
                required
                value={errorLogs}
                onChange={(e) => setErrorLogs(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-rose-300 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed custom-scrollbar"
              />
            </div>

            <button
              type="submit"
              id="submit-rca-studio-btn"
              disabled={isLoading}
              className={`w-full py-2.5 rounded-lg text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                canRunAi
                  ? 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750'
              }`}
            >
              {canRunAi ? (
                <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <span>
                {!canRunAi
                  ? 'Execute AI Root-Cause Report (Requires Engineer / Admin)'
                  : isLoading
                  ? 'Synthesizing Diagnosis with Gemini 3.8 Flash...'
                  : 'Generate AI Root-Cause Report'}
              </span>
            </button>
          </form>
        </div>

        {/* Right Output Panel: AI Diagnosis Report (7 cols on lg) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Diagnostic Assessment & Runbooks</span>
            </h2>

            {analysisResult && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {typeof analysisResult.confidenceScore === 'number' && !isNaN(analysisResult.confidenceScore)
                  ? `${analysisResult.confidenceScore}% Confidence`
                  : 'Confidence unavailable'} • {analysisResult.modelUsed}
              </span>
            )}
            {analysisError && !analysisResult && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Confidence unavailable
              </span>
            )}
          </div>

          {/* Error State */}
          {analysisError && (
            <div className="space-y-3">
              <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-4 flex items-start space-x-3 text-rose-200 text-xs">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="font-semibold text-rose-300">Gemini AI RCA Analysis Failed</div>
                  <p className="text-rose-200/90 leading-relaxed font-sans">{analysisError}</p>
                </div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  AI confidence based on available evidence:
                </span>
                <span className="font-mono font-bold text-amber-400">Confidence unavailable</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-white">Analyzing failure propagation patterns with Gemini 3.8 Flash...</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Cross-correlating topology, connection pools, socket timeouts, and error traces into a structured diagnostic response.
              </p>
            </div>
          ) : analysisResult ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* 7. Confidence & 6. Severity Assessment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      AI confidence based on available evidence
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {typeof analysisResult.confidenceScore === 'number' && !isNaN(analysisResult.confidenceScore)
                        ? `${analysisResult.confidenceScore}%`
                        : 'Confidence unavailable'}
                    </span>
                  </div>
                  {typeof analysisResult.confidenceScore === 'number' && !isNaN(analysisResult.confidenceScore) ? (
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-emerald-400"
                        style={{ width: `${analysisResult.confidenceScore}%` }}
                      ></div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400 font-medium">Confidence unavailable</div>
                  )}
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    AI confidence based on available evidence
                  </span>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block mb-1">
                    6. Severity Assessment
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {analysisResult.severityAssessment}
                  </p>
                </div>
              </div>

              {/* 1. Incident Summary */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>1. Incident Summary</span>
                </h4>
                <p className="text-xs sm:text-sm text-slate-100 font-sans leading-relaxed">
                  {analysisResult.incidentSummary}
                </p>
              </div>

              {/* 2. Probable Root Cause */}
              <div className="bg-slate-800/80 border border-amber-500/30 rounded-xl p-4 bg-gradient-to-br from-slate-900 to-amber-950/20">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>2. Probable Root Cause</span>
                </div>
                <p className="text-sm text-slate-100 leading-relaxed font-sans font-medium">
                  {analysisResult.probableRootCause}
                </p>
              </div>

              {/* 3. Possible Alternative Causes */}
              {analysisResult.possibleAlternativeCauses && analysisResult.possibleAlternativeCauses.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    <span>3. Possible Alternative Causes</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {analysisResult.possibleAlternativeCauses.map((cause, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-indigo-400 font-bold shrink-0">&bull;</span>
                        <span className="text-slate-200">{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 4. Recommended Troubleshooting Steps */}
              {analysisResult.recommendedTroubleshootingSteps && analysisResult.recommendedTroubleshootingSteps.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>4. Recommended Troubleshooting Steps</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    {analysisResult.recommendedTroubleshootingSteps.map((step, idx) => (
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
              {analysisResult.riskFactors && analysisResult.riskFactors.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>5. Risk Factors & Cascading Impact</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {analysisResult.riskFactors.map((risk, idx) => (
                      <li key={idx} className="flex items-start space-x-2 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30">
                        <span className="text-rose-400 font-bold shrink-0">&bull;</span>
                        <span className="text-rose-200">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SRE Runbook Commands */}
              {analysisResult.runbookCommands && analysisResult.runbookCommands.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                      <Terminal className="w-4 h-4" />
                      <span>SRE Mitigation Runbook</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Bash / Kubectl</span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    {analysisResult.runbookCommands.map((cmd, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 group"
                      >
                        <span className="text-emerald-300 overflow-x-auto custom-scrollbar select-all pr-2">
                          {cmd}
                        </span>
                        <button
                          id={`rca-copy-cmd-${idx}`}
                          onClick={() => handleCopy(cmd)}
                          title="Copy command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                        >
                          {copiedCmd === cmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 8. Prevention Suggestions */}
              {analysisResult.preventionSuggestions && analysisResult.preventionSuggestions.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>8. Prevention Suggestions & Architecture Hardening</span>
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {analysisResult.preventionSuggestions.map((rec, i) => (
                      <li key={i} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center space-y-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <Sparkles className="w-10 h-10 text-indigo-400 mx-auto opacity-40" />
              <p className="text-sm text-slate-300 font-semibold">Diagnostic Report Ready to Generate</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Choose a preset scenario on top or paste any error logs on the left, then click &quot;Generate AI Root-Cause Report&quot;.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
