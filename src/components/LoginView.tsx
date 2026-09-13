import React, { useState } from 'react';
import { Shield, Lock, Mail, User, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { UserRole } from '../types/index.js';

export const LoginView: React.FC = () => {
  const { login, signup, quickLogin } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('ENGINEER');
  const [title, setTitle] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        await login(email, password);
      } else {
        await signup({
          name,
          email,
          password,
          role,
          title: title || undefined,
        });
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Authentication request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (selectedRole: UserRole) => {
    setError(null);
    setIsLoading(true);
    try {
      await quickLogin(selectedRole);
    } catch (err: unknown) {
      setError((err as Error).message || 'Quick login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background glow & grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b10_1px,transparent_1px),linear-gradient(to_bottom,#1e293b10_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2 shadow-lg shadow-indigo-500/5">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center space-x-2">
            <span>AegisAI</span>
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              SRE Portal
            </span>
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Autonomous Reliability Engineering & Enterprise Incident Operations
          </p>
        </div>

        {/* Quick Login Roles Showcase */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-xl backdrop-blur-sm space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span>1-Click Role Sandbox Login</span>
            <span className="text-indigo-400 text-[10px] font-mono">Instant RBAC</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="quick-login-admin"
              type="button"
              onClick={() => handleQuickLogin('ADMIN')}
              disabled={isLoading}
              className="flex flex-col items-center text-center p-2.5 rounded-xl bg-indigo-950/30 hover:bg-indigo-900/50 border border-indigo-800/40 hover:border-indigo-500/60 transition-all cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 mb-1.5 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-white">ADMIN</span>
              <span className="text-[9px] text-indigo-300 mt-0.5">Full Access</span>
            </button>

            <button
              id="quick-login-engineer"
              type="button"
              onClick={() => handleQuickLogin('ENGINEER')}
              disabled={isLoading}
              className="flex flex-col items-center text-center p-2.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-800/40 hover:border-emerald-500/60 transition-all cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 mb-1.5 group-hover:scale-110 transition-transform">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-white">ENGINEER</span>
              <span className="text-[9px] text-emerald-300 mt-0.5">RCA & Triage</span>
            </button>

            <button
              id="quick-login-viewer"
              type="button"
              onClick={() => handleQuickLogin('VIEWER')}
              disabled={isLoading}
              className="flex flex-col items-center text-center p-2.5 rounded-xl bg-sky-950/30 hover:bg-sky-900/50 border border-sky-800/40 hover:border-sky-500/60 transition-all cursor-pointer group"
            >
              <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 mb-1.5 group-hover:scale-110 transition-transform">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-white">VIEWER</span>
              <span className="text-[9px] text-sky-300 mt-0.5">Read-Only</span>
            </button>
          </div>
        </div>

        {/* Main Auth Form Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 backdrop-blur-sm space-y-5">
          {/* Tabs */}
          <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register Operator
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      placeholder="e.g. Rachel Chen"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Operator Role</label>
                  <select
                    id="signup-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="ENGINEER">ENGINEER (Triage, Root Cause Analysis, Updates)</option>
                    <option value="ADMIN">ADMIN (Full Authority, User Roles, Settings)</option>
                    <option value="VIEWER">VIEWER (Read-only Dashboards and Telemetry)</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="name@aegis.internal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-[10px] text-slate-400">
                  Must be at least 8 characters. Passwords are securely hashed with PBKDF2.
                </p>
              )}
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Operations Console' : 'Create Operator Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center space-x-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>PBKDF2 Cryptographic Salt</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">Server-Side Bearer Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
};
