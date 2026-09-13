import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  Plus,
  Filter,
  Sparkles,
  Clock,
  User,
  Zap,
  ArrowUpDown,
  CheckCircle2,
  Flame,
  Lock,
} from 'lucide-react';
import { Incident, Service, Severity, IncidentStatus } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useDebounce } from '../hooks/useDebounce.js';

interface IncidentsViewProps {
  incidents: Incident[];
  services: Service[];
  onSelectIncident: (incident: Incident) => void;
  onOpenCreateModal: () => void;
  onQuickAiRca: (incident: Incident) => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  services,
  onSelectIncident,
  onOpenCreateModal,
  onQuickAiRca,
}) => {
  const { canMutateIncidents, canRunAi, showForbiddenNotice } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');

  const filteredIncidents = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    return incidents.filter((inc) => {
      const matchesSearch =
        !term ||
        inc.id.toLowerCase().includes(term) ||
        inc.title.toLowerCase().includes(term) ||
        inc.description.toLowerCase().includes(term) ||
        inc.assignedEngineer.name.toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
      const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
      const matchesService = serviceFilter === 'ALL' || inc.serviceId === serviceFilter;

      return matchesSearch && matchesStatus && matchesSeverity && matchesService;
    });
  }, [incidents, debouncedSearch, statusFilter, severityFilter, serviceFilter]);

  const getSeverityBadgeClass = (severity: Severity) => {
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

  const getStatusBadgeClass = (status: IncidentStatus) => {
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

  return (
    <div id="incidents-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span>Incident Command & Triage</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Active service disruptions, AI-driven failure diagnosis, and engineer task assignments
          </p>
        </div>

        <button
          id="declare-incident-view-btn"
          onClick={() => {
            if (!canMutateIncidents) {
              showForbiddenNotice('Declare Incident', ['ADMIN', 'ENGINEER']);
              return;
            }
            onOpenCreateModal();
          }}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer self-start sm:self-auto ${
            canMutateIncidents
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {canMutateIncidents ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
          <span>Declare Incident</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/80 rounded-xl p-3">
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-incidents-input"
            type="text"
            placeholder="Search ID, title, or assignee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          <div className="flex items-center space-x-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700/60 overflow-x-auto custom-scrollbar">
            {(['ALL', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'] as const).map((status) => (
              <button
                key={status}
                id={`filter-incident-status-${status.toLowerCase()}`}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Severity selector */}
          <div className="flex items-center space-x-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700/60">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                id={`filter-incident-sev-${sev.toLowerCase()}`}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  severityFilter === sev
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Service Dropdown Filter */}
          <select
            id="filter-incident-service-select"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Services ({services.length})</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Incidents Table / Cards */}
      <div className="space-y-3">
        {filteredIncidents.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-80 mb-2" />
            <p className="text-sm text-slate-200 font-semibold">No Incidents Matching Filters</p>
            <p className="text-xs text-slate-400 mt-1">All monitored systems within specified parameters are nominal.</p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              id={`incident-row-${incident.id}`}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              {/* Left Column: ID, Severity, Status, Title, Service */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-400">{incident.id}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded font-mono ${getSeverityBadgeClass(incident.severity)}`}>
                    {incident.severity}
                  </span>
                  <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded font-mono ${getStatusBadgeClass(incident.status)}`}>
                    {incident.status}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    in <strong className="text-slate-300">{incident.serviceName}</strong>
                  </span>
                </div>

                <h3
                  onClick={() => onSelectIncident(incident)}
                  className="text-sm font-semibold text-white hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {incident.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-1">{incident.description}</p>
              </div>

              {/* Middle Column: Assignee & Created time */}
              <div className="flex items-center space-x-6 text-xs text-slate-400 shrink-0">
                <div className="flex items-center space-x-2">
                  {incident.assignedEngineer ? (
                    <>
                      <img
                        src={incident.assignedEngineer.avatar}
                        alt={incident.assignedEngineer.name}
                        className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-700"
                      />
                      <div>
                        <div className="text-slate-300 font-medium text-xs">{incident.assignedEngineer.name}</div>
                        <div className="text-[10px] text-slate-400">{incident.assignedEngineer.role}</div>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 text-xs italic">Unassigned</div>
                  )}
                </div>

                <div className="text-right font-mono text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1 justify-end">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(incident.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="text-slate-400">
                    {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Right Column: AI RCA and Inspect Action */}
              <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                {incident.aiAnalysis ? (
                  <button
                    id={`incidents-view-rca-${incident.id}`}
                    onClick={() => onSelectIncident(incident)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      AI RCA (
                      {typeof incident.aiAnalysis.confidenceScore === 'number' && !isNaN(incident.aiAnalysis.confidenceScore)
                        ? `${incident.aiAnalysis.confidenceScore}%`
                        : 'Unavailable'}
                      )
                    </span>
                  </button>
                ) : (
                  <button
                    id={`incidents-run-rca-${incident.id}`}
                    onClick={() => {
                      if (!canRunAi) {
                        showForbiddenNotice('Execute Gemini AI Incident Analysis', ['ADMIN', 'ENGINEER']);
                        return;
                      }
                      onQuickAiRca(incident);
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      canRunAi
                        ? 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border-slate-700'
                        : 'bg-slate-850 text-slate-400 border-slate-800 cursor-pointer'
                    }`}
                  >
                    {canRunAi ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{canRunAi ? 'Diagnose with AI' : 'Diagnose (Engineer)'}</span>
                  </button>
                )}

                <button
                  id={`open-incident-btn-${incident.id}`}
                  onClick={() => onSelectIncident(incident)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
                >
                  Manage
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
