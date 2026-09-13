import React from 'react';
import { Users, Shield, Radio, CheckCircle, AlertTriangle, Mail, ArrowRight, Lock } from 'lucide-react';
import { Engineer, Incident } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

interface EngineersViewProps {
  engineers: Engineer[];
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onUpdateEngineerStatus: (id: string, status: Engineer['status']) => void;
  onSwitchEngineerPersona: (id: string) => void;
  currentEngineerId: string;
}

export const EngineersView: React.FC<EngineersViewProps> = ({
  engineers,
  incidents,
  onSelectIncident,
  onUpdateEngineerStatus,
  onSwitchEngineerPersona,
  currentEngineerId,
}) => {
  const { canMutateIncidents, showForbiddenNotice } = useAuth();
  const onCallEngineers = engineers.filter((e) => e.status === 'ON_CALL');

  return (
    <div id="engineers-view" className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Engineer Assignment & On-Call Rotations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            SRE incident responder shifts, workload balancing, and escalation routing
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-300">Active Responders:</span>
          <div className="flex -space-x-2">
            {onCallEngineers.map((eng) => (
              <img
                key={eng.id}
                src={eng.avatar}
                alt={eng.name}
                title={`${eng.name} (On-Call)`}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-emerald-500"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Engineer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {engineers.map((engineer) => {
          const isCurrent = engineer.id === currentEngineerId;
          const assignedIncidents = incidents.filter(
            (i) => i.assignedEngineer.id === engineer.id && (i.status === 'OPEN' || i.status === 'INVESTIGATING')
          );

          return (
            <div
              key={engineer.id}
              id={`engineer-card-${engineer.id}`}
              className={`bg-slate-900 border rounded-xl p-5 transition-all flex flex-col justify-between space-y-4 ${
                isCurrent ? 'border-indigo-500/80 ring-1 ring-indigo-500/30' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <img
                      src={engineer.avatar}
                      alt={engineer.name}
                      className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-700"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                        <span>{engineer.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-600 text-white">
                            YOU
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-indigo-400 font-medium">{engineer.role}</p>
                      <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{engineer.email}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Rotation Shift:</span>
                  <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono text-[10px]">
                    <button
                      id={`set-eng-oncall-${engineer.id}`}
                      onClick={() => {
                        if (!canMutateIncidents) {
                          showForbiddenNotice('Change On-Call Rotation Status', ['ADMIN', 'ENGINEER']);
                          return;
                        }
                        onUpdateEngineerStatus(engineer.id, 'ON_CALL');
                      }}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        engineer.status === 'ON_CALL'
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ON-CALL
                    </button>
                    <button
                      id={`set-eng-avail-${engineer.id}`}
                      onClick={() => {
                        if (!canMutateIncidents) {
                          showForbiddenNotice('Change On-Call Rotation Status', ['ADMIN', 'ENGINEER']);
                          return;
                        }
                        onUpdateEngineerStatus(engineer.id, 'AVAILABLE');
                      }}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        engineer.status === 'AVAILABLE'
                          ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      AVAILABLE
                    </button>
                    <button
                      id={`set-eng-off-${engineer.id}`}
                      onClick={() => {
                        if (!canMutateIncidents) {
                          showForbiddenNotice('Change On-Call Rotation Status', ['ADMIN', 'ENGINEER']);
                          return;
                        }
                        onUpdateEngineerStatus(engineer.id, 'OFF_SHIFT');
                      }}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        engineer.status === 'OFF_SHIFT'
                          ? 'bg-slate-700 text-slate-300 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>

                {/* Assigned Active Incidents */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Assigned Incidents:</span>
                    <span
                      className={`font-mono font-bold ${
                        assignedIncidents.length > 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {assignedIncidents.length} active
                    </span>
                  </div>

                  {assignedIncidents.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {assignedIncidents.map((inc) => (
                        <div
                          key={inc.id}
                          id={`eng-inc-${inc.id}`}
                          onClick={() => onSelectIncident(inc)}
                          className="p-2 bg-slate-950/80 hover:bg-slate-950 rounded-lg border border-slate-800 text-[11px] cursor-pointer flex items-center justify-between group"
                        >
                          <span className="font-mono text-indigo-400 font-bold">{inc.id}</span>
                          <span className="text-slate-300 truncate max-w-[160px]">{inc.title}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  id={`switch-persona-btn-${engineer.id}`}
                  onClick={() => onSwitchEngineerPersona(engineer.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors w-full ${
                    isCurrent
                      ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/40 cursor-default'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isCurrent ? 'Current Session' : 'Operate as this Engineer'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
