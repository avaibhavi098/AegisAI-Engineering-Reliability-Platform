/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Navbar, NavTab } from './components/Navbar.js';
import { DashboardView } from './components/DashboardView.js';
import { ServicesView } from './components/ServicesView.js';
import { IncidentsView } from './components/IncidentsView.js';
import { LogAnalysisView } from './components/LogAnalysisView.js';
import { AiRcaStudioView } from './components/AiRcaStudioView.js';
import { EngineersView } from './components/EngineersView.js';
import { HistoryView } from './components/HistoryView.js';
import { MetricsView } from './components/MetricsView.js';
import { MonitoringView } from './components/MonitoringView.js';
import { SettingsView } from './components/SettingsView.js';
import { IncidentDetailModal } from './components/IncidentDetailModal.js';
import { CreateIncidentModal } from './components/CreateIncidentModal.js';
import { api } from './services/api.js';
import {
  Service,
  Incident,
  Engineer,
  LogEntry,
  AdminSettings,
  ReliabilityMetrics,
  ServiceStatus,
  IncidentStatus,
  Severity,
  AIAnalysisResult,
} from './types/index.js';
import { ShieldCheck, Sparkles, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginView } from './components/LoginView.js';
import { AccessDeniedModal } from './components/AccessDeniedModal.js';

