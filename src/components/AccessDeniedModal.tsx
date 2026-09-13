import React from 'react';
import { ShieldAlert, X, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { UserRole } from '../types/index.js';

export const AccessDeniedModal: React.FC = () => {
  const { forbiddenNotice, closeForbiddenNotice, user, quickLogin } = useAuth();

  if (!forbiddenNotice?.isOpen) return null;

  const handleSwitch = async (role: UserRole) => {
    closeForbiddenNotice();
    await quickLogin(role);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-rose-950/60 to-slate-900 border-b border-rose-900/40 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Permission Denied (403 Forbidden)
              </h3>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Role-Based Access Control (RBAC) Enforcement
              </p>
            </div>
          </div>
          <button
            onClick={closeForbiddenNotice}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Attempted Action:</span>
              <span className="font-semibold text-white font-mono bg-slate-800 px-2 py-0.5 rounded">
                {forbiddenNotice.actionName}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Current Account Role:</span>
              <span className="font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                {user?.role || 'UNAUTHENTICATED'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Required Roles:</span>
              <div className="flex space-x-1.5">
                {forbiddenNotice.requiredRoles.map((r) => (
                  <span
                    key={r}
                    className="font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/20 text-[11px]"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-slate-300 leading-relaxed">
            As a <strong className="text-amber-300">{user?.role}</strong>, your account has read-only observatory privileges. To maintain operational safety, destructive operations, incident mutations, and autonomous Gemini AI RCA triggers require an <strong>ENGINEER</strong> or <strong>ADMIN</strong> security clearance.
          </p>

          {/* Quick switch actions for convenient testing */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Role Switch for Testing:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSwitch('ENGINEER')}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 font-medium transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Switch to SRE Engineer</span>
              </button>
              <button
                onClick={() => handleSwitch('ADMIN')}
                className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 font-medium transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Switch to Platform Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={closeForbiddenNotice}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Acknowledge & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
