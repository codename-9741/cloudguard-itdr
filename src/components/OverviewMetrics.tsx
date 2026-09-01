import React from 'react';
import { ShieldAlert, Activity, AlertTriangle, CheckCircle2, Lock, Workflow } from 'lucide-react';
import { ModelPrediction } from '../types';

interface OverviewMetricsProps {
  totalEventsCount: number;
  predictions: ModelPrediction[];
  isStreaming: boolean;
  fpRate: number;
  containmentCount: number;
}

export const OverviewMetrics: React.FC<OverviewMetricsProps> = ({
  totalEventsCount,
  predictions,
  isStreaming,
  fpRate,
  containmentCount,
}) => {
  const anomalies = predictions.filter((p) => p.isAnomaly);
  const criticalCount = anomalies.filter((p) => p.severity === 'CRITICAL').length;
  const highCount = anomalies.filter((p) => p.severity === 'HIGH').length;
  const medCount = anomalies.filter((p) => p.severity === 'MEDIUM').length;

  const meanScore =
    predictions.length > 0
      ? (predictions.reduce((acc, p) => acc + p.ensembleConfidenceScore, 0) / predictions.length).toFixed(3)
      : '0.000';

  const riskPct = Math.min(100, Math.round(parseFloat(meanScore) * 100));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 font-sans">
      {/* 1. Global Identity Risk / Events */}
      <div className="bg-[#161B22] border border-gray-800 p-3.5 rounded flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Events Processed</span>
            <Activity className={`h-3.5 w-3.5 ${isStreaming ? 'text-blue-400 animate-pulse' : 'text-gray-500'}`} />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-light text-gray-100">{totalEventsCount.toLocaleString()}</span>
            <span className="font-mono text-[10px] text-gray-500">/ LOGS</span>
          </div>
        </div>
        <div className="mt-2">
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-full animate-pulse"></div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-gray-400">
            <span className="flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${isStreaming ? 'bg-green-400' : 'bg-gray-500'}`} />
              {isStreaming ? 'STREAMING' : 'PAUSED'}
            </span>
            <span className="text-gray-500">CloudTrail</span>
          </div>
        </div>
      </div>

      {/* 2. Detected Threat Anomalies */}
      <div className="bg-[#161B22] border border-red-900/40 p-3.5 rounded flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-red-400 font-bold tracking-wider">Identity Threats</span>
            <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-light text-red-400">{anomalies.length}</span>
            <span className="font-mono text-[10px] text-red-400/80">ANOMALIES</span>
          </div>
        </div>
        <div className="mt-2">
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (anomalies.length / Math.max(1, totalEventsCount)) * 500)}%` }}></div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
            <span className="text-red-400 font-bold">{criticalCount} Crit</span>
            <span className="text-orange-400 font-bold">{highCount} High</span>
            <span className="text-yellow-400">{medCount} Med</span>
          </div>
        </div>
      </div>

      {/* 3. Mean Ensemble Risk Score */}
      <div className="bg-[#161B22] border border-gray-800 p-3.5 rounded flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Global Identity Risk</span>
            <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-light text-orange-500">{(parseFloat(meanScore) * 100).toFixed(1)}</span>
            <span className="font-mono text-[10px] text-gray-500">/ 100</span>
          </div>
        </div>
        <div className="mt-2">
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: `${riskPct}%` }}></div>
          </div>
          <p className="mt-1 text-[10px] text-gray-400 font-mono truncate">
            IF (0.4) + LSTM (0.6)
          </p>
        </div>
      </div>

      {/* 4. Model Performance (ROC-AUC / F1) */}
      <div className="bg-[#161B22] border border-gray-800 p-3.5 rounded flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">ML Performance</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-light text-green-400">96.8%</span>
            <span className="font-mono text-[10px] text-green-400/80">ROC-AUC</span>
          </div>
        </div>
        <div className="mt-2">
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-[96.8%]"></div>
          </div>
          <p className="mt-1 text-[10px] text-gray-400 font-mono">
            P: 94.2% | R: 95.8%
          </p>
        </div>
      </div>

      {/* 5. Analyst Feedback & Retraining DAG */}
      <div className={`border p-3.5 rounded flex flex-col justify-between ${
        fpRate > 0.20
          ? 'border-amber-500/60 bg-amber-950/20'
          : 'border-gray-800 bg-[#161B22]'
      }`}>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Drift & FP Rate</span>
            <Workflow className={`h-3.5 w-3.5 ${fpRate > 0.20 ? 'text-amber-400 animate-spin' : 'text-gray-400'}`} />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`font-mono text-2xl font-light ${fpRate > 0.20 ? 'text-amber-400' : 'text-gray-200'}`}>
              {(fpRate * 100).toFixed(1)}%
            </span>
            <span className="font-mono text-[10px] text-gray-500">FP SLIP</span>
          </div>
        </div>
        <div className="mt-2">
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full ${fpRate > 0.20 ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, fpRate * 400)}%` }}></div>
          </div>
          <p className="mt-1 text-[10px] font-mono text-gray-400">
            {fpRate > 0.20 ? (
              <span className="text-amber-400 font-bold">⚡ Airflow Triggered</span>
            ) : (
              <span>DAG Limit: 20% FP</span>
            )}
          </p>
        </div>
      </div>

      {/* 6. Active SOAR Containments */}
      <div className="bg-[#0F1219] border border-blue-900/50 p-3.5 rounded flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase text-blue-400 font-bold tracking-wider">SOAR Defense</span>
            <Lock className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-light text-blue-400">{containmentCount}</span>
            <span className="font-mono text-[10px] text-blue-400/80">CONTAINED</span>
          </div>
        </div>
        <div className="mt-2">
          <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, containmentCount * 25)}%` }}></div>
          </div>
          <p className="mt-1 text-[10px] text-blue-300 font-mono truncate">
            Auto SCP & DenyPolicy
          </p>
        </div>
      </div>
    </div>
  );
};