function AegisAppContent() {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<ReliabilityMetrics | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [currentEngineer, setCurrentEngineer] = useState<Engineer | null>(null);

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showCreateIncidentModal, setShowCreateIncidentModal] = useState(false);
  const [createForServiceId, setCreateForServiceId] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type?: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const [
        loadedServices,
        loadedIncidents,
        loadedEngineers,
        loadedLogs,
        loadedMetrics,
        loadedSettings,
        currentUser,
      ] = await Promise.all([
        api.getServices(),
        api.getIncidents(),
        api.getEngineers(),
        api.getLogs(),
        api.getMetrics(),
        api.getSettings(),
        api.getCurrentUser(),
      ]);

      setServices(loadedServices);
      setIncidents(loadedIncidents);
      setEngineers(loadedEngineers);
      setLogs(loadedLogs);
      setMetrics(loadedMetrics);
      setSettings(loadedSettings);
      const matchingEngineer = loadedEngineers.find((e) => e.email === currentUser?.email) || loadedEngineers[0] || null;
      setCurrentEngineer(matchingEngineer);

      // Keep selected incident updated if modal is currently open
      if (selectedIncident) {
        const found = loadedIncidents.find((i) => i.id === selectedIncident.id);
        if (found) setSelectedIncident(found);
      }
    } catch (err) {
      console.error('Failed to load AegisAI system data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedIncident]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      // Periodic background sync every 45 seconds
      const interval = setInterval(() => {
        loadData(true);
      }, 45000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user?.id, loadData]);

  // --- Handlers ---
  const handleSwitchEngineer = (id: string) => {
    const target = engineers.find((e) => e.id === id);
    if (target) {
      setCurrentEngineer(target);
      showToast(`Selected engineer profile: ${target.name} (${target.role})`, 'info');
    }
  };

  const handleUpdateServiceStatus = async (serviceId: string, newStatus: ServiceStatus) => {
    try {
      const updated = await api.updateService(serviceId, { status: newStatus });
      setServices((prev) => prev.map((s) => (s.id === serviceId ? updated : s)));
      const refreshedMetrics = await api.getMetrics();
      setMetrics(refreshedMetrics);
      showToast(`Updated ${updated.name} state to ${newStatus}`, newStatus === 'HEALTHY' ? 'success' : 'warn');
    } catch (e) {
      console.error('Update service status failed', e);
    }
  };

  const handleCreateService = async (serviceData: Partial<Service>) => {
    try {
      const created = await api.createService(serviceData);
      setServices((prev) => [...prev, created]);
      const refreshedMetrics = await api.getMetrics();
      setMetrics(refreshedMetrics);
      showToast(`Service ${created.name} registered into reliability topology`);
    } catch (e) {
      console.error('Register service failed', e);
    }
  };

  const handleCreateIncident = async (data: {
    title: string;
    description: string;
    serviceId: string;
    severity: Severity;
    errorLogs?: string;
    assignedEngineerId?: string;
    triggerAI: boolean;
  }) => {
    try {
      const newInc = await api.createIncident(data);
      setIncidents((prev) => [newInc, ...prev]);
      setShowCreateIncidentModal(false);
      await loadData(true);
      showToast(`Declared ${newInc.id}: ${newInc.title}`, 'warn');
      setSelectedIncident(newInc);
    } catch (e) {
      console.error('Declare incident failed', e);
    }
  };

  const handleUpdateIncidentStatus = async (incidentId: string, status: IncidentStatus) => {
    try {
      const updated = await api.updateIncident(incidentId, { status });
      setIncidents((prev) => prev.map((i) => (i.id === incidentId ? updated : i)));
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident(updated);
      }
      const refreshedMetrics = await api.getMetrics();
      setMetrics(refreshedMetrics);
      showToast(`Updated ${incidentId} status to ${status}`);
    } catch (e) {
      console.error('Update incident status failed', e);
    }
  };

  const handleAssignEngineer = async (incidentId: string, engineerId: string) => {
    try {
      const updated = await api.assignEngineer(incidentId, engineerId);
      setIncidents((prev) => prev.map((i) => (i.id === incidentId ? updated : i)));
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident(updated);
      }
      showToast(`Reassigned ${incidentId} to ${updated.assignedEngineer.name}`);
    } catch (e) {
      console.error('Assign engineer failed', e);
    }
  };

  const handleResolveIncident = async (incidentId: string, resolutionNotes: string) => {
    try {
      const updated = await api.resolveIncident(incidentId, resolutionNotes);
      setIncidents((prev) => prev.map((i) => (i.id === incidentId ? updated : i)));
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident(updated);
      }
      const refreshedMetrics = await api.getMetrics();
      setMetrics(refreshedMetrics);
      showToast(`Incident ${incidentId} marked RESOLVED`);
    } catch (e) {
      console.error('Resolve incident failed', e);
    }
  };

  const handleRunAiAnalysis = async (inc: Incident) => {
    setIsAnalyzingAI(true);
    try {
      const analysis = await api.analyzeIncident({
        incidentId: inc.id,
        title: inc.title,
        description: inc.description,
        serviceName: inc.serviceName,
        serviceId: inc.serviceId,
        severity: inc.severity,
        status: inc.status,
        errorLogs: inc.errorLogs,
      });

      const recActions =
        analysis.recommendedTroubleshootingSteps && analysis.recommendedTroubleshootingSteps.length > 0
          ? analysis.recommendedTroubleshootingSteps.slice(0, 3)
          : (analysis.mitigationSteps?.slice(0, 3) || []);

      const updated: Incident = {
        ...inc,
        aiAnalysis: analysis,
        recommendedActions: recActions,
      };

      setIncidents((prev) => prev.map((i) => (i.id === inc.id ? updated : i)));
      setSelectedIncident(updated);
      showToast(`Gemini AI Root-Cause Diagnostic generated (${analysis.confidenceScore}% confidence)`);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('AI analysis error', err);

      // Do not reuse an old cached/demo confidence value or analysis after a failed analysis
      const updatedWithoutAi: Incident = {
        ...inc,
        aiAnalysis: undefined,
      };
      setIncidents((prev) => prev.map((i) => (i.id === inc.id ? updatedWithoutAi : i)));
      setSelectedIncident((prev) => (prev?.id === inc.id ? updatedWithoutAi : prev));

      showToast(err.message || 'AI analysis encountered an error', 'warn');
      throw err;
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleQuickAiRca = async (inc: Incident) => {
    setSelectedIncident(inc);
    await handleRunAiAnalysis(inc);
  };

  const handleAdHocAiAnalysis = async (params: {
    serviceName: string;
    title: string;
    description: string;
    severity: Severity;
    errorLogs: string;
  }): Promise<AIAnalysisResult> => {
    const analysis = await api.analyzeIncident(params);
    showToast(`Ad-hoc Gemini AI analysis generated (${analysis.confidenceScore}%)`);
    return analysis;
  };

  const handleAnalyzeLogsWithAI = async (params: {
    serviceName?: string;
    serviceId?: string;
    rawLogs?: string;
    logs?: string[];
  }): Promise<AIAnalysisResult> => {
    const analysis = await api.analyzeLogs(params);
    showToast(`Gemini AI Log Pattern Diagnostic generated (${analysis.confidenceScore}% confidence)`);
    return analysis;
  };

  const handleSimulateLog = async (payload: {
    serviceId: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
    message: string;
    stackTrace?: string;
  }) => {
    try {
      const newLog = await api.simulateLog(payload);
      setLogs((prev) => [newLog, ...prev]);
      showToast(`Simulated log injected for ${newLog.serviceName}`);
    } catch (e) {
      console.error('Simulate log failed', e);
    }
  };

  const handleUpdateEngineerStatus = async (engineerId: string, status: Engineer['status']) => {
    try {
      const updated = await api.updateEngineer(engineerId, { status });
      setEngineers((prev) => prev.map((e) => (e.id === engineerId ? updated : e)));
      showToast(`Updated ${updated.name} rotation status to ${status}`);
    } catch (e) {
      console.error('Update engineer status failed', e);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<AdminSettings>) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
      showToast('Admin configuration saved and applied');
    } catch (e) {
      console.error('Save settings failed', e);
    }
  };

  const handleResetSeedData = async () => {
    try {
      await api.resetSeed();
      await loadData();
      showToast('Database successfully restored to canonical demo state');
    } catch (e) {
      console.error('Reset database failed', e);
    }
  };

  const handleTriggerIncidentForService = (service: Service) => {
    setCreateForServiceId(service.id);
    setShowCreateIncidentModal(true);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm font-semibold tracking-tight text-white font-mono">Authenticating Secure Session...</div>
        <p className="text-xs text-slate-400">Verifying PBKDF2 cryptographic token and RBAC grants</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm font-semibold tracking-tight text-white font-mono">Initializing AegisAI Platform...</div>
        <p className="text-xs text-slate-400">Loading service mesh topology and telemetry signals</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Platform Header */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentEngineer={currentEngineer}
        engineers={engineers}
        onSwitchEngineer={handleSwitchEngineer}
        onOpenCreateIncident={() => {
          setCreateForServiceId(undefined);
          setShowCreateIncidentModal(true);
        }}
        metrics={metrics}
        onRefreshData={() => loadData()}
        isRefreshing={isRefreshing}
      />

      {/* Floating Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center space-x-2.5 text-xs font-medium ${
              notification.type === 'warn'
                ? 'bg-amber-950 text-amber-200 border-amber-800/80'
                : notification.type === 'info'
                ? 'bg-slate-900 text-slate-200 border-slate-700'
                : 'bg-emerald-950 text-emerald-200 border-emerald-800/80'
            }`}
          >
            {notification.type === 'warn' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : notification.type === 'info' ? (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            metrics={metrics}
            services={services}
            incidents={incidents}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onQuickAiRca={handleQuickAiRca}
          />
        )}

        {activeTab === 'services' && (
          <ServicesView
            services={services}
            onUpdateServiceStatus={handleUpdateServiceStatus}
            onCreateService={handleCreateService}
            onTriggerIncidentForService={handleTriggerIncidentForService}
          />
        )}

        {activeTab === 'incidents' && (
          <IncidentsView
            incidents={incidents}
            services={services}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onOpenCreateModal={() => {
              setCreateForServiceId(undefined);
              setShowCreateIncidentModal(true);
            }}
            onQuickAiRca={handleQuickAiRca}
          />
        )}

        {activeTab === 'monitoring' && (
          <MonitoringView
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onSelectService={(_srvId) => setActiveTab('services')}
          />
        )}

        {activeTab === 'logs' && (
          <LogAnalysisView
            logs={logs}
            services={services}
            onRefreshLogs={() => loadData(true)}
            onSimulateLog={handleSimulateLog}
            onAnalyzeLogsWithAI={handleAnalyzeLogsWithAI}
            onOpenCreateIncident={(prefill) => {
              if (prefill?.serviceId) setCreateForServiceId(prefill.serviceId);
              setShowCreateIncidentModal(true);
            }}
          />
        )}

        {activeTab === 'ai-rca' && (
          <AiRcaStudioView
            services={services}
            incidents={incidents}
            onPerformAdHocAnalysis={handleAdHocAiAnalysis}
          />
        )}

        {activeTab === 'engineers' && (
          <EngineersView
            engineers={engineers}
            incidents={incidents}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onUpdateEngineerStatus={handleUpdateEngineerStatus}
            onSwitchEngineerPersona={handleSwitchEngineer}
            currentEngineerId={currentEngineer?.id || 'eng-1'}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            incidents={incidents}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
          />
        )}

        {activeTab === 'metrics' && (
          <MetricsView
            metrics={metrics}
            services={services}
            incidents={incidents}
          />
        )}

        {activeTab === 'settings' && settings && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetSeedData={handleResetSeedData}
          />
        )}
      </main>

      {/* Incident Detail / AI RCA Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          engineers={engineers}
          onClose={() => setSelectedIncident(null)}
          onUpdateStatus={handleUpdateIncidentStatus}
          onAssignEngineer={handleAssignEngineer}
          onResolveIncident={handleResolveIncident}
          onRunAiAnalysis={handleRunAiAnalysis}
          isAnalyzingAI={isAnalyzingAI}
        />
      )}

      {/* Create Incident Modal */}
      {showCreateIncidentModal && (
        <CreateIncidentModal
          services={services}
          engineers={engineers}
          preselectedServiceId={createForServiceId}
          onClose={() => setShowCreateIncidentModal(false)}
          onSubmit={handleCreateIncident}
        />
      )}

      {/* Minimal Enterprise Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AegisAI &bull; Enterprise Service Reliability Platform</span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            <span>All nodes reporting nominal telemetry</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AegisAppContent />
      <AccessDeniedModal />
    </AuthProvider>
  );
}
