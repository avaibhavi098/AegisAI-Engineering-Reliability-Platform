import React, { useState } from 'react';
import {
  Settings,
  Bell,
  Sparkles,
  Sliders,
  RotateCcw,
  Check,
  Save,
  ShieldAlert,
  Mail,
  MessageSquare,
  Radio,
  Users,
  Lock,
} from 'lucide-react';
import { AdminSettings } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { UserManagementView } from './UserManagementView.js';

interface SettingsViewProps {
  settings: AdminSettings;
  onSaveSettings: (settings: Partial<AdminSettings>) => Promise<void>;
  onResetSeedData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetSeedData,
}) => {
  const { isAdmin, role, showForbiddenNotice } = useAuth();
  const [activeTab, setActiveTab] = useState<'config' | 'users'>('config');
  const [formData, setFormData] = useState<AdminSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showForbiddenNotice('Modify Platform Settings', ['ADMIN']);
      return;
    }
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetData = async () => {
    if (!isAdmin) {
      showForbiddenNotice('Reset Canonical Demo State', ['ADMIN']);
      return;
    }
    if (!window.confirm('Reset all service telemetry, incidents, and logs to the canonical demo dataset?')) {
      return;
    }
    setIsResetting(true);
    try {
      await onResetSeedData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div id="settings-view" className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span>Platform Administration & Access Control</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage SRE alerting channels, Gemini AI diagnostic thresholds, and RBAC operator roles
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'config'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configuration</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isAdmin) {
                showForbiddenNotice('User & Role Management', ['ADMIN']);
                return;
              }
              setActiveTab('users');
            }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAdmin ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
            <span>Operators & Roles (RBAC)</span>
          </button>
        </div>
      </div>

      {!isAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Your current role is <strong className="font-mono">{role}</strong>. Platform settings and operator role management are restricted to <strong>ADMIN</strong>.
            </span>
          </div>
        </div>
      )}

      {activeTab === 'users' ? (
        <UserManagementView />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Gemini AI Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Gemini AI RCA Engine Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Inference Model</label>
              <select
                id="setting-gemini-model"
                value={formData.geminiModel}
                onChange={(e) => setFormData({ ...formData, geminiModel: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended: Low Latency, SRE Pattern Optimized)</option>
                <option value="gemini-3.6-flash">gemini-3.6-flash (High Availability, Fast Failover Inference)</option>
              </select>
            </div>

            <div className="flex items-center space-x-3 pt-5">
              <input
                id="setting-auto-ai"
                type="checkbox"
                checked={formData.autoAiAnalysisOnCritical}
                onChange={(e) => setFormData({ ...formData, autoAiAnalysisOnCritical: e.target.checked })}
                className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="setting-auto-ai" className="text-xs text-slate-200 cursor-pointer">
                <span className="font-semibold block text-slate-100">Auto-analyze P0 / P1 incidents</span>
                <span className="text-[11px] text-slate-400">
                  Automatically invoke Gemini AI to build runbooks as soon as an incident is declared.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 2. Alert Integrations (Slack, PagerDuty, Email) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
            <Bell className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Incident Escalation & Notification Channels</h2>
          </div>

          <div className="space-y-3">
            {/* Slack */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">Slack Incident Room Webhook</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.slackAlerts}
                  onChange={(e) => setFormData({ ...formData, slackAlerts: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={formData.slackWebhookUrl}
                onChange={(e) => setFormData({ ...formData, slackWebhookUrl: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* PagerDuty */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-semibold text-slate-200">PagerDuty Integration Key</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.pagerDutyAlerts}
                  onChange={(e) => setFormData({ ...formData, pagerDutyAlerts: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={formData.pagerDutyRoutingKey}
                onChange={(e) => setFormData({ ...formData, pagerDutyRoutingKey: e.target.value })}
                placeholder="pd-routing-key..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Email */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-200">SRE Emergency Dispatch Email</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.emailAlerts}
                  onChange={(e) => setFormData({ ...formData, emailAlerts: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded cursor-pointer"
                />
              </div>
              <input
                type="email"
                value={formData.alertEmail}
                onChange={(e) => setFormData({ ...formData, alertEmail: e.target.value })}
                placeholder="sre-oncall@aegis-engineering.internal"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 3. SLO Thresholds */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Reliability & Warning Thresholds</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Latency Warning (P99 ms)</label>
              <input
                type="number"
                value={formData.latencyWarningThresholdMs}
                onChange={(e) => setFormData({ ...formData, latencyWarningThresholdMs: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Error Rate Warning (%)</label>
              <input
                type="number"
                step="0.1"
                value={formData.errorRateWarningThresholdPct}
                onChange={(e) => setFormData({ ...formData, errorRateWarningThresholdPct: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target SLO Availability (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.sloTargetAvailability}
                onChange={(e) => setFormData({ ...formData, sloTargetAvailability: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center space-x-1.5 font-medium">
              <Check className="w-4 h-4" />
              <span>Settings successfully saved and active.</span>
            </span>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Database & Demo Lifecycle */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">System Demo Database Lifecycle</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Restore the system to default production services, sample incidents, logs, and engineers.
            </p>
          </div>

          <button
            type="button"
            id="reset-demo-db-btn"
            onClick={handleResetData}
            disabled={isResetting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Restoring...' : 'Reset to Canonical Demo State'}</span>
          </button>
        </div>

        {resetSuccess && (
          <p className="text-xs text-emerald-400 font-medium">Database successfully restored to clean state.</p>
        )}
      </div>
        </>
      )}
    </div>
  );
};
