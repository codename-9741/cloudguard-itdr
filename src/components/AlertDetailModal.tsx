import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  Zap, 
  ThumbsUp, 
  ThumbsDown, 
  Info,
  Terminal,
  Activity
} from 'lucide-react';
import { ModelPrediction } from '../types';

interface AlertDetailModalProps {
  alert: ModelPrediction | null;
  onClose: () => void;
  onSubmitFeedback: (alertId: string, verdict: 'TRUE_POSITIVE' | 'FALSE_POSITIVE', comment: string) => void;
  onContainEntity: (entityArn: string, actionType: string) => void;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  alert,
  onClose,
  onSubmitFeedback,
  onContainEntity,
}) => {
  if (!alert) return null;

  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const confidencePct = Math.round(alert.ensembleConfidenceScore * 100);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(alert.rawEvent, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleFeedback = (verdict: 'TRUE_POSITIVE' | 'FALSE_POSITIVE') => {
    onSubmitFeedback(alert.eventId, verdict, feedbackComment);
    setFeedbackSubmitted(true);
    setTimeout(() => setFeedbackSubmitted(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs font-sans">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded border border-gray-800 bg-[#0F1219] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-[#161B22]">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded border ${
              alert.severity === 'CRITICAL' ? 'bg-red-950/50 border-red-800/60 text-red-400' : 'bg-orange-950/50 border-orange-800/60 text-orange-400'
            }`}>
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">{alert.rawEvent.eventName}</h3>
                <span className="text-[10px] text-gray-500">({alert.rawEvent.eventSource})</span>
                <span className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${
                  alert.severity === 'CRITICAL' ? 'bg-red-950/50 border-red-800/60 text-red-400' : 'bg-orange-950/50 border-orange-800/60 text-orange-400'
                }`}>
                  {alert.severity}
                </span>
              </div>
              <p className="font-mono text-[11px] text-blue-400 break-all">{alert.entityArn}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top Metric Cards: Ensemble Confidence & Model Scores */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono">
            <div className="rounded border border-red-900/60 bg-red-950/20 p-3">
              <span className="text-[10px] uppercase text-red-300 font-sans">Ensemble Confidence</span>
              <div className="mt-1 text-2xl font-bold text-red-400">{confidencePct}%</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-800">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${confidencePct}%` }} />
              </div>
            </div>

            <div className="rounded border border-gray-800 bg-[#161B22] p-3">
              <span className="text-[10px] uppercase text-gray-400 font-sans">Isolation Forest Score</span>
              <div className="mt-1 text-xl font-bold text-blue-400">{alert.isolationForestScore}</div>
              <div className="text-[10px] text-gray-500">Weight: 40% (Spatial outlier)</div>
            </div>

            <div className="rounded border border-gray-800 bg-[#161B22] p-3">
              <span className="text-[10px] uppercase text-gray-400 font-sans">LSTM Autoencoder Score</span>
              <div className="mt-1 text-xl font-bold text-purple-400">{alert.lstmAutoencoderScore}</div>
              <div className="text-[10px] text-gray-500">Weight: 60% (Reconstruction MSE)</div>
            </div>
          </div>

          {/* MITRE ATT&CK Attribution */}
          <div className="rounded border border-gray-800 bg-[#161B22] p-3.5">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 mb-2">
              MITRE ATT&CK® Cloud Technique Attribution
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {alert.mitreTechniques?.map((m, idx) => (
                <div key={`${m.id || 'mitre'}-${idx}`} className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="rounded bg-blue-950/50 border border-blue-800/60 px-1.5 py-0.2 text-[9px] font-bold text-blue-400">
                      {m.id}
                    </span>
                    <span className="text-[10px] text-gray-400 font-sans">{m.tactic}</span>
                  </div>
                  <div className="mt-1 text-xs font-bold text-gray-200">{m.name}</div>
                  <p className="mt-0.5 text-[11px] text-gray-400">{m.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Explainable AI (XAI) Top Contributors */}
          <div className="rounded border border-gray-800 bg-[#161B22] p-3.5">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 mb-2">
              Explainable AI (XAI) Decision Rationale
            </h4>
            <div className="space-y-1.5">
              {alert.xaiTopContributors?.map((c: any, i: number) => (
                <div key={`xai-${i}-${c.feature || 'f'}`} className="flex items-start gap-2.5 rounded border border-gray-800 bg-[#0B0E14] p-2">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-800 font-mono text-[10px] text-blue-400">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-xs font-bold text-gray-200">{c.label || c.feature}</span>
                      <span className="text-[10px] text-red-400">
                        Weight: {(((c.score ?? c.contribution ?? 0) * 100)).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">{c.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Raw CloudTrail JSON Inspector */}
          <div className="rounded border border-gray-800 bg-[#161B22] p-3.5">
            <div className="flex items-center justify-between pb-1.5">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                Raw CloudTrail Event Payload
              </h4>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 rounded border border-gray-700 bg-[#0B0E14] px-1.5 py-0.5 text-[10px] font-mono text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                {copiedJson ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="mt-1 max-h-40 overflow-y-auto rounded bg-[#0B0E14] p-2.5 font-mono text-[10px] text-green-400 border border-gray-800">
              {JSON.stringify(alert.rawEvent, null, 2)}
            </pre>
          </div>

          {/* Analyst Feedback & Retraining Loop */}
          <div className="rounded border border-gray-800 bg-[#161B22] p-3.5">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
              Analyst Feedback Loop (Active Learning Calibration)
            </h4>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Submit ground-truth verdicts to calibrate the model. If false positives exceed 20%, an automated retraining DAG is triggered.
            </p>

            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row font-mono">
              <input
                type="text"
                placeholder="Optional analyst notes (e.g. Authorized red team exercise)..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="flex-1 rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleFeedback('TRUE_POSITIVE')}
                  className="flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-red-500"
                >
                  <ThumbsUp className="h-3 w-3" />
                  <span>Confirm True Threat</span>
                </button>
                <button
                  onClick={() => handleFeedback('FALSE_POSITIVE')}
                  className="flex items-center gap-1.5 rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"
                >
                  <ThumbsDown className="h-3 w-3" />
                  <span>Flag False Positive</span>
                </button>
              </div>
            </div>
            {feedbackSubmitted && (
              <div className="mt-1.5 text-[11px] font-mono font-semibold text-green-400">
                ✓ Feedback recorded into ML training buffer.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3 bg-[#161B22] font-mono">
          <button
            onClick={onClose}
            className="rounded border border-gray-800 bg-[#0B0E14] px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Close Drilldown
          </button>

          <button
            onClick={() => {
              onContainEntity(alert.entityArn, 'ATTACH_DENY_POLICY');
              onClose();
            }}
            className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-bold text-white uppercase tracking-wider transition hover:bg-red-500"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Deploy SOAR Quarantine Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
