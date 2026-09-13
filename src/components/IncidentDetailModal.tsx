import React, { useState } from 'react';
import {
  X,
  Sparkles,
  User,
  Clock,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  FileText,
  ShieldCheck,
  Zap,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { Incident, Engineer, Severity, IncidentStatus, IncidentHistoryEntry } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';

interface IncidentDetailModalProps {
  incident: Incident | null;
  engineers: Engineer[];
  onClose: () => void;
  onUpdateStatus: (incidentId: string, status: IncidentStatus) => void;
  onAssignEngineer: (incidentId: string, engineerId: string) => void;
  onResolveIncident: (incidentId: string, resolutionNotes: string) => void;
  onRunAiAnalysis: (incident: Incident) => Promise<void>;
  isAnalyzingAI: boolean;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  engineers,
  onClose,
  onUpdateStatus,
  onAssignEngineer,
  onResolveIncident,
  onRunAiAnalysis,
  isAnalyzingAI,
}) => {
  if (!incident) return null;

  const { canRunAi, canMutateIncidents, showForbiddenNotice } = useAuth();
  const [activeTab, setActiveTab] = useState<'ai-rca' | 'overview' | 'history' | 'logs' | 'resolution'>('ai-rca');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [resolutionInput, setResolutionInput] = useState(incident.resolutionNotes || '');
  const [localAiError, setLocalAiError] = useState<string | null>(null);
  const [historyEvents, setHistoryEvents] = useState<IncidentHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistory = React.useCallback(async () => {
    if (!incident) return;
    setIsLoadingHistory(true);
    try {
      const hist = await api.getIncidentHistory(incident.id);
      setHistoryEvents(hist);
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  }, [incident]);

  React.useEffect(() => {
    if (incident) {
      fetchHistory();
    }
  }, [incident, fetchHistory]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const getSeverityBadgeClass = (severity: Severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!canRunAi) {
      showForbiddenNotice('Execute Gemini AI Incident Analysis', ['ADMIN', 'ENGINEER']);
      return;
    }
    setLocalAiError(null);
    try {
      await onRunAiAnalysis(incident);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to complete AI incident analysis';
      setLocalAiError(msg);
    }
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateIncidents) {
      showForbiddenNotice('Resolve Incident', ['ADMIN', 'ENGINEER']);
      return;
    }
    onResolveIncident(incident.id, resolutionInput);
  };

  const handleStatusChange = (newStatus: IncidentStatus) => {
    if (!canMutateIncidents) {
      showForbiddenNotice('Change Incident Status', ['ADMIN', 'ENGINEER']);
      return;
    }
    onUpdateStatus(incident.id, newStatus);
  };

  const handleEngineerChange = (engineerId: string) => {
    if (!canMutateIncidents) {
      showForbiddenNotice('Assign Incident Responder', ['ADMIN', 'ENGINEER']);
      return;
    }
    onAssignEngineer(incident.id, engineerId);
  };

  const ai = incident.aiAnalysis;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        id="incident-detail-modal"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-900/90">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-400">{incident.id}</span>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded font-mono ${getSeverityBadgeClass(incident.severity)}`}>
                {incident.severity}
              </span>

              {/* Status Selector Dropdown */}
              <select
                id="incident-status-select"
                value={incident.status}
                onChange={(e) => handleStatusChange(e.target.value as IncidentStatus)}
                className="bg-slate-800 border border-slate-700 rounded-md px-2 py-0.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
              >
                <option value="OPEN">Status: OPEN</option>
                <option value="INVESTIGATING">Status: INVESTIGATING</option>
                <option value="RESOLVED">Status: RESOLVED</option>
                <option value="CLOSED">Status: CLOSED</option>
              </select>

              <span className="text-xs text-slate-400">
                Service: <strong className="text-slate-200">{incident.serviceName}</strong>
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white truncate">{incident.title}</h2>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Top Quick AI Action Button */}
            <button
              id="header-analyze-ai-btn"
              onClick={handleTriggerAnalysis}
              disabled={isAnalyzingAI}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                canRunAi
                  ? 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750'
              }`}
            >
              {canRunAi ? (
                <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>
                {!canRunAi
                  ? 'AI Analysis (Requires Engineer)'
                  : isAnalyzingAI
                  ? 'Analyzing...'
                  : ai
                  ? 'Re-analyze with AI'
                  : 'Analyze with AI'}
              </span>
            </button>

            <button
              id="close-incident-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center space-x-2 px-5 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            id="tab-btn-ai-rca"
            onClick={() => setActiveTab('ai-rca')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'ai-rca'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>AI Root-Cause & Runbooks</span>
            {ai && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                {typeof ai.confidenceScore === 'number' && !isNaN(ai.confidenceScore)
                  ? `${ai.confidenceScore}%`
                  : 'Confidence unavailable'}
              </span>
            )}
          </button>

          <button
            id="tab-btn-overview"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Incident Overview</span>
          </button>

          <button
            id="tab-btn-history"
            onClick={() => {
              setActiveTab('history');
              fetchHistory();
            }}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Timeline & History</span>
            {historyEvents.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
                {historyEvents.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-logs"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Telemetry & Logs</span>
          </button>

          <button
            id="tab-btn-resolution"
            onClick={() => setActiveTab('resolution')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'resolution'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Resolution & Notes</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5">
          {/* TAB 1: AI ROOT CAUSE & RUNBOOKS */}
          {activeTab === 'ai-rca' && (
            <div className="space-y-5">
              {/* AI Status / Controls Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white">Gemini AI Root-Cause Diagnostic</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        AI-Generated Analysis
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Model: <span className="font-mono text-slate-300">{ai?.modelUsed || 'gemini-3.8-flash'}</span>
                      {ai?.analyzedAt && ` • Generated ${new Date(ai.analyzedAt).toLocaleTimeString()}`}
                    </p>
                  </div>
                </div>

                <button
                  id="tab-analyze-ai-btn"
                  onClick={handleTriggerAnalysis}
                  disabled={isAnalyzingAI}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingAI ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzingAI ? 'Querying Gemini...' : ai ? 'Regenerate Analysis' : 'Analyze with AI'}</span>
                </button>
              </div>

              {/* Error State */}
              {localAiError && (
                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
                      localAiError.includes('503') || localAiError.toLowerCase().includes('high demand')
                        ? 'bg-amber-950/60 border-amber-800/80 text-amber-200'
                        : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                    }`}
                  >
                    <AlertCircle
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        localAiError.includes('503') || localAiError.toLowerCase().includes('high demand')
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    />
                    <div className="flex-1 space-y-1">
                      <div
                        className={`font-semibold ${
                          localAiError.includes('429') || localAiError.toLowerCase().includes('rate limit') || localAiError.toLowerCase().includes('quota')
                            ? 'text-orange-300'
                            : localAiError.includes('503') || localAiError.toLowerCase().includes('high demand')
                            ? 'text-amber-300'
                            : localAiError.includes('504') || localAiError.toLowerCase().includes('timed out')
                            ? 'text-yellow-300'
                            : 'text-rose-300'
                        }`}
                      >
                        {localAiError.includes('429') || localAiError.toLowerCase().includes('rate limit') || localAiError.toLowerCase().includes('quota')
                          ? 'Gemini AI Rate Limit / Quota Exceeded (429)'
                          : localAiError.includes('503') || localAiError.toLowerCase().includes('high demand')
                          ? 'Gemini AI Service Under High Demand (503)'
                          : localAiError.includes('504') || localAiError.toLowerCase().includes('timed out')
                          ? 'Gemini AI Analysis Request Timed Out (504)'
                          : 'Gemini AI Analysis Request Notice'}
                      </div>
                      <p className="leading-relaxed font-sans opacity-90">{localAiError}</p>
                      <div className="pt-2 flex items-center space-x-3">
                        <button
                          onClick={handleTriggerAnalysis}
                          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                            localAiError.includes('503') || localAiError.toLowerCase().includes('high demand')
                              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                              : 'bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-700'
                          }`}
                        >
                          Retry Now
                        </button>
                        <span className="text-[11px] text-slate-400">
                          Automated exponential backoff will retry up to 3 times.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Explicit Confidence Unavailable Card */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                        AI confidence based on available evidence:
                      </span>
                      <span className="font-mono font-bold text-amber-400">Confidence unavailable</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      A genuine AI analysis was not successfully generated.
                    </span>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isAnalyzingAI && (
                <div className="py-16 text-center space-y-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-sm font-semibold text-white">Analyzing incident with Gemini 3.8 Flash...</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Correlating service topology, stack traces, recent cluster incidents, and performance metrics into a structured root-cause assessment.
                  </p>
                </div>
              )}

              {/* Empty State */}
              {!ai && !isAnalyzingAI && !localAiError && (
                <div className="text-center py-14 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3 p-6">
                  <Sparkles className="w-10 h-10 text-indigo-400 mx-auto opacity-70" />
                  <h4 className="text-sm text-slate-200 font-semibold">No AI Analysis Generated Yet</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Trigger Gemini AI to evaluate this incident. Gemini will analyze the title, description, affected service metrics, error logs, and recent incidents to produce an evidence-based root-cause diagnosis and actionable runbooks.
                  </p>
                  <div className="pt-2">
                    <button
                      id="empty-state-analyze-btn"
                      onClick={handleTriggerAnalysis}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all inline-flex items-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Analyze with AI</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Success State: Structured 8 Sections */}
              {ai && !isAnalyzingAI && (
                <div className="space-y-4">
                  {/* Top Bar: Confidence Score & Severity Assessment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Confidence Score Bar */}
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                          AI confidence based on available evidence
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {typeof ai.confidenceScore === 'number' && !isNaN(ai.confidenceScore)
                            ? `${ai.confidenceScore}%`
                            : 'Confidence unavailable'}
                        </span>
                      </div>
                      {typeof ai.confidenceScore === 'number' && !isNaN(ai.confidenceScore) ? (
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-emerald-400"
                            style={{ width: `${ai.confidenceScore}%` }}
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
                        {ai.severityAssessment || `Evaluated as ${incident.severity} based on current customer impact.`}
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
                      {ai.incidentSummary || incident.description}
                    </p>
                  </div>

                  {/* 2. Probable Root Cause */}
                  <div className="bg-slate-800/80 border border-amber-500/30 rounded-xl p-4 bg-gradient-to-br from-slate-900 to-amber-950/20">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>2. Probable Root Cause</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-100 font-sans font-medium leading-relaxed">
                      {ai.probableRootCause || ai.rootCauseSummary}
                    </p>
                  </div>

                  {/* 3. Possible Alternative Causes */}
                  {ai.possibleAlternativeCauses && ai.possibleAlternativeCauses.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                        <HelpCircle className="w-4 h-4 text-indigo-400" />
                        <span>3. Possible Alternative Causes</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {ai.possibleAlternativeCauses.map((cause, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-indigo-400 font-bold shrink-0">&bull;</span>
                            <span className="text-slate-200">{cause}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 4. Recommended Troubleshooting Steps */}
                  {ai.recommendedTroubleshootingSteps && ai.recommendedTroubleshootingSteps.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>4. Recommended Troubleshooting Steps</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        {ai.recommendedTroubleshootingSteps.map((step, idx) => (
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
                  {ai.riskFactors && ai.riskFactors.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>5. Risk Factors & Cascading Impact</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {ai.riskFactors.map((risk, idx) => (
                          <li key={idx} className="flex items-start space-x-2 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30">
                            <span className="text-rose-400 font-bold shrink-0">&bull;</span>
                            <span className="text-rose-200">{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* SRE Runbook Commands */}
                  {ai.runbookCommands && ai.runbookCommands.length > 0 && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                          <Terminal className="w-4 h-4" />
                          <span>SRE Mitigation Runbook Commands</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">Bash / Kubectl</span>
                      </div>

                      <div className="space-y-2 font-mono text-xs">
                        {ai.runbookCommands.map((cmd, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 group"
                          >
                            <span className="text-emerald-300 overflow-x-auto custom-scrollbar select-all pr-2">
                              {cmd}
                            </span>
                            <button
                              id={`copy-cmd-${idx}`}
                              onClick={() => handleCopy(cmd)}
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
                  {ai.preventionSuggestions && ai.preventionSuggestions.length > 0 && (
                    <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                        <span>8. Prevention Suggestions & Architecture Hardening</span>
                      </h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                        {ai.preventionSuggestions.map((rec, idx) => (
                          <li key={idx} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OVERVIEW & CONTEXT */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Incident Description</h3>
                <p className="text-sm text-slate-200 leading-relaxed font-sans">{incident.description}</p>
              </div>

              {/* Service & Assignment Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Service</h3>
                  <div className="text-sm font-semibold text-white">{incident.serviceName}</div>
                  <div className="text-xs text-slate-400">Service ID: {incident.serviceId}</div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Engineer</h3>
                  {incident.assignedEngineer ? (
                    <div className="flex items-center space-x-3">
                      <img
                        src={incident.assignedEngineer.avatar}
                        alt={incident.assignedEngineer.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">{incident.assignedEngineer.name}</div>
                        <div className="text-[11px] text-slate-400">{incident.assignedEngineer.role}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No engineer currently assigned.</div>
                  )}

                  {/* Reassign Dropdown */}
                  <div className="pt-2 border-t border-slate-700/60">
                    <label className="block text-[11px] text-slate-400 mb-1">Reassign to engineer:</label>
                    <select
                      id="reassign-engineer-select"
                      value={incident.assignedEngineer?.id || ''}
                      onChange={(e) => handleEngineerChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Select Engineer --</option>
                      {engineers.map((eng) => (
                        <option key={eng.id} value={eng.id}>
                          {eng.name} ({eng.role}) {eng.status === 'ON_CALL' ? '• ON-CALL' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">DECLARED AT</span>
                  <span className="text-slate-200">{new Date(incident.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">LAST UPDATED</span>
                  <span className="text-slate-200">{new Date(incident.updatedAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RESOLVED AT</span>
                  <span className="text-slate-200">
                    {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TIMELINE & INCIDENT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Persistent Incident Audit Trail
                    </h3>
                  </div>
                  <button
                    onClick={fetchHistory}
                    className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {isLoadingHistory && historyEvents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">Loading incident history from database...</div>
                ) : historyEvents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No history events recorded for this incident yet.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                    {historyEvents.map((evt) => {
                      const getBadge = (type: string) => {
                        switch (type) {
                          case 'CREATED':
                            return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
                          case 'ASSIGNED':
                            return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
                          case 'AI_ANALYZED':
                            return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
                          case 'STATUS_CHANGED':
                            return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
                          case 'SEVERITY_CHANGED':
                            return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
                          case 'RESOLVED':
                            return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                          default:
                            return 'bg-slate-700 text-slate-300';
                        }
                      };

                      return (
                        <div key={evt.id} className="relative group">
                          {/* Dot */}
                          <div className="absolute -left-[1.65rem] top-1 w-3 h-3 rounded-full bg-slate-900 border-2 border-indigo-500" />
                          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getBadge(evt.actionType)}`}>
                                {evt.actionType}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(evt.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-200 font-medium">{evt.description}</p>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                              <span>Actor: <strong className="text-slate-300">{evt.performedByName}</strong></span>
                              {evt.newValue && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  {evt.oldValue ? `${evt.oldValue} → ` : ''}{evt.newValue}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ERROR LOGS & STACK TRACES */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Raw Stack Traces & Diagnostic Logs</span>
                <button
                  id="copy-logs-btn"
                  onClick={() => handleCopy(incident.errorLogs)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Logs</span>
                </button>
              </div>

              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-rose-300 overflow-x-auto custom-scrollbar max-h-96 leading-relaxed select-all">
                {incident.errorLogs}
              </pre>
            </div>
          )}

          {/* TAB 4: RESOLUTION & NOTES */}
          {activeTab === 'resolution' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Incident Resolution Notes & Post-Mortem Record
                </h3>
                <form onSubmit={handleResolveSubmit} className="space-y-3">
                  <textarea
                    id="resolution-notes-textarea"
                    rows={6}
                    placeholder="Document root cause mitigation, deploy hashes, rollback actions, and validation tests performed..."
                    value={resolutionInput}
                    onChange={(e) => setResolutionInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                  />

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400">
                      Saving resolution notes will mark incident status as <strong className="text-emerald-400">RESOLVED</strong>.
                    </span>
                    <button
                      type="submit"
                      id="save-resolution-btn"
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      Save & Mark Resolved
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
