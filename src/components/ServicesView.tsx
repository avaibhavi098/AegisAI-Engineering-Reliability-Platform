import React, { useState, useMemo } from 'react';
import {
  Server,
  Search,
  Plus,
  Activity,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Layers,
  Clock,
  Radio,
  Sliders,
  Lock,
} from 'lucide-react';
import { Service, ServiceStatus } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { useDebounce } from '../hooks/useDebounce.js';

interface ServicesViewProps {
  services: Service[];
  onUpdateServiceStatus: (serviceId: string, newStatus: ServiceStatus) => void;
  onCreateService: (data: Partial<Service>) => void;
  onTriggerIncidentForService: (service: Service) => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  onUpdateServiceStatus,
  onCreateService,
  onTriggerIncidentForService,
}) => {
  const { canManageServices, canMutateIncidents, showForbiddenNotice } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ServiceStatus>('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'TIER-1' | 'TIER-2' | 'TIER-3'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New service form state
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<'TIER-1' | 'TIER-2' | 'TIER-3'>('TIER-1');
  const [ownerTeam, setOwnerTeam] = useState('Core Infrastructure');
  const [dependenciesInput, setDependenciesInput] = useState('');

  const filteredServices = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    return services.filter((s) => {
      const matchesSearch =
        !term ||
        s.name.toLowerCase().includes(term) ||
        s.key.toLowerCase().includes(term) ||
        s.ownerTeam.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const matchesTier = tierFilter === 'ALL' || s.tier === tierFilter;
      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [services, debouncedSearch, statusFilter, tierFilter]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    const deps = dependenciesInput
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    onCreateService({
      name,
      key: key.toLowerCase().replace(/\s+/g, '-'),
      description: description || 'Mission-critical engineering microservice.',
      tier,
      ownerTeam,
      status: 'HEALTHY',
      dependencies: deps,
    });

    setName('');
    setKey('');
    setDescription('');
    setDependenciesInput('');
    setShowAddModal(false);
  };

  return (
    <div id="services-view" className="space-y-6">
      {/* Header with Search and Add Service button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <Server className="w-5 h-5 text-indigo-400" />
            <span>Service Monitoring & Topology</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry, health probes, latency distributions, and circuit state
          </p>
        </div>

        <button
          id="register-service-btn"
          onClick={() => {
            if (!canManageServices) {
              showForbiddenNotice('Register New Service', ['ADMIN']);
              return;
            }
            setShowAddModal(true);
          }}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer self-start sm:self-auto ${
            canManageServices
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {canManageServices ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
          <span>Register Service</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-services-input"
            type="text"
            placeholder="Filter by name, key, or owner team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          <div className="flex items-center space-x-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700/60">
            {(['ALL', 'HEALTHY', 'DEGRADED', 'DOWN'] as const).map((status) => (
              <button
                key={status}
                id={`filter-status-${status.toLowerCase()}`}
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

          <div className="flex items-center space-x-1 bg-slate-800/90 rounded-lg p-1 border border-slate-700/60">
            {(['ALL', 'TIER-1', 'TIER-2', 'TIER-3'] as const).map((t) => (
              <button
                key={t}
                id={`filter-tier-${t.toLowerCase()}`}
                onClick={() => setTierFilter(t)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  tierFilter === t
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            id={`service-card-${service.id}`}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              {/* Top Row: Title, Tier & Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">{service.name}</h3>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {service.tier}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono mt-0.5 block">{service.key}</span>
                </div>

                {/* Status indicator badge */}
                <div>
                  {service.status === 'HEALTHY' && (
                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>HEALTHY</span>
                    </span>
                  )}
                  {service.status === 'DEGRADED' && (
                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                      <span>DEGRADED</span>
                    </span>
                  )}
                  {service.status === 'DOWN' && (
                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
                      <span>DOWN</span>
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{service.description}</p>
            </div>

            {/* Telemetry Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">P99 LATENCY</span>
                <span className={`font-bold ${service.latencyMs > 300 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {service.latencyMs}ms
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ERROR RATE</span>
                <span className={`font-bold ${service.errorRate > 1.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {service.errorRate}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">UPTIME</span>
                <span className="font-bold text-emerald-400">{service.uptimePercent}%</span>
              </div>
            </div>

            {/* Meta: Dependencies & Team */}
            <div className="space-y-1.5 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Team:</span>
                <span className="text-slate-300 font-medium">{service.ownerTeam}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Throughput:</span>
                <span className="text-slate-300 font-mono">{service.requestRateRps.toLocaleString()} rps</span>
              </div>
              {service.dependencies.length > 0 && (
                <div className="flex items-start space-x-1 pt-1">
                  <Layers className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {service.dependencies.map((dep) => (
                      <span key={dep} className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SRE Action & Chaos Injection Controls */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-slate-400 mr-1 flex items-center">
                  <Sliders className="w-3 h-3 mr-1" />
                  State:
                </span>
                <button
                  id={`set-healthy-${service.id}`}
                  title={canManageServices ? 'Mark Healthy' : 'Requires Admin'}
                  onClick={() => {
                    if (!canManageServices) {
                      showForbiddenNotice('Update Service Health State', ['ADMIN']);
                      return;
                    }
                    onUpdateServiceStatus(service.id, 'HEALTHY');
                  }}
                  className={`p-1 rounded text-[10px] font-mono transition-colors ${
                    service.status === 'HEALTHY'
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  OK
                </button>
                <button
                  id={`set-degraded-${service.id}`}
                  title={canManageServices ? 'Simulate Degradation' : 'Requires Admin'}
                  onClick={() => {
                    if (!canManageServices) {
                      showForbiddenNotice('Simulate Service Degradation', ['ADMIN']);
                      return;
                    }
                    onUpdateServiceStatus(service.id, 'DEGRADED');
                  }}
                  className={`p-1 rounded text-[10px] font-mono transition-colors ${
                    service.status === 'DEGRADED'
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  WARN
                </button>
                <button
                  id={`set-down-${service.id}`}
                  title={canManageServices ? 'Simulate Outage' : 'Requires Admin'}
                  onClick={() => {
                    if (!canManageServices) {
                      showForbiddenNotice('Simulate Service Outage', ['ADMIN']);
                      return;
                    }
                    onUpdateServiceStatus(service.id, 'DOWN');
                  }}
                  className={`p-1 rounded text-[10px] font-mono transition-colors ${
                    service.status === 'DOWN'
                      ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  DOWN
                </button>
              </div>

              <button
                id={`trigger-incident-for-${service.id}`}
                onClick={() => {
                  if (!canMutateIncidents) {
                    showForbiddenNotice('Declare Incident for Service', ['ADMIN', 'ENGINEER']);
                    return;
                  }
                  onTriggerIncidentForService(service);
                }}
                className="text-[11px] font-medium text-rose-400 hover:text-rose-300 flex items-center space-x-1 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Declare Incident</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Register Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-base font-bold text-white mb-1">Register New Production Service</h2>
            <p className="text-xs text-slate-400 mb-4">
              Add a microservice to AegisAI reliability telemetry and synthetic heartbeat probes.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Service Display Name</label>
                <input
                  id="new-service-name"
                  type="text"
                  placeholder="e.g. Identity Token Broker"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!key) {
                      setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Service Key</label>
                  <input
                    id="new-service-key"
                    type="text"
                    placeholder="e.g. token-broker-api"
                    required
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tier / Criticality</label>
                  <select
                    id="new-service-tier"
                    value={tier}
                    onChange={(e) => setTier(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TIER-1">Tier-1 (Mission Critical)</option>
                    <option value="TIER-2">Tier-2 (Core Business)</option>
                    <option value="TIER-3">Tier-3 (Auxiliary / Internal)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Owner Engineering Team</label>
                <input
                  id="new-service-owner"
                  type="text"
                  placeholder="e.g. Identity & Access SRE"
                  value={ownerTeam}
                  onChange={(e) => setOwnerTeam(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  id="new-service-desc"
                  rows={2}
                  placeholder="Responsibilities, ingress gateways, and SLA expectations..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Dependencies (comma-separated keys)</label>
                <input
                  id="new-service-deps"
                  type="text"
                  placeholder="e.g. auth-gateway, database-postgres-primary"
                  value={dependenciesInput}
                  onChange={(e) => setDependenciesInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  id="cancel-add-service-btn"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-add-service-btn"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Register Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
