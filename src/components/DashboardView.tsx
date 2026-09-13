import React from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Activity,
  Cpu,
  User,
  Zap,
  Lock,
} from 'lucide-react';
import { Service, Incident, ReliabilityMetrics } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

interface DashboardViewProps {
  metrics: ReliabilityMetrics | null;
  services: Service[];
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onNavigateTab: (tab: any) => void;
  onQuickAiRca: (incident: Incident) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  services,
  incidents,
  onSelectIncident,
  onNavigateTab,
  onQuickAiRca,
}) => {
  const { canRunAi, showForbiddenNotice } = useAuth();
  const recentIncidents = incidents.slice(0, 5);

  const getSeverityBadgeClass = (severity: Incident['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    }
  };

  const getStatusBadgeClass = (status: Incident['status']) => {
    switch (status) {
      case 'OPEN':
        return 'bg-rose-950/60 text-rose-300 border border-rose-700/50';
      case 'INVESTIGATING':
        return 'bg-amber-950/60 text-amber-300 border border-amber-700/50';
      case 'RESOLVED':
        return 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50';
      case 'CLOSED':
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  const getServiceStatusBadge = (status: Service['status']) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>HEALTHY</span>
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>DEGRADED</span>
          </span>
        );
      case 'DOWN':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
            <span>DOWN</span>
          </span>
        );
    }
  };

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Top Banner Status Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">System Reliability Control Center</h1>
            <p className="text-xs text-slate-400">
              Live observability, automated incident response, and Gemini AI root-cause correlation
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            id="dash-run-ai-workbench-btn"
            onClick={() => onNavigateTab('ai-rca')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Launch AI RCA Studio</span>
          </button>
          <button
            id="dash-view-slo-btn"
            onClick={() => onNavigateTab('metrics')}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
          >
            <span>SLO Analytics</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 6 Key Stat KPI Cards as specified */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Services */}
        <div
          id="stat-total-services"
          onClick={() => onNavigateTab('services')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Total Services</span>
            <Server className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics?.totalServices ?? services.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Tier-1 & Tier-2 services</p>
        </div>

        {/* Healthy Services */}
        <div
          id="stat-healthy-services"
          onClick={() => onNavigateTab('services')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-emerald-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Healthy Services</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {metrics?.healthyServices ?? services.filter((s) => s.status === 'HEALTHY').length}
          </div>
          <p className="text-[11px] text-emerald-400/80 mt-1">Operating normally</p>
        </div>

        {/* Services with Warnings */}
        <div
          id="stat-warning-services"
          onClick={() => onNavigateTab('services')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-amber-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Services w/ Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {metrics?.warningServices ?? services.filter((s) => s.status === 'DEGRADED').length}
          </div>
          <p className="text-[11px] text-amber-400/80 mt-1">Degraded latency/errors</p>
        </div>

        {/* Active Incidents */}
        <div
          id="stat-active-incidents"
          onClick={() => onNavigateTab('incidents')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-indigo-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Active Incidents</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.activeIncidents ?? incidents.filter((i) => i.status === 'OPEN' || i.status === 'INVESTIGATING').length}
          </div>
          <p className="text-[11px] text-indigo-300 mt-1">In triage or mitigation</p>
        </div>

        {/* Critical Incidents */}
        <div
          id="stat-critical-incidents"
          onClick={() => onNavigateTab('incidents')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-rose-500/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Critical Incidents</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {metrics?.criticalIncidents ?? incidents.filter((i) => (i.status === 'OPEN' || i.status === 'INVESTIGATING') && i.severity === 'CRITICAL').length}
          </div>
          <p className="text-[11px] text-rose-400/80 mt-1">Immediate SRE attention</p>
        </div>

        {/* Average Incident Resolution Time */}
        <div
          id="stat-avg-resolution-time"
          onClick={() => onNavigateTab('history')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Avg Resolution Time</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.averageResolutionMinutes !== null && metrics?.averageResolutionMinutes !== undefined ? (
              <>
                {metrics.averageResolutionMinutes}
                <span className="text-sm font-normal text-slate-400 ml-1">min</span>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-normal">No data available</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">MTTR across resolved incidents</p>
        </div>
      </div>

      {/* Main Content Layout: Service Health Overview + Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Service Health Overview (5 cols on lg) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Service Health Overview</h2>
            </div>
            <button
              id="view-all-services-link"
              onClick={() => onNavigateTab('services')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>Manage all ({services.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {services.map((srv) => (
              <div
                key={srv.id}
                id={`dashboard-service-${srv.id}`}
                onClick={() => onNavigateTab('services')}
                className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                      {srv.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      {srv.tier}
                    </span>
                  </div>
                  {getServiceStatusBadge(srv.status)}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-700/40 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">LATENCY</span>
                    <span className={`font-semibold ${srv.latencyMs > 300 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {srv.latencyMs}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">ERROR RATE</span>
                    <span className={`font-semibold ${srv.errorRate > 1.0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {srv.errorRate}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">UPTIME</span>
                    <span className="font-semibold text-emerald-400">{srv.uptimePercent}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents (7 cols on lg) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold text-white">Recent Incidents</h2>
            </div>
            <button
              id="view-all-incidents-link"
              onClick={() => onNavigateTab('incidents')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              <span>View incident board ({incidents.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentIncidents.map((incident) => (
              <div
                key={incident.id}
                id={`recent-incident-${incident.id}`}
                className="p-4 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{incident.id}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${getSeverityBadgeClass(incident.severity)}`}>
                        {incident.severity}
                      </span>
                      <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded font-mono ${getStatusBadgeClass(incident.status)}`}>
                        {incident.status}
                      </span>
                    </div>
                    <h3
                      onClick={() => onSelectIncident(incident)}
                      className="text-sm font-medium text-slate-100 hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                      {incident.title}
                    </h3>
                  </div>

                  {/* AI RCA Quick Badge / Trigger */}
                  {incident.aiAnalysis ? (
                    <button
                      id={`view-rca-${incident.id}`}
                      onClick={() => onSelectIncident(incident)}
                      className="shrink-0 flex items-center space-x-1.5 px-2.5 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs transition-colors"
                      title="AI Root Cause Analysis generated"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span className="text-[11px] font-medium">AI RCA Ready</span>
                    </button>
                  ) : (
                    <button
                      id={`quick-rca-btn-${incident.id}`}
                      onClick={() => {
                        if (!canRunAi) {
                          showForbiddenNotice('Execute Gemini AI Incident Analysis', ['ADMIN', 'ENGINEER']);
                          return;
                        }
                        onQuickAiRca(incident);
                      }}
                      className="shrink-0 flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs transition-colors cursor-pointer"
                      title={canRunAi ? 'Run Gemini AI Root Cause Analysis' : 'Requires Engineer or Admin privileges'}
                    >
                      {canRunAi ? <Zap className="w-3 h-3 text-amber-400" /> : <Lock className="w-3 h-3 text-amber-400" />}
                      <span className="text-[11px] font-medium">{canRunAi ? 'Run AI RCA' : 'AI RCA (Engineer)'}</span>
                    </button>
                  )}
                </div>

                {/* AI Root Cause Teaser if present */}
                {incident.aiAnalysis && (
                  <div className="bg-slate-900/90 rounded-md p-2.5 border border-indigo-950/60 text-xs text-slate-300">
                    <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold text-[11px] mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>
                        Probable Root Cause (
                        {typeof incident.aiAnalysis.confidenceScore === 'number' && !isNaN(incident.aiAnalysis.confidenceScore)
                          ? `${incident.aiAnalysis.confidenceScore}% confidence`
                          : 'Confidence unavailable'}
                        ):
                      </span>
                    </div>
                    <p className="line-clamp-2 text-slate-300 font-mono text-[11px] leading-relaxed">
                      {incident.aiAnalysis.rootCauseSummary}
                    </p>
                  </div>
                )}

                {/* Footer details: Service, Assigned Engineer, Timestamp */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/40">
                  <span className="font-medium text-slate-300">{incident.serviceName}</span>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300 text-[11px]">{incident.assignedEngineer?.name || 'Unassigned'}</span>
                    </div>

                    <div className="flex items-center space-x-1 text-slate-500 text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <button
                      id={`inspect-incident-${incident.id}`}
                      onClick={() => onSelectIncident(incident)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Details &rarr;
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
