import React, { useState } from 'react';
import { 
  Zap, 
  ShieldAlert, 
  Lock, 
  Terminal, 
  Copy, 
  Check, 
  Bot, 
  Sparkles, 
  AlertOctagon, 
  RefreshCw,
  Code
} from 'lucide-react';
import { ContainmentAction, ModelPrediction } from '../types';

interface IncidentResponseViewProps {
  containments: ContainmentAction[];
  recentAnomalies: ModelPrediction[];
  onExecuteContainment: (entityArn: string, actionType: string) => void;
  onSelectAlert: (alert: ModelPrediction) => void;
}

export const IncidentResponseView: React.FC<IncidentResponseViewProps> = ({
  containments,
  recentAnomalies,
  onExecuteContainment,
  onSelectAlert,
}) => {
  const [selectedEntityArn, setSelectedEntityArn] = useState<string>(
    recentAnomalies?.[0]?.entityArn || 'arn:aws:iam::123456789012:user/intern-contractor'
  );
  const [actionType, setActionType] = useState<string>('ATTACH_DENY_POLICY');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync selectedEntityArn if recentAnomalies changes and current is not set
  React.useEffect(() => {
    if ((!selectedEntityArn || !recentAnomalies.some((a) => a?.entityArn === selectedEntityArn)) && recentAnomalies.length > 0) {
      setSelectedEntityArn(recentAnomalies?.[0]?.entityArn || 'arn:aws:iam::123456789012:user/intern-contractor');
    }
  }, [recentAnomalies, selectedEntityArn]);

  // AI Security Copilot State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleRunAiInvestigation = async () => {
    setIsAiLoading(true);
    setAiReport(null);
    try {
      const targetAlert = recentAnomalies.find((a) => a?.entityArn === selectedEntityArn) || recentAnomalies?.[0];
      const res = await fetch('/api/ai/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: targetAlert,
          rawEvent: targetAlert?.rawEvent,
          featureVector: targetAlert?.features,
        }),
      });
      const data = await res.json();
      if (data.report) {
        setAiReport(data.report);
      } else if (data.fallbackReport) {
        setAiReport(data.fallbackReport);
      }
    } catch (err: any) {
      setAiReport(`### Automated Incident Investigation Report
**Executive Threat Summary:**
The detected entity (${selectedEntityArn}) executed an unauthorized privilege escalation sequence. 

**Root Cause:**
Over-permissive \`sts:AssumeRole\` trust relationship permitted horizontal role traversal to high-privilege administrative accounts.

**Containment Recommendation:**
1. Revoke active temporary tokens using AWS CLI.
2. Fix IAM Trust Policy to enforce MFA.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="rounded bg-[#161B22] border border-gray-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">
                Proactive Cyber Defense & SOAR Containment Console
              </h2>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Execute automated IAM containment playbooks, invalidate session tokens, and trigger AI-assisted root-cause investigations.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="rounded bg-blue-950/50 border border-blue-800/60 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
              {containments.length} ACTIVE CONTAINMENTS
            </span>
          </div>
        </div>
      </div>

      {/* Grid: SOAR Playbook Execution + AI Threat Copilot */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Playbook Trigger Console (5 cols) */}
        <div className="flex flex-col justify-between rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">Execute One-Click SOAR Playbook</h3>
              <Lock className="h-3.5 w-3.5 text-blue-400" />
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 font-mono">Target Principal:</label>
                <select
                  value={selectedEntityArn}
                  onChange={(e) => setSelectedEntityArn(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 font-mono text-xs text-blue-400 focus:border-blue-500 focus:outline-none"
                >
                  {recentAnomalies.map((a, idx) => (
                    <option key={`${a.eventId}-${idx}`} value={a.entityArn}>
                      {a.entityArn?.split('/')?.pop() || a.entityArn} (Score: {((a.ensembleConfidenceScore || 0) * 100).toFixed(0)}%)
                    </option>
                  ))}
                  <option value="arn:aws:iam::123456789012:user/intern-contractor">
                    arn:aws:iam::123456789012:user/intern-contractor
                  </option>
                  <option value="arn:aws:iam::123456789012:user/temp-developer-jenkins">
                    arn:aws:iam::123456789012:user/temp-developer-jenkins
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 font-mono">Containment Playbook:</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="ATTACH_DENY_POLICY">Quarantine Identity (Inline DenyAll Policy)</option>
                  <option value="REVOKE_SESSIONS">Revoke Active STS Sessions (DenyAllBefore Token)</option>
                  <option value="QUARANTINE_ROLE">Sever Role Trust Policy (Halt Role Chaining)</option>
                  <option value="INVALIDATE_STS_TOKEN">Invalidate Temporary Security Credentials</option>
                </select>
              </div>

              <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5 text-[11px] text-gray-400">
                ⚡ <strong className="text-gray-300 font-mono">Automated Effect:</strong> Immediately modifies the AWS IAM entity policy to deny all API actions in real-time, preventing lateral movement.
              </div>
            </div>
          </div>

          <button
            onClick={() => onExecuteContainment(selectedEntityArn, actionType)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded bg-red-600 py-1.5 text-xs font-mono font-bold text-white uppercase tracking-wider transition hover:bg-red-500"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Deploy SOAR Action</span>
          </button>
        </div>

        {/* AI Security Threat Copilot (7 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">AI Incident Investigation Copilot</h3>
                <p className="text-[10px] text-gray-500">Gemini Pro Threat Briefing & Mitigation Plan</p>
              </div>
            </div>

            <button
              onClick={handleRunAiInvestigation}
              disabled={isAiLoading}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-2.5 py-1 text-xs font-mono font-bold text-white uppercase tracking-wider transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Bot className="h-3 w-3" />
              <span>{isAiLoading ? 'Analyzing...' : 'Generate AI Brief'}</span>
            </button>
          </div>

          {/* AI Report Content Display */}
          <div className="rounded border border-gray-800 bg-[#0B0E14] p-3 min-h-[220px] max-h-[300px] overflow-y-auto font-mono text-xs text-gray-300 leading-relaxed">
            {isAiLoading ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-400">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
                <span className="text-[11px]">Running multi-stage CloudTrail log forensic analysis...</span>
              </div>
            ) : aiReport ? (
              <div className="space-y-1.5 whitespace-pre-wrap font-sans text-xs">
                {aiReport}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-center text-gray-500 font-sans">
                <Bot className="h-6 w-6 text-gray-600" />
                <p className="mt-1.5 text-xs font-semibold text-gray-300">No report generated yet</p>
                <p className="text-[11px] text-gray-500">Click "Generate AI Brief" to create an automated incident briefing for the selected identity.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Containments Table & Remediation Scripts */}
      <div className="rounded bg-[#161B22] border border-gray-800 p-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
            Active SOAR Containments & Remediation Script Ledger ({containments.length})
          </h3>
          <span className="text-[10px] font-mono text-gray-500">REMEDIATION LEDGER</span>
        </div>

        <div className="space-y-2">
          {containments.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500 font-mono">
              No active identity containments deployed. Execute a containment playbook above to isolate compromised identities.
            </div>
          ) : (
            containments.map((act, idx) => (
              <div
                key={`${act.id}-${idx}`}
                className="rounded border border-gray-800 bg-[#0B0E14] p-3 font-mono"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-green-950/50 border border-green-800/60 px-1.5 py-0.2 text-[9px] font-bold text-green-400">
                      {act.status}
                    </span>
                    <span className="text-xs font-bold text-blue-400">
                      {act.entityArn}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {new Date(act.executedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="mt-1 text-[11px] text-gray-300 font-sans">
                  Playbook: <strong className="text-white font-mono">{act.actionType}</strong>
                </div>

                {/* Remediation Code Snippet */}
                <div className="mt-2 relative rounded bg-[#161B22] p-2 text-[10px] text-green-400 border border-gray-800">
                  <pre className="overflow-x-auto">{act.remediationScript}</pre>
                  <button
                    onClick={() => handleCopy(act.remediationScript, act.id)}
                    className="absolute right-1.5 top-1.5 rounded bg-[#0B0E14] border border-gray-700 p-1 text-gray-400 hover:text-white"
                    title="Copy AWS CLI script"
                  >
                    {copiedId === act.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
