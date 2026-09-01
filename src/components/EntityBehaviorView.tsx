import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserCheck, 
  ShieldAlert, 
  Clock, 
  Globe, 
  AlertOctagon, 
  Layers, 
  Zap, 
  CheckCircle,
  Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Legend, 
  Tooltip 
} from 'recharts';
import { ModelPrediction } from '../types';

interface EntityBehaviorViewProps {
  predictions: ModelPrediction[];
  onContainEntity: (entityArn: string, actionType: string) => void;
  onSelectAlert: (alert: ModelPrediction) => void;
}

export const EntityBehaviorView: React.FC<EntityBehaviorViewProps> = ({
  predictions,
  onContainEntity,
  onSelectAlert,
}) => {
  // Extract unique identities
  const entities = useMemo(() => {
    const map = new Map<string, { arn: string; type: string; totalEvents: number; anomalyCount: number; maxScore: number }>();
    for (const p of predictions) {
      if (!p || !p.entityArn) continue;
      if (!map.has(p.entityArn)) {
        map.set(p.entityArn, {
          arn: p.entityArn,
          type: p.rawEvent?.userIdentity?.type || 'IAMUser',
          totalEvents: 0,
          anomalyCount: 0,
          maxScore: 0,
        });
      }
      const entry = map.get(p.entityArn)!;
      entry.totalEvents++;
      if (p.isAnomaly) entry.anomalyCount++;
      if ((p.ensembleConfidenceScore || 0) > entry.maxScore) entry.maxScore = p.ensembleConfidenceScore || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.maxScore - a.maxScore);
  }, [predictions]);

  const [selectedArn, setSelectedArn] = useState<string>(entities?.[0]?.arn || '');

  // Keep selectedArn synced when entities change if not set
  useEffect(() => {
    if ((!selectedArn || !entities.some((e) => e?.arn === selectedArn)) && entities.length > 0) {
      if (entities[0]?.arn) {
        setSelectedArn(entities[0].arn);
      }
    }
  }, [entities, selectedArn]);

  // Current entity predictions
  const currentEntityPredictions = useMemo(() => {
    const targetArn = selectedArn || entities?.[0]?.arn || '';
    return predictions.filter((p) => p && p.entityArn === targetArn);
  }, [predictions, selectedArn, entities]);

  // Radar comparison data (Baseline vs Current Observed)
  const radarData = useMemo(() => {
    if (currentEntityPredictions.length === 0) return [];
    
    // Calculate averages for current entity
    let sumApi = 0;
    let sumRole = 0;
    let sumHighRisk = 0;
    let sumDenied = 0;
    let sumIpEntropy = 0;
    let sumOffHours = 0;

    for (const p of currentEntityPredictions) {
      if (!p || !p.features) continue;
      sumApi += p.features.apiCallCount || 0;
      sumRole += p.features.assumeRoleDepth || 0;
      sumHighRisk += p.features.highRiskActionCount || 0;
      sumDenied += p.features.accessDeniedCount || 0;
      sumIpEntropy += p.features.ipEntropy || 0;
      sumOffHours += p.features.offHoursScore || 0;
    }

    const n = currentEntityPredictions.length;
    const isAttacker = currentEntityPredictions.some((p) => p.isAnomaly);

    return [
      {
        subject: 'API Call Velocity',
        Observed: Math.min(100, Math.round((sumApi / n) * 8)),
        Baseline: 15,
        fullMark: 100,
      },
      {
        subject: 'AssumeRole Depth',
        Observed: Math.min(100, Math.round((sumRole / n) * 33)),
        Baseline: isAttacker ? 0 : 5,
        fullMark: 100,
      },
      {
        subject: 'Sensitive IAM Actions',
        Observed: Math.min(100, Math.round((sumHighRisk / n) * 40)),
        Baseline: 5,
        fullMark: 100,
      },
      {
        subject: 'AccessDenied Spikes',
        Observed: Math.min(100, Math.round((sumDenied / n) * 25)),
        Baseline: 2,
        fullMark: 100,
      },
      {
        subject: 'IP Dispersion / Entropy',
        Observed: Math.min(100, Math.round((sumIpEntropy / n) * 45)),
        Baseline: 10,
        fullMark: 100,
      },
      {
        subject: 'Off-Hours Deviation',
        Observed: Math.min(100, Math.round((sumOffHours / n) * 100)),
        Baseline: 15,
        fullMark: 100,
      },
    ];
  }, [currentEntityPredictions]);

  const selectedEntityMeta = entities.find((e) => e?.arn === selectedArn) || entities?.[0] || {
    arn: selectedArn || 'arn:aws:iam::123456789012:user/default-principal',
    type: 'IAMUser',
    totalEvents: 0,
    anomalyCount: 0,
    maxScore: 0,
    roleHops: 0,
    rareApiCount: 0,
    accessDeniedCount: 0,
    lastSeen: '',
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Identity Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-[#161B22] border border-gray-800 p-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">
              UEBA Identity Behavioral Profile & Risk Assessment
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Per-identity statistical baseline profiling vs real-time observed CloudTrail API deviations.
          </p>
        </div>

        {/* Entity Selector Dropdown */}
        <div className="flex items-center gap-2 font-mono">
          <label className="text-[11px] font-semibold text-gray-400">Select Principal:</label>
          <select
            value={selectedArn}
            onChange={(e) => setSelectedArn(e.target.value)}
            className="rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs text-blue-400 focus:border-blue-500 focus:outline-none"
          >
            {entities.map((e) => (
              <option key={e.arn} value={e.arn}>
                {e.arn?.split('/')?.pop() || e.arn} ({e.type}) — {e.anomalyCount > 0 ? `🚨 ${e.anomalyCount} Anomalies` : '✓ Benign'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Radar Chart + Identity Profile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Radar Chart: Baseline vs Observed (6 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
              Behavioral Deviation Radar (Baseline vs Observed)
            </h3>
            <span className="text-[10px] font-mono text-gray-500">6 UEBA DIMENSIONS</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 8 }} />
                <Radar name="Observed Activity" dataKey="Observed" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} />
                <Radar name="Learned Baseline" dataKey="Baseline" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B0E14', borderColor: '#374151', borderRadius: '4px', fontSize: '11px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Identity Details & Containment Action Panel (6 cols) */}
        <div className="flex flex-col justify-between rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">Identity Risk Profile & Trust State</h3>
                <p className="font-mono text-xs text-blue-400 break-all">{selectedArn}</p>
              </div>
              <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                (selectedEntityMeta?.maxScore || 0) >= 0.70
                  ? 'bg-red-950/50 border-red-800/60 text-red-400 animate-pulse'
                  : 'bg-green-950/50 border-green-800/60 text-green-400'
              }`}>
                {(selectedEntityMeta?.maxScore || 0) >= 0.70 ? 'COMPROMISED / HIGH RISK' : 'NORMAL / TRUSTED'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div className="rounded border border-gray-800 bg-[#0B0E14] p-2">
                <span className="text-[9px] text-gray-500 uppercase">Total Events</span>
                <div className="text-base font-bold text-gray-100">{selectedEntityMeta?.totalEvents || 0}</div>
              </div>
              <div className="rounded border border-gray-800 bg-[#0B0E14] p-2">
                <span className="text-[9px] text-gray-500 uppercase">Threat Alerts</span>
                <div className="text-base font-bold text-red-400">{selectedEntityMeta?.anomalyCount || 0}</div>
              </div>
              <div className="rounded border border-gray-800 bg-[#0B0E14] p-2">
                <span className="text-[9px] text-gray-500 uppercase">Peak Anomaly</span>
                <div className="text-base font-bold text-orange-400">
                  {((selectedEntityMeta?.maxScore || 0) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Quarantine & SOAR Action Box */}
            <div className="mt-3 rounded border border-blue-900/50 bg-[#0F1219] p-3 font-sans">
              <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">Recommended SOAR Action</h4>
              <p className="mt-1 text-[11px] text-gray-400">
                {(selectedEntityMeta?.maxScore || 0) >= 0.70
                  ? 'High confidence identity abuse detected. Immediate IAM session invalidation and boundary policy isolation recommended.'
                  : 'Identity is operating within normal baseline variance. Continuous passive monitoring active.'}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 font-mono">
                <button
                  onClick={() => onContainEntity(selectedArn, 'ATTACH_DENY_POLICY')}
                  className="flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-bold text-white uppercase tracking-wider transition hover:bg-red-500"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Attach Quarantine DenyAll</span>
                </button>

                <button
                  onClick={() => onContainEntity(selectedArn, 'REVOKE_SESSIONS')}
                  className="flex items-center gap-1.5 rounded bg-[#161B22] border border-gray-800 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"
                >
                  <AlertOctagon className="h-3.5 w-3.5" />
                  <span>Revoke STS Sessions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline for this Identity */}
      <div className="rounded bg-[#161B22] border border-gray-800 p-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
            Historical Event Stream for Selected Identity ({currentEntityPredictions.length} records)
          </h3>
          <span className="text-[10px] font-mono text-gray-500">AUDIT LOG</span>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1.5 font-mono">
          {currentEntityPredictions.map((item) => (
            <div
              key={item.eventId}
              onClick={() => onSelectAlert(item)}
              className={`flex cursor-pointer items-center justify-between rounded border p-2 text-xs transition ${
                item.isAnomaly
                  ? 'border-red-900/60 bg-red-950/20 hover:bg-red-950/30'
                  : 'border-gray-800 bg-[#0B0E14] hover:bg-gray-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className={`text-[11px] font-bold ${item.isAnomaly ? 'text-red-400' : 'text-green-400'}`}>
                  {item.rawEvent?.eventName || 'CloudTrailAction'}
                </span>
                <span className="text-[10px] text-gray-500 truncate">{item.rawEvent?.eventSource || 'aws'}</span>
                <span className="text-[10px] text-gray-400">IP: {item.rawEvent?.sourceIPAddress || '0.0.0.0'}</span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[10px] text-gray-500">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
                <span className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${
                  item.isAnomaly ? 'bg-red-900/40 border-red-800/60 text-red-300' : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}>
                  {(item.ensembleConfidenceScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
