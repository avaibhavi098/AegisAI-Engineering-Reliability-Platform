import React, { useEffect, useState } from 'react';
import { Users, Shield, ShieldAlert, ShieldCheck, CheckCircle2, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';
import { UserProfile, UserRole } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';

export const UserManagementView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to fetch registered operators');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await api.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccessMsg(`Operator permissions updated to ${newRole}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update operator role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Operator Identity & Access Control (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enforce least-privilege security across AegisAI infrastructure and autonomous AI operations.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Role Definitions Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>ADMINISTRATOR</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Unrestricted privileges: manage platform settings, edit microservice topologies, assign user roles, trigger and resolve incidents.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs">
            <UserCheck className="w-4 h-4" />
            <span>SRE ENGINEER</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Operational responders: create & triage incidents, trigger Gemini autonomous AI RCA, post resolution notes, and claim on-call incidents.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-sky-400 font-semibold text-xs">
            <Shield className="w-4 h-4" />
            <span>VIEWER</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Read-only observer: stream live telemetry, examine historical incidents and root causes. Cannot mutate records or trigger AI runs.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-4">Modify Access Level</th>
                <th className="py-3 px-4">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((usr) => {
                const isCurrent = usr.id === currentUser?.id;
                return (
                  <tr key={usr.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={usr.avatar}
                          alt={usr.name}
                          className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                        />
                        <div>
                          <div className="font-semibold text-white flex items-center space-x-1.5">
                            <span>{usr.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">{usr.title || 'Platform Operator'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">{usr.email}</td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                          usr.role === 'ADMIN'
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                            : usr.role === 'ENGINEER'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {usr.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <select
                        id={`user-role-select-${usr.id}`}
                        disabled={updatingUserId === usr.id}
                        value={usr.role}
                        onChange={(e) => handleRoleChange(usr.id, e.target.value as UserRole)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="ENGINEER">ENGINEER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(usr.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
