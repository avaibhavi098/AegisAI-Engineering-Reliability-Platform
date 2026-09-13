import React from 'react';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Activity,
  ShieldCheck,
  Flame,
  Clock,
  Zap,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { Service, Incident, ReliabilityMetrics } from '../types/index.js';

interface MetricsViewProps {
  metrics: ReliabilityMetrics | null;
  services: Service[];
  incidents: Incident[];
}

export const MetricsView: React.FC<MetricsViewProps> = ({ metrics, services, incidents }) => {
  const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL').length;
  const highCount = incidents.filter((i) => i.severity === 'HIGH').length;
  const mediumCount = incidents.filter((i) => i.severity === 'MEDIUM').length;
  const lowCount = incidents.filter((i) => i.severity === 'LOW').length;

  const totalIncidents = incidents.length || 1;

  return (
    <div id="metrics-view" className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Service Level Objectives (SLOs) & Reliability Telemetry</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Error budget consumption, MTTD/MTTR benchmarks, and availability indicators
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            TARGET SLO: 99.95%
          </span>
        </div>
      </div>

      {/* 4 Core Reliability Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Availability */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>System Availability</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.systemAvailability !== null && metrics?.systemAvailability !== undefined
              ? `${metrics.systemAvailability}%`
              : 'No data available'}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics?.systemAvailability ?? 0}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Calculated from registered services</p>
        </div>

        {/* Error Budget Burn Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Error Budget Burn Rate</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {metrics?.errorBudgetBurnRate !== null && metrics?.errorBudgetBurnRate !== undefined
              ? `${metrics.errorBudgetBurnRate}x`
              : 'No data available'}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (metrics?.errorBudgetBurnRate || 0) * 20)}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-slate-400">Normal threshold: &lt; 2.0x burn</p>
        </div>

        {/* Mean Time to Detect (MTTD) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Time to Detect (MTTD)</span>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.meanTimeToDetectMinutes !== null && metrics?.meanTimeToDetectMinutes !== undefined ? (
              <>
                {metrics.meanTimeToDetectMinutes}
                <span className="text-sm font-normal text-slate-400 ml-1">min</span>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-normal">No data available</span>
            )}
          </div>
          <p className="text-[11px] text-indigo-300 font-mono">Automated synthetic probes</p>
        </div>

        {/* Mean Time to Resolve (MTTR) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Time to Resolve (MTTR)</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {metrics?.averageResolutionMinutes !== null && metrics?.averageResolutionMinutes !== undefined ? (
              <>
                {metrics.averageResolutionMinutes}
                <span className="text-sm font-normal text-slate-400 ml-1">min</span>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-normal">No data available</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">Calculated from resolved incidents</p>
        </div>
      </div>

      {/* Visual Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Incident Severity Breakdown (5 cols on lg) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Incident Severity Distribution</span>
          </h2>

          <div className="space-y-3 pt-1">
            {/* Critical */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-rose-400 font-semibold">CRITICAL (P0)</span>
                <span className="text-slate-300">{criticalCount} incidents ({Math.round((criticalCount / totalIncidents) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(criticalCount / totalIncidents) * 100}%` }}></div>
              </div>
            </div>

            {/* High */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-orange-400 font-semibold">HIGH (P1)</span>
                <span className="text-slate-300">{highCount} incidents ({Math.round((highCount / totalIncidents) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: `${(highCount / totalIncidents) * 100}%` }}></div>
              </div>
            </div>

            {/* Medium */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-semibold">MEDIUM (P2)</span>
                <span className="text-slate-300">{mediumCount} incidents ({Math.round((mediumCount / totalIncidents) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(mediumCount / totalIncidents) * 100}%` }}></div>
              </div>
            </div>

            {/* Low */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-blue-400 font-semibold">LOW (P3)</span>
                <span className="text-slate-300">{lowCount} incidents ({Math.round((lowCount / totalIncidents) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(lowCount / totalIncidents) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Service Latency & Error Rate Matrix (7 cols on lg) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>Service Performance & Latency Spectrum</span>
          </h2>

          <div className="space-y-3">
            {services.map((srv) => (
              <div
                key={srv.id}
                className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-[180px]">
                  <div className="font-semibold text-slate-200">{srv.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{srv.ownerTeam}</div>
                </div>

                <div className="flex-1 grid grid-cols-3 gap-2 font-mono text-center">
                  <div className="bg-slate-900 p-1.5 rounded">
                    <span className="text-slate-400 text-[10px] block">P99 LATENCY</span>
                    <span className={`font-bold ${srv.latencyMs > 300 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {srv.latencyMs}ms
                    </span>
                  </div>

                  <div className="bg-slate-900 p-1.5 rounded">
                    <span className="text-slate-400 text-[10px] block">ERROR RATE</span>
                    <span className={`font-bold ${srv.errorRate > 1.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {srv.errorRate}%
                    </span>
                  </div>

                  <div className="bg-slate-900 p-1.5 rounded">
                    <span className="text-slate-400 text-[10px] block">UPTIME</span>
                    <span className="font-bold text-emerald-400">{srv.uptimePercent}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
