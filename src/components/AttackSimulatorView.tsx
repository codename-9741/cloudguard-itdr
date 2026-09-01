import React, { useState } from 'react';
import { 
  Flame, 
  Play, 
  Terminal, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Layers, 
  FileCode, 
  Zap,
  ArrowRight,
  Code
} from 'lucide-react';
import { ATTACK_SCENARIOS } from '../data/attackScenarios';
import { CloudTrailEvent, ModelPrediction, AttackScenario } from '../types';

interface AttackSimulatorViewProps {
  onInjectAttack: (scenarioId: string) => void;
  onEvaluateCustomEvent: (rawEvent: CloudTrailEvent) => ModelPrediction;
  onSelectAlert: (alert: ModelPrediction) => void;
}

export const AttackSimulatorView: React.FC<AttackSimulatorViewProps> = ({
  onInjectAttack,
  onEvaluateCustomEvent,
  onSelectAlert,
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(ATTACK_SCENARIOS?.[0]?.id || '');
  const [customJsonInput, setCustomJsonInput] = useState<string>(
`{
  "eventID": "custom-test-01",
  "eventTime": "${new Date().toISOString()}",
  "eventSource": "iam.amazonaws.com",
  "eventName": "AttachUserPolicy",
  "awsRegion": "us-east-1",
  "sourceIPAddress": "185.220.101.5",
  "userAgent": "Pacu/1.4.1 (AWS Exploitation Framework)",
  "userIdentity": {
    "type": "AssumedRole",
    "principalId": "AROA-DEV-SESSION",
    "arn": "arn:aws:sts::123456789012:assumed-role/DevRole/hacker-session",
    "accountId": "123456789012"
  },
  "requestParameters": {
    "userName": "intern-contractor",
    "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess"
  }
}`
  );
  const [customEvalResult, setCustomEvalResult] = useState<ModelPrediction | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const scenario: AttackScenario = ATTACK_SCENARIOS.find((s) => s.id === selectedScenarioId) || ATTACK_SCENARIOS?.[0] || {
    id: 'unknown',
    title: 'Custom Attack Scenario',
    mitreId: 'T1078',
    category: 'CREDENTIAL_ACCESS',
    description: 'Simulated cloud threat vector',
    expectedAnomalyScore: 0.95,
    eventsCount: 1,
    steps: [],
  };

  const handleTestCustomJson = () => {
    try {
      setEvalError(null);
      const parsed = JSON.parse(customJsonInput) as CloudTrailEvent;
      if (!parsed.eventName || !parsed.eventSource || !parsed.userIdentity) {
        throw new Error('Event missing required CloudTrail fields (eventName, eventSource, userIdentity)');
      }
      const prediction = onEvaluateCustomEvent(parsed);
      setCustomEvalResult(prediction);
    } catch (err: any) {
      setEvalError(err.message);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Attack Lab Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-[#161B22] border border-gray-800 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">
              Red Team Attack Simulation & Adversary Emulation Lab
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Simulate realistic multi-step AWS IAM abuse scenarios to evaluate real-time ML detection latency and confidence scoring.
          </p>
        </div>

        <button
          onClick={() => scenario && onInjectAttack(scenario.id)}
          className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-mono font-bold text-white uppercase tracking-wider transition hover:bg-red-500"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Inject {scenario?.title?.split('(')?.[0] || 'Attack Scenario'}</span>
        </button>
      </div>

      {/* Scenario Selection Grid & Step-by-Step Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Scenario Selector List (4 cols) */}
        <div className="space-y-2 lg:col-span-4">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500">Select Attack Scenario</h3>
          {ATTACK_SCENARIOS.map((scen) => {
            const isSelected = scen.id === selectedScenarioId;
            return (
              <div
                key={scen.id}
                onClick={() => setSelectedScenarioId(scen.id)}
                className={`cursor-pointer rounded border p-3 transition ${
                  isSelected
                    ? 'border-red-500 bg-red-950/20 border-l-4'
                    : 'border-gray-800 bg-[#161B22] hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="rounded bg-red-950/50 border border-red-800/60 px-1.5 py-0.2 text-[9px] font-bold text-red-400">
                    {scen.mitreId}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {scen.eventsCount} Events
                  </span>
                </div>
                <h4 className="mt-1.5 text-xs font-bold text-gray-200">{scen.title}</h4>
                <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">{scen.description}</p>
                <div className="mt-2 flex items-center justify-between border-t border-gray-800/80 pt-1.5 text-[10px] font-mono">
                  <span className="text-gray-500">Expected: <strong className="text-red-400">{(scen.expectedAnomalyScore * 100).toFixed(0)}%</strong></span>
                  <span className="text-blue-400">Progression →</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Scenario Step Progression (8 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-950/50 border border-red-800/60 px-1.5 py-0.2 font-mono text-[10px] font-bold text-red-400">
                  {scenario.mitreId}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">{scenario.title}</h3>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{scenario.description}</p>
            </div>

            <button
              onClick={() => onInjectAttack(scenario.id)}
              className="flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-mono font-bold text-white uppercase tracking-wider transition hover:bg-red-500"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Fire Scenario</span>
            </button>
          </div>

          {/* Sequential Attack Steps Flow */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-mono uppercase text-gray-500">Sequential Attack Chain</h4>
            {scenario.steps.map((step) => (
              <div
                key={step.step}
                className="flex items-start gap-2.5 rounded border border-gray-800 bg-[#0B0E14] p-2.5"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-900/40 font-mono text-[10px] font-bold text-red-400 border border-red-800/60">
                  {step.step}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-xs font-bold text-gray-200">{step.eventName}</span>
                    <span className="text-[10px] text-blue-400">{step.entity}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{step.description}</p>
                  <div className="rounded bg-[#161B22] p-1.5 font-mono text-[10px] text-green-400 border border-gray-800">
                    <code>{step.payloadSnippet}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom CloudTrail JSON Evaluator Workbench */}
      <div className="rounded bg-[#161B22] border border-gray-800 p-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
              Custom CloudTrail Event JSON Workbench
            </h3>
          </div>
          <button
            onClick={handleTestCustomJson}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-mono font-bold text-white uppercase tracking-wider transition hover:bg-blue-500"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Score Payload</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 font-mono">
          {/* JSON Editor (7 cols) */}
          <div className="lg:col-span-7">
            <textarea
              rows={11}
              value={customJsonInput}
              onChange={(e) => setCustomJsonInput(e.target.value)}
              className="w-full rounded border border-gray-800 bg-[#0B0E14] p-3 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
              placeholder="Paste raw AWS CloudTrail JSON here..."
            />
            {evalError && (
              <div className="mt-2 rounded bg-red-950/40 p-2 text-xs text-red-400 border border-red-800/50">
                ⚠️ {evalError}
              </div>
            )}
          </div>

          {/* Live Inference Output (5 cols) */}
          <div className="rounded border border-gray-800 bg-[#0B0E14] p-3 lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-[11px] font-bold text-gray-300 uppercase">Live Model Inference</span>
                {customEvalResult && (
                  <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${
                    customEvalResult.isAnomaly ? 'bg-red-950/50 border-red-800/60 text-red-400' : 'bg-green-950/50 border-green-800/60 text-green-400'
                  }`}>
                    {customEvalResult.isAnomaly ? 'ANOMALOUS' : 'BENIGN'}
                  </span>
                )}
              </div>

              {customEvalResult ? (
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-sans">Ensemble Confidence:</span>
                    <span className="font-bold text-red-400">
                      {(customEvalResult.ensembleConfidenceScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-sans">Isolation Forest Score:</span>
                    <span className="text-blue-400">{customEvalResult.isolationForestScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-sans">LSTM Autoencoder MSE:</span>
                    <span className="text-purple-400">{customEvalResult.lstmAutoencoderScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-sans">Role Chaining Depth:</span>
                    <span className="text-gray-200">{customEvalResult.features?.assumeRoleDepth ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-sans">High-Risk Actions:</span>
                    <span className="text-gray-200">{customEvalResult.features?.highRiskActionCount ?? 0}</span>
                  </div>

                  <div className="mt-2 border-t border-gray-800 pt-2">
                    <span className="text-[10px] text-gray-500 uppercase">MITRE Attribution:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {customEvalResult.mitreTechniques?.map((m) => (
                        <span key={m?.id} className="rounded bg-[#161B22] border border-gray-800 px-1.5 py-0.2 text-[9px] text-blue-400">
                          {m?.id} - {m?.name?.split(':')?.[0] || m?.name || m?.id}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-44 flex-col items-center justify-center text-center text-gray-500">
                  <Code className="h-6 w-6 text-gray-600" />
                  <p className="mt-2 text-[11px] font-sans">Click "Score Payload" to evaluate the JSON above.</p>
                </div>
              )}
            </div>

            {customEvalResult && (
              <button
                onClick={() => onSelectAlert(customEvalResult)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-[#161B22] border border-gray-800 py-1 text-xs font-bold text-gray-300 hover:bg-gray-800 hover:text-white transition"
              >
                <span>Open Incident Drilldown</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
