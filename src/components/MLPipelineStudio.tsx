import React, { useState } from 'react';
import { 
  Cpu, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Sliders, 
  Workflow, 
  Activity, 
  Zap,
  TrendingUp,
  BrainCircuit,
  Binary
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { TrainingMetrics } from '../types';

interface MLPipelineStudioProps {
  metrics: TrainingMetrics;
  onTrainModel: (epochs: number, trees: number) => void;
  isTraining: boolean;
  ifWeight: number;
  lstmWeight: number;
  onUpdateWeights: (ifW: number, lstmW: number) => void;
  threshold: number;
  onUpdateThreshold: (th: number) => void;
  fpRate: number;
  onTriggerRetrainingDAG: () => void;
}

export const MLPipelineStudio: React.FC<MLPipelineStudioProps> = ({
  metrics,
  onTrainModel,
  isTraining,
  ifWeight,
  lstmWeight,
  onUpdateWeights,
  threshold,
  onUpdateThreshold,
  fpRate,
  onTriggerRetrainingDAG,
}) => {
  const [selectedEpochs, setSelectedEpochs] = useState<number>(25);
  const [selectedTrees, setSelectedTrees] = useState<number>(60);

  return (
    <div className="space-y-4 font-sans">
      {/* ML Pipeline Header & Active Run Status */}
      <div className="rounded bg-[#161B22] border border-gray-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-blue-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">
                ML Anomaly Detection Pipeline & Model Studio
              </h2>
              <span className="rounded bg-blue-950/50 border border-blue-800/50 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-400">
                v2.4-ENSEMBLE
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Unsupervised multi-dimensional behavioral profiling combining Isolation Forest (spatial outlier isolation) with LSTM Autoencoder (temporal API sequence reconstruction error).
            </p>
          </div>

          {/* Model Retraining Trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTrainModel(selectedEpochs, selectedTrees)}
              disabled={isTraining}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-mono font-bold text-white uppercase tracking-wider transition hover:bg-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isTraining ? 'animate-spin' : ''}`} />
              <span>{isTraining ? 'Training Models...' : 'Retrain Pipeline'}</span>
            </button>
          </div>
        </div>

        {/* Model Evaluation Metrics Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 font-mono">
          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[9px] uppercase text-gray-500">ROC-AUC Score</span>
            <div className="mt-0.5 text-lg font-bold text-green-400">{(metrics.rocAuc * 100).toFixed(1)}%</div>
            <div className="text-[9px] text-gray-500 font-sans">Separation capacity</div>
          </div>

          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[9px] uppercase text-gray-500">Precision (PPV)</span>
            <div className="mt-0.5 text-lg font-bold text-blue-400">{(metrics.precision * 100).toFixed(1)}%</div>
            <div className="text-[9px] text-gray-500 font-sans">Low false alarms</div>
          </div>

          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[9px] uppercase text-gray-500">Recall (TPR)</span>
            <div className="mt-0.5 text-lg font-bold text-orange-400">{(metrics.recall * 100).toFixed(1)}%</div>
            <div className="text-[9px] text-gray-500 font-sans">Privilege attacks caught</div>
          </div>

          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[9px] uppercase text-gray-500">F1-Score</span>
            <div className="mt-0.5 text-lg font-bold text-gray-200">{(metrics.f1Score * 100).toFixed(1)}%</div>
            <div className="text-[9px] text-gray-500 font-sans">Harmonic balance</div>
          </div>

          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[9px] uppercase text-gray-500">Inference Latency</span>
            <div className="mt-0.5 text-lg font-bold text-blue-400">1.4 ms</div>
            <div className="text-[9px] text-gray-500 font-sans">Sub-millisecond eval</div>
          </div>

          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[9px] uppercase text-gray-500">Baseline Events</span>
            <div className="mt-0.5 text-lg font-bold text-gray-100">{metrics.normalBaselineSamples.toLocaleString()}</div>
            <div className="text-[9px] text-gray-500 font-sans">CloudTrail logs</div>
          </div>
        </div>
      </div>

      {/* Model Architectures & Loss Curves */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LSTM Autoencoder Convergence Loss Curve (7 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
                  LSTM Autoencoder Reconstruction Loss
                </h3>
              </div>
            </div>
            <div className="font-mono text-[10px] text-gray-400">
              Threshold: <strong className="text-blue-400">{metrics.threshold} MSE</strong>
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.lossHistory} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <XAxis dataKey="epoch" tick={{ fill: '#64748b', fontSize: 9 }} label={{ value: 'Epoch', position: 'insideBottom', fill: '#64748b', fontSize: 9, offset: -5 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0E14', borderColor: '#374151', borderRadius: '4px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="trainLoss" stroke="#3b82f6" name="Training Loss (MSE)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="valLoss" stroke="#a855f7" name="Validation Loss (MSE)" strokeWidth={2} strokeDasharray="3 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 rounded bg-[#0B0E14] border border-gray-800 p-2 text-[10px] text-gray-400 font-mono">
            ⚡ Sequence Memory: Evaluates API sequence flow (e.g. <span className="text-gray-300">GetUser → ListBuckets → GetObject</span>). Deviations like <span className="text-red-400">AssumeRole → AssumeRole → CreatePolicyVersion</span> trigger reconstruction loss spike.
          </div>
        </div>

        {/* Feature Importance Ranking (5 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Binary className="h-4 w-4 text-orange-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
                  10 CloudTrail Feature Weights
                </h3>
              </div>
            </div>
            <span className="text-[10px] font-mono text-gray-500">GINI SPLIT</span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={metrics.featureImportances}
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis dataKey="label" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0E14', borderColor: '#374151', borderRadius: '4px', fontSize: '11px' }}
                />
                <Bar dataKey="importance" radius={[0, 2, 2, 0]}>
                  {metrics.featureImportances.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.importance > 0.2
                          ? '#ef4444'
                          : entry.importance > 0.12
                          ? '#f97316'
                          : entry.importance > 0.08
                          ? '#3b82f6'
                          : '#4b5563'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ensemble Scorer & Airflow Retraining DAG Controls */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Ensemble Calibration Controls (6 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
                Ensemble Weights & Threshold Tuning
              </h3>
            </div>
            <span className="font-mono text-[10px] text-gray-400">0.40×IF + 0.60×LSTM</span>
          </div>

          <div className="space-y-3">
            {/* Isolation Forest Weight Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-300 font-sans">Isolation Forest Weight (w_IF)</span>
                <span className="font-bold text-blue-400">{(ifWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={ifWeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateWeights(val, 1.0 - val);
                }}
                className="mt-1 w-full accent-blue-500"
              />
            </div>

            {/* LSTM Autoencoder Weight Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-300 font-sans">LSTM Autoencoder Weight (w_LSTM)</span>
                <span className="font-bold text-purple-400">{(lstmWeight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={lstmWeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateWeights(1.0 - val, val);
                }}
                className="mt-1 w-full accent-purple-500"
              />
            </div>

            {/* Anomaly Decision Threshold Slider */}
            <div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-300 font-sans">Anomaly Decision Threshold</span>
                <span className="font-bold text-red-400">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.40"
                max="0.85"
                step="0.01"
                value={threshold}
                onChange={(e) => onUpdateThreshold(parseFloat(e.target.value))}
                className="mt-1 w-full accent-red-500"
              />
              <p className="mt-1 text-[10px] text-gray-500 font-mono">
                Events with score ≥ {threshold.toFixed(2)} trigger SIEM high-priority anomaly alerts.
              </p>
            </div>
          </div>
        </div>

        {/* Airflow Retraining DAG & Feedback Loop (6 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-orange-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
                Automated Retraining DAG & Feedback
              </h3>
            </div>
            <span className="rounded bg-orange-950/50 border border-orange-800/50 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-400">
              AIRFLOW ACTIVE
            </span>
          </div>

          <div className="space-y-3 font-mono">
            <div className="rounded border border-gray-800 bg-[#0B0E14] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-sans">Sliding False Positive Rate</span>
                <span className={`text-sm font-bold ${fpRate > 0.2 ? 'text-red-400' : 'text-green-400'}`}>
                  {(fpRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-800">
                <div
                  className={`h-full ${fpRate > 0.2 ? 'bg-red-500' : 'bg-green-400'}`}
                  style={{ width: `${Math.min(100, fpRate * 100 * 3)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400 font-sans">
                Objective #6: If analyst-flagged false positive rate exceeds <strong className="text-gray-200">20.0%</strong>, automated DAG fine-tunes Isolation Trees and calibrates sequence memory.
              </p>
            </div>

            <div className="flex items-center justify-between rounded border border-gray-800 bg-[#0B0E14] p-3">
              <div>
                <div className="text-xs font-bold text-gray-200 font-sans">Manual Airflow DAG Run</div>
                <div className="text-[10px] text-gray-500 font-sans">Synchronize model weights across cluster</div>
              </div>
              <button
                onClick={onTriggerRetrainingDAG}
                className="flex items-center gap-1.5 rounded bg-orange-600 px-3 py-1.5 text-xs font-bold text-white uppercase tracking-wider transition hover:bg-orange-500"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Trigger DAG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
