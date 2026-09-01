import React, { useState } from 'react';
import { 
  Workflow, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  Sliders, 
  Cloud, 
  Database, 
  FileCode, 
  Layers, 
  BrainCircuit, 
  Activity, 
  ArrowRight,
  ShieldCheck,
  Flame,
  Zap,
  Gauge
} from 'lucide-react';
import { CloudTrailEvent, TrainingMetrics } from '../types';

interface AutomatedTrainingPipelineProps {
  allEvents: CloudTrailEvent[];
  trainingMetrics: TrainingMetrics;
  onExecutePipelineTraining: (epochs: number, trees: number) => Promise<void>;
  isTraining: boolean;
  fpRate: number;
  awsEventsCount: number;
  localUploadedCount: number;
  ifWeight: number;
  lstmWeight: number;
  onUpdateWeights: (ifW: number, lstmW: number) => void;
  threshold: number;
  onUpdateThreshold: (th: number) => void;
}

export const AutomatedTrainingPipeline: React.FC<AutomatedTrainingPipelineProps> = ({
  allEvents,
  trainingMetrics,
  onExecutePipelineTraining,
  isTraining,
  fpRate,
  awsEventsCount,
  localUploadedCount,
  ifWeight,
  lstmWeight,
  onUpdateWeights,
  threshold,
  onUpdateThreshold,
}) => {
  const [epochs, setEpochs] = useState<number>(30);
  const [trees, setTrees] = useState<number>(80);
  const [autoRetrainOnDrift, setAutoRetrainOnDrift] = useState<boolean>(true);
  const [minBatchSize, setMinBatchSize] = useState<number>(100);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [pipelineSuccessNotice, setPipelineSuccessNotice] = useState<string | null>(null);

  const normalEventsCount = allEvents.filter((e) => !e.isSimulatedAttack).length;
  const attackEventsCount = allEvents.filter((e) => e.isSimulatedAttack).length;

  const handleRunPipeline = async () => {
    setCurrentStep(1);
    setPipelineSuccessNotice(null);

    // Simulate multi-stage visual progression for clarity
    const timer1 = setTimeout(() => setCurrentStep(2), 600);
    const timer2 = setTimeout(() => setCurrentStep(3), 1200);
    const timer3 = setTimeout(() => setCurrentStep(4), 1800);

    try {
      await onExecutePipelineTraining(epochs, trees);
      setCurrentStep(5);
      setPipelineSuccessNotice(
        `Automated Pipeline completed! Model trained on ${allEvents.length} events (AWS + Local Datasets). ROC-AUC: ${(trainingMetrics.rocAuc * 100).toFixed(1)}%.`
      );
      setTimeout(() => {
        setCurrentStep(0);
      }, 4000);
    } catch (err: any) {
      setCurrentStep(0);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    }
  };

  return (
    <div className="rounded bg-[#161B22] border border-gray-800 p-4 font-sans space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-950/60 border border-blue-800/50 text-blue-400">
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
                Automated ML Training & Ingestion Pipeline
              </h3>
              <span className="rounded bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-400">
                MULTI-SOURCE INGESTION
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Automated end-to-end bridge connecting live AWS infrastructure logs, S3 archives, and local datasets to train Isolation Forest and LSTM Autoencoders.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunPipeline}
          disabled={isTraining}
          className="flex items-center gap-1.5 rounded border border-blue-700 bg-blue-600 px-3 py-1.5 font-mono text-xs font-bold text-white uppercase tracking-wider transition hover:bg-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isTraining ? 'animate-spin' : ''}`} />
          <span>{isTraining ? 'Running Pipeline...' : 'Run Automated Training'}</span>
        </button>
      </div>

      {/* Interactive Pipeline Architecture Diagram */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-5 font-mono text-xs">
        {/* Stage 1 */}
        <div className={`rounded border p-3 transition ${
          currentStep === 1 
            ? 'border-blue-500 bg-blue-950/30' 
            : 'border-gray-800 bg-[#0B0E14]'
        }`}>
          <div className="flex items-center justify-between text-gray-400 text-[10px]">
            <span>STAGE 01</span>
            <Cloud className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <h4 className="mt-1 text-xs font-bold text-gray-200">Data Ingestion</h4>
          <p className="mt-0.5 text-[10px] text-gray-400 font-sans">
            Aggregates AWS CloudTrail, S3 logs, and local JSON uploads.
          </p>
          <div className="mt-2 text-[10px] text-blue-400">{allEvents.length} Total Events</div>
        </div>

        {/* Stage 2 */}
        <div className={`rounded border p-3 transition ${
          currentStep === 2 
            ? 'border-blue-500 bg-blue-950/30' 
            : 'border-gray-800 bg-[#0B0E14]'
        }`}>
          <div className="flex items-center justify-between text-gray-400 text-[10px]">
            <span>STAGE 02</span>
            <Layers className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <h4 className="mt-1 text-xs font-bold text-gray-200">Feature Extraction</h4>
          <p className="mt-0.5 text-[10px] text-gray-400 font-sans">
            Extracts 10-dimensional temporal & spatial vectors.
          </p>
          <div className="mt-2 text-[10px] text-purple-400">10 Feature Dim</div>
        </div>

        {/* Stage 3 */}
        <div className={`rounded border p-3 transition ${
          currentStep === 3 
            ? 'border-blue-500 bg-blue-950/30' 
            : 'border-gray-800 bg-[#0B0E14]'
        }`}>
          <div className="flex items-center justify-between text-gray-400 text-[10px]">
            <span>STAGE 03</span>
            <BrainCircuit className="h-3.5 w-3.5 text-green-400" />
          </div>
          <h4 className="mt-1 text-xs font-bold text-gray-200">Ensemble Training</h4>
          <p className="mt-0.5 text-[10px] text-gray-400 font-sans">
            Fits {trees} IF Trees + {epochs} LSTM Autoencoder Epochs.
          </p>
          <div className="mt-2 text-[10px] text-green-400">IF + LSTM Models</div>
        </div>

        {/* Stage 4 */}
        <div className={`rounded border p-3 transition ${
          currentStep === 4 
            ? 'border-blue-500 bg-blue-950/30' 
            : 'border-gray-800 bg-[#0B0E14]'
        }`}>
          <div className="flex items-center justify-between text-gray-400 text-[10px]">
            <span>STAGE 04</span>
            <Gauge className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <h4 className="mt-1 text-xs font-bold text-gray-200">Validation & XAI</h4>
          <p className="mt-0.5 text-[10px] text-gray-400 font-sans">
            Validates ROC-AUC, Precision, and SHAP-aligned importances.
          </p>
          <div className="mt-2 text-[10px] text-orange-400">{(trainingMetrics.rocAuc * 100).toFixed(1)}% ROC-AUC</div>
        </div>

        {/* Stage 5 */}
        <div className={`rounded border p-3 transition ${
          currentStep === 5 
            ? 'border-green-500 bg-green-950/30' 
            : 'border-gray-800 bg-[#0B0E14]'
        }`}>
          <div className="flex items-center justify-between text-gray-400 text-[10px]">
            <span>STAGE 05</span>
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <h4 className="mt-1 text-xs font-bold text-gray-200">Live Hot-Swap</h4>
          <p className="mt-0.5 text-[10px] text-gray-400 font-sans">
            Deploys updated decision boundary to real-time scoring stream.
          </p>
          <div className="mt-2 text-[10px] text-emerald-400">Threshold: {threshold}</div>
        </div>
      </div>

      {/* Dataset Composition Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-xs">
        <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
          <span className="text-[10px] uppercase text-gray-500">Live AWS Ingested</span>
          <div className="text-sm font-bold text-blue-400">{awsEventsCount} Events</div>
        </div>
        <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
          <span className="text-[10px] uppercase text-gray-500">Local Uploaded Logs</span>
          <div className="text-sm font-bold text-purple-400">{localUploadedCount} Events</div>
        </div>
        <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
          <span className="text-[10px] uppercase text-gray-500">Benign Baseline</span>
          <div className="text-sm font-bold text-green-400">{normalEventsCount} Events</div>
        </div>
        <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
          <span className="text-[10px] uppercase text-gray-500">Attack Vectors</span>
          <div className="text-sm font-bold text-red-400">{attackEventsCount} Anomalies</div>
        </div>
      </div>

      {/* Pipeline Hyperparameters & Dynamic Controls */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 font-mono text-xs">
        <div className="rounded border border-gray-800 bg-[#0B0E14] p-3">
          <div className="flex items-center justify-between text-gray-300 mb-1.5">
            <span className="text-[11px] font-bold">LSTM Training Epochs</span>
            <span className="text-blue-400">{epochs}</span>
          </div>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-[9px] text-gray-500 mt-1">
            <span>10 (Fast)</span>
            <span>35 (Balanced)</span>
            <span>60 (Deep)</span>
          </div>
        </div>

        <div className="rounded border border-gray-800 bg-[#0B0E14] p-3">
          <div className="flex items-center justify-between text-gray-300 mb-1.5">
            <span className="text-[11px] font-bold">Isolation Forest Trees</span>
            <span className="text-purple-400">{trees}</span>
          </div>
          <input
            type="range"
            min={30}
            max={150}
            step={10}
            value={trees}
            onChange={(e) => setTrees(Number(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-[9px] text-gray-500 mt-1">
            <span>30 Estimators</span>
            <span>80 Trees</span>
            <span>150 Trees</span>
          </div>
        </div>

        <div className="rounded border border-gray-800 bg-[#0B0E14] p-3">
          <div className="flex items-center justify-between text-gray-300 mb-1.5">
            <span className="text-[11px] font-bold">Anomaly Threshold</span>
            <span className="text-green-400">{threshold}</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => onUpdateThreshold(Number(e.target.value))}
            className="w-full accent-green-500"
          />
          <div className="flex justify-between text-[9px] text-gray-500 mt-1">
            <span>0.40 (High Recall)</span>
            <span>0.65 (Balanced)</span>
            <span>0.90 (High Precision)</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {pipelineSuccessNotice && (
        <div className="rounded border border-green-800/80 bg-green-950/30 p-2.5 font-mono text-xs text-green-300 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
          <span>{pipelineSuccessNotice}</span>
        </div>
      )}
    </div>
  );
};
