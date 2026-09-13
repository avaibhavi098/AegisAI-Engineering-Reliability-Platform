import React from 'react';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  FileText,
  Sparkles,
  Users,
  History,
  BarChart3,
  Settings,
  PlusCircle,
  Server,
  ChevronDown,
  RefreshCw,
  LogOut,
  ShieldCheck,
  UserCheck,
  Eye,
  Lock,
  HeartPulse,
} from 'lucide-react';
import { Engineer, ReliabilityMetrics, UserRole } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

export type NavTab =
  | 'dashboard'
  | 'services'
  | 'incidents'
  | 'monitoring'
  | 'logs'
  | 'ai-rca'
  | 'engineers'
  | 'history'
  | 'metrics'
  | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentEngineer: Engineer | null;
  engineers: Engineer[];
  onSwitchEngineer: (id: string) => void;
  onOpenCreateIncident: () => void;
  metrics: ReliabilityMetrics | null;
  onRefreshData: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  currentEngineer,
  engineers,
  onSwitchEngineer,
  onOpenCreateIncident,
  metrics,
  onRefreshData,
  isRefreshing,
}) => {
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const { user, role, logout, quickLogin, canMutateIncidents, showForbiddenNotice } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'services', label: 'Services', icon: Server, badge: metrics?.warningServices ? metrics.warningServices + metrics.downServices : undefined },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: metrics?.activeIncidents || undefined },
    { id: 'monitoring', label: 'System Health', icon: HeartPulse },
    { id: 'logs', label: 'Log Analysis', icon: FileText },
    { id: 'ai-rca', label: 'AI RCA Studio', icon: Sparkles },
    { id: 'engineers', label: 'On-Call & Team', icon: Users },
    { id: 'history', label: 'History & Postmortems', icon: History },
    { id: 'metrics', label: 'SLO & Metrics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleDeclareIncidentClick = () => {
    if (!canMutateIncidents) {
      showForbiddenNotice('Declare Incident', ['ADMIN', 'ENGINEER']);
      return;
    }
    onOpenCreateIncident();
  };

  const handleQuickRoleSwitch = async (targetRole: UserRole) => {
    setShowUserMenu(false);
    await quickLogin(targetRole);
  };

  return (
    <header id="aegis-header" className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-lg">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/10">
              <ShieldAlert className="w-6 h-6 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white font-mono">AegisAI</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  PROD • 99.98%
                </span>
                {/* Active Role Badge */}
                {role && (
                  <span
                    id="navbar-user-role-badge"
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono border ${
                      role === 'ADMIN'
                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                        : role === 'ENGINEER'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    }`}
                  >
                    {role}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Engineering Reliability & AI Root-Cause Platform</p>
            </div>
          </div>

          {/* Quick Actions & Engineer Switcher */}
          <div className="flex items-center space-x-3">
            <button
              id="refresh-data-btn"
              onClick={onRefreshData}
              title="Refresh telemetry and incidents"
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              id="header-declare-incident-btn"
              onClick={handleDeclareIncidentClick}
              title={canMutateIncidents ? 'Declare a new service incident' : 'Requires Engineer or Admin privileges'}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
                canMutateIncidents
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
              }`}
            >
              {canMutateIncidents ? <PlusCircle className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>Declare Incident</span>
            </button>

            {/* User Profile & Role Switcher */}
            <div className="relative">
              <button
                id="engineer-profile-toggle"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition-all text-left cursor-pointer"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-500/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-700 text-white text-xs flex items-center justify-center font-bold">
                    {user?.name?.slice(0, 2) || 'OP'}
                  </div>
                )}
                <div className="hidden md:block">
                  <div className="text-xs font-medium text-slate-200">{user?.name || 'Operator'}</div>
                  <div className="text-[10px] text-indigo-400 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                    <span>{user?.role || 'VIEWER'}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div
                  id="user-auth-dropdown"
                  className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* Current Account Details */}
                  <div className="px-3.5 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">{user?.email}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{user?.title || 'Platform Operator'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                        {role}
                      </span>
                    </div>
                  </div>

                  {/* Switch Role Section */}
                  <div className="px-3.5 py-2 border-b border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Switch Role (RBAC Testing)
                    </p>
                    <div className="space-y-1">
                      <button
                        onClick={() => handleQuickRoleSwitch('ADMIN')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          role === 'ADMIN'
                            ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/50'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Platform Admin</span>
                        </span>
                        {role === 'ADMIN' && <span className="text-[10px] text-indigo-400 font-mono font-bold">Active</span>}
                      </button>

                      <button
                        onClick={() => handleQuickRoleSwitch('ENGINEER')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          role === 'ENGINEER'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>SRE Engineer</span>
                        </span>
                        {role === 'ENGINEER' && <span className="text-[10px] text-emerald-400 font-mono font-bold">Active</span>}
                      </button>

                      <button
                        onClick={() => handleQuickRoleSwitch('VIEWER')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          role === 'VIEWER'
                            ? 'bg-sky-950/60 text-sky-300 border border-sky-700/50'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                          <span>Observability Viewer</span>
                        </span>
                        {role === 'VIEWER' && <span className="text-[10px] text-sky-400 font-mono font-bold">Active</span>}
                      </button>
                    </div>
                  </div>

                  {/* Sign Out Button */}
                  <div className="pt-1 px-1">
                    <button
                      id="navbar-logout-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out from AegisAI</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto custom-scrollbar py-2 border-t border-slate-800/80 -mb-px">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/90 text-white shadow-sm ring-1 ring-indigo-400/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-white text-indigo-700' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
