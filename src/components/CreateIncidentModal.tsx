import React, { useState } from 'react';
import { X, AlertTriangle, Sparkles, Terminal, User } from 'lucide-react';
import { Service, Engineer, Severity } from '../types/index.js';

interface CreateIncidentModalProps {
  services: Service[];
  engineers: Engineer[];
  preselectedServiceId?: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    serviceId: string;
    severity: Severity;
    errorLogs?: string;
    assignedEngineerId?: string;
    triggerAI: boolean;
  }) => void;
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({
  services,
  engineers,
  preselectedServiceId,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceId, setServiceId] = useState(preselectedServiceId || services[0]?.id || '');
  const [severity, setSeverity] = useState<Severity>('HIGH');
  const [assignedEngineerId, setAssignedEngineerId] = useState(engineers[0]?.id || '');
  const [errorLogs, setErrorLogs] = useState('');
  const [triggerAI, setTriggerAI] = useState(true);

  const handleFillSampleTrace = () => {
    const selectedService = services.find((s) => s.id === serviceId) || services[0];
    setErrorLogs(`[${new Date().toISOString()}] ERROR [${selectedService?.key || 'service-api'}] (worker-node-7b): ConnectionResetError: Connection forcibly closed by remote host
  at Socket.onSocketReset (node:net:842:19)
  at Pool.acquireConnection (/app/node_modules/pg-pool/index.js:142:11)
  at async QueryExecutor.execute (/app/src/db/executor.ts:89:22)
[${new Date().toISOString()}] FATAL [${selectedService?.key || 'service-api'}] Upstream pool capacity 100% saturated. Thread wait timeout exceeded (8000ms).
[${new Date().toISOString()}] WARN [${selectedService?.key || 'service-api'}] Circuit breaker tripped for downstream database connection.`);
    if (!title) {
      setTitle(`Socket Timeout & Connection Pool Saturation in ${selectedService?.name || 'Service'}`);
    }
    if (!description) {
      setDescription(`Sudden spike in connection latency causing worker thread exhaustion and cascading HTTP 504 gateway timeouts.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !serviceId) return;

    onSubmit({
      title,
      description,
      serviceId,
      severity,
      errorLogs,
      assignedEngineerId,
      triggerAI,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        id="create-incident-modal"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Declare Technical Incident</h2>
              <p className="text-xs text-slate-400">Initiate SRE paging, status page update, and AI diagnostics</p>
            </div>
          </div>
          <button
            id="close-create-modal-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Service & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Impacted Service</label>
              <select
                id="create-incident-service-select"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.tier})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Severity Level</label>
              <select
                id="create-incident-severity-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
              >
                <option value="CRITICAL">CRITICAL (Total outage, P0)</option>
                <option value="HIGH">HIGH (Degraded core functionality, P1)</option>
                <option value="MEDIUM">MEDIUM (Intermittent errors, P2)</option>
                <option value="LOW">LOW (Minor anomaly, P3)</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Incident Summary / Title</label>
            <input
              id="create-incident-title-input"
              type="text"
              placeholder="e.g. Payment Gateway Circuit Breaker Tripped"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Symptom Description</label>
            <textarea
              id="create-incident-desc-textarea"
              rows={2}
              placeholder="Observed user symptoms, customer complaints, alert triggers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Assigned Engineer */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Incident Commander</label>
            <select
              id="create-incident-engineer-select"
              value={assignedEngineerId}
              onChange={(e) => setAssignedEngineerId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name} — {eng.role} {eng.status === 'ON_CALL' ? '(ON-CALL)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Error Logs & Stack Traces */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Application Error Logs & Stack Traces
              </label>
              <button
                type="button"
                id="insert-sample-logs-btn"
                onClick={handleFillSampleTrace}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
              >
                <Terminal className="w-3 h-3" />
                <span>Insert Sample Stack Trace</span>
              </button>
            </div>
            <textarea
              id="create-incident-logs-textarea"
              rows={4}
              placeholder="Paste raw stderr logs, json log payloads, or exception traces..."
              value={errorLogs}
              onChange={(e) => setErrorLogs(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-rose-300 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Auto AI Trigger Checkbox */}
          <div className="flex items-center space-x-2.5 bg-indigo-950/40 p-3 rounded-lg border border-indigo-800/40">
            <input
              id="create-incident-ai-checkbox"
              type="checkbox"
              checked={triggerAI}
              onChange={(e) => setTriggerAI(e.target.checked)}
              className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="create-incident-ai-checkbox" className="text-xs text-slate-200 cursor-pointer">
              <span className="font-semibold text-indigo-300 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 inline" />
                <span>Auto-generate Gemini AI Root-Cause Diagnostic Report</span>
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Automatically determines probable root cause, blast radius, mitigation runbooks, and remediation steps.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              id="cancel-create-incident-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-incident-btn"
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Declare Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
