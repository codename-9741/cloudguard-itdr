import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Search, 
  ExternalLink, 
  Zap, 
  Layers, 
  BarChart3, 
  CheckCircle, 
  Eye,
  GitCommit
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { ModelPrediction, Severity } from '../types';

interface DashboardViewProps {
  predictions: ModelPrediction[];
  onSelectAlert: (alert: ModelPrediction) => void;
  onContainEntity: (entityArn: string, actionType: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  predictions,
  onSelectAlert,
  onContainEntity,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedMitre, setSelectedMitre] = useState<string>('ALL');

  // Filtered threat alerts
  const alerts = useMemo(() => {
    return predictions.filter((p) => {
      if (!p) return false;
      if (!p.isAnomaly && selectedSeverity !== 'ALL_WITH_NORMAL') return false;
      if (selectedSeverity !== 'ALL' && selectedSeverity !== 'ALL_WITH_NORMAL' && p.severity !== selectedSeverity) return false;
      if (selectedMitre !== 'ALL' && !p.mitreTechniques?.some((t) => t?.id === selectedMitre)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchEntity = (p.entityArn || '').toLowerCase().includes(q);
        const matchAction = (p.rawEvent?.eventName || '').toLowerCase().includes(q);
        const matchIp = (p.rawEvent?.sourceIPAddress || '').toLowerCase().includes(q);
        const matchMitre = p.mitreTechniques?.some((t) => (t?.id || '').toLowerCase().includes(q) || (t?.name || '').toLowerCase().includes(q)) ?? false;
        return matchEntity || matchAction || matchIp || matchMitre;
      }
      return true;
    });
  }, [predictions, selectedSeverity, selectedMitre, searchQuery]);

  // Top Risky Entities calculation
  const topRiskyEntities = useMemo(() => {
    const entityMap: Record<string, { arn: string; count: number; maxScore: number; roleHops: number; lastSeen: string; criticals: number }> = {};
    for (const p of predictions) {
      if (!p || !p.entityArn) continue;
      if (!entityMap[p.entityArn]) {
        entityMap[p.entityArn] = {
          arn: p.entityArn,
          count: 0,
          maxScore: 0,
          roleHops: 0,
          lastSeen: p.timestamp || '',
          criticals: 0,
        };
      }
      entityMap[p.entityArn].count++;
      if ((p.ensembleConfidenceScore || 0) > entityMap[p.entityArn].maxScore) {
        entityMap[p.entityArn].maxScore = p.ensembleConfidenceScore || 0;
      }
      if (p.features?.assumeRoleDepth && p.features.assumeRoleDepth > entityMap[p.entityArn].roleHops) {
        entityMap[p.entityArn].roleHops = p.features.assumeRoleDepth;
      }
      if (p.severity === 'CRITICAL') {
        entityMap[p.entityArn].criticals++;
      }
    }
    return Object.values(entityMap)
      .sort((a, b) => b.maxScore - a.maxScore || b.count - a.count)
      .slice(0, 5);
  }, [predictions]);

  // Histogram bins (0.0 to 1.0)
  const histogramData = useMemo(() => {
    const bins = [
      { bin: '0.0 - 0.2', count: 0, color: '#10b981' },
      { bin: '0.2 - 0.4', count: 0, color: '#3b82f6' },
      { bin: '0.4 - 0.6', count: 0, color: '#f59e0b' },
      { bin: '0.6 - 0.8', count: 0, color: '#f97316' },
      { bin: '0.8 - 1.0', count: 0, color: '#ef4444' },
    ];
    for (const p of predictions) {
      if (!p) continue;
      const score = p.ensembleConfidenceScore ?? 0;
      if (score < 0.2) bins[0].count++;
      else if (score < 0.4) bins[1].count++;
      else if (score < 0.6) bins[2].count++;
      else if (score < 0.8) bins[3].count++;
      else bins[4].count++;
    }
    return bins;
  }, [predictions]);

  // Severity Distribution for Donut Chart
  const severityData = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFORMATIONAL: 0 };
    for (const p of predictions) {
      if (!p || !p.severity) continue;
      counts[p.severity] = (counts[p.severity] || 0) + 1;
    }
    return [
      { name: 'Critical (>85%)', value: counts.CRITICAL, color: '#ef4444' },
      { name: 'High (70-85%)', value: counts.HIGH, color: '#f97316' },
      { name: 'Medium (50-70%)', value: counts.MEDIUM, color: '#f59e0b' },
      { name: 'Low (35-50%)', value: counts.LOW, color: '#3b82f6' },
      { name: 'Normal / Info', value: counts.INFORMATIONAL, color: '#10b981' },
    ].filter((item) => item.value > 0);
  }, [predictions]);

  // MITRE ATT&CK Cloud Matrix summary
  const mitreSummary = useMemo(() => {
    const techniques: Record<string, { id: string; name: string; tactic: string; hits: number; maxScore: number }> = {
      'T1548.005': { id: 'T1548.005', name: 'IAM Role Chaining (Temporary Elevated Access)', tactic: 'Privilege Escalation', hits: 0, maxScore: 0 },
      'T1098': { id: 'T1098', name: 'Policy Version Injection & Account Manipulation', tactic: 'Persistence', hits: 0, maxScore: 0 },
      'T1078': { id: 'T1078', name: 'Valid Accounts & Compromised Keys Spraying', tactic: 'Defense Evasion', hits: 0, maxScore: 0 },
      'T1530': { id: 'T1530', name: 'S3 Data Storage Exfiltration', tactic: 'Exfiltration', hits: 0, maxScore: 0 },
    };

    for (const p of predictions) {
      if (p.isAnomaly && p.mitreTechniques) {
        for (const t of p.mitreTechniques) {
          if (techniques[t.id]) {
            techniques[t.id].hits++;
            if (p.ensembleConfidenceScore > techniques[t.id].maxScore) {
              techniques[t.id].maxScore = p.ensembleConfidenceScore;
            }
          }
        }
      }
    }
    return Object.values(techniques);
  }, [predictions]);

  const getSeverityBadge = (sev: Severity) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="rounded bg-red-900/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-400 border border-red-800/50">CRITICAL</span>;
      case 'HIGH':
        return <span className="rounded bg-orange-900/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-400 border border-orange-800/50">HIGH</span>;
      case 'MEDIUM':
        return <span className="rounded bg-amber-900/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400 border border-amber-800/50">MEDIUM</span>;
      case 'LOW':
        return <span className="rounded bg-blue-900/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-400 border border-blue-800/50">LOW</span>;
      default:
        return <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-400">INFO</span>;
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 4-Panel SOC Dashboard Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* PANEL 1: Real-Time Alert Timeline & Threat Feed (7 cols) */}
        <div className="flex flex-col rounded bg-[#161B22] border border-gray-800 overflow-hidden lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#1C2128] border-b border-gray-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-100">
                Real-Time Threat Queue (CloudTrail)
              </h2>
              <span className="text-[10px] font-mono bg-red-900/30 text-red-400 px-2 py-0.5 rounded border border-red-800/50 animate-pulse">
                {alerts.length} ANOMALIES
              </span>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono">
              <div className="relative">
                <Search className="absolute left-2.5 top-1.5 h-3 w-3 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter logs / ARN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40 rounded border border-gray-800 bg-[#0B0E14] py-1 pl-7 pr-2 text-[11px] text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="rounded border border-gray-800 bg-[#0B0E14] px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">Anomalies Only ({predictions.filter(p => p?.isAnomaly).length})</option>
                <option value="CRITICAL">Critical ({predictions.filter(p => p?.severity === 'CRITICAL').length})</option>
                <option value="HIGH">High ({predictions.filter(p => p?.severity === 'HIGH').length})</option>
                <option value="MEDIUM">Medium ({predictions.filter(p => p?.severity === 'MEDIUM').length})</option>
                <option value="ALL_WITH_NORMAL">All Logs (Normal + Alert) ({predictions.length})</option>
              </select>

              <select
                value={selectedMitre}
                onChange={(e) => setSelectedMitre(e.target.value)}
                className="rounded border border-gray-800 bg-[#0B0E14] px-2 py-1 text-[11px] text-gray-300 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All MITRE</option>
                <option value="T1548.005">T1548.005 Role Chaining</option>
                <option value="T1098">T1098 Policy Injection</option>
                <option value="T1078">T1078 Valid Accounts</option>
                <option value="T1530">T1530 S3 Exfil</option>
              </select>
            </div>
          </div>

          {/* Alert Queue List */}
          <div className="flex-1 space-y-2 p-3 overflow-y-auto max-h-[520px]">
            {alerts.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center rounded border border-dashed border-gray-800 text-center bg-[#0B0E14]/40">
                <CheckCircle className="h-6 w-6 text-green-400/60" />
                <p className="mt-2 text-xs font-semibold text-gray-300 font-mono">No matching threat anomalies</p>
                <p className="text-[10px] text-gray-500">Inject an attack scenario or adjust filters.</p>
              </div>
            ) : (
              alerts.map((alert, index) => {
                const confidencePct = Math.round(alert.ensembleConfidenceScore * 100);
                const isCrit = alert.severity === 'CRITICAL';
                const isHigh = alert.severity === 'HIGH';
                const isMed = alert.severity === 'MEDIUM';

                return (
                  <div
                    key={`${alert.eventId}-${index}`}
                    className={`rounded-r border-l-2 p-2.5 transition bg-[#0B0E14] ${
                      isCrit
                        ? 'border-red-500 border-t border-r border-b border-gray-800/80 bg-red-950/10'
                        : isHigh
                        ? 'border-orange-500 border-t border-r border-b border-gray-800/80 bg-orange-950/10'
                        : isMed
                        ? 'border-amber-500 border-t border-r border-b border-gray-800/80'
                        : 'border-gray-700 border-t border-r border-b border-gray-800/80 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {getSeverityBadge(alert.severity)}
                          <span className="font-mono text-xs font-bold text-gray-100">
                            {alert.rawEvent.eventName}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500">
                            ({alert.rawEvent.eventSource})
                          </span>
                          {alert.features.assumeRoleDepth > 0 && (
                            <span className="rounded bg-blue-900/30 border border-blue-800/50 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-blue-300">
                              Hop Depth: {alert.features.assumeRoleDepth}
                            </span>
                          )}
                        </div>

                        <p className="font-mono text-xs text-blue-300 break-all">
                          {alert.entityArn}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] text-gray-400 font-mono">
                          <span>IP: <strong className="text-gray-300">{alert.rawEvent.sourceIPAddress}</strong></span>
                          <span>•</span>
                          <span>Time: {new Date(alert.timestamp).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span>IF: {alert.isolationForestScore} | LSTM: {alert.lstmAutoencoderScore}</span>
                        </div>
                      </div>

                      {/* Score Gauge & Action */}
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="text-right">
                          <div className="flex items-center gap-1 font-mono text-xs font-bold">
                            <span className={isCrit ? 'text-red-400' : isHigh ? 'text-orange-400' : 'text-blue-400'}>
                              {confidencePct}%
                            </span>
                            <span className="text-[9px] uppercase text-gray-500">Score</span>
                          </div>
                          <div className="mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className={`h-full ${
                                confidencePct >= 85
                                  ? 'bg-red-500'
                                  : confidencePct >= 70
                                  ? 'bg-orange-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${confidencePct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onSelectAlert(alert)}
                            className="flex items-center gap-1 rounded bg-[#161B22] border border-gray-800 px-2 py-0.5 text-[10px] font-mono font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Drilldown</span>
                          </button>

                          {alert.isAnomaly && (
                            <button
                              onClick={() => onContainEntity(alert.entityArn, 'ATTACH_DENY_POLICY')}
                              className="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-mono font-bold text-white uppercase tracking-wider transition hover:bg-red-500"
                              title="Execute SOAR IAM Quarantine"
                            >
                              <Zap className="h-3 w-3" />
                              <span>Contain</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* MITRE Badges & XAI summary */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-gray-800/80 pt-1.5 font-mono">
                      {alert.mitreTechniques?.map((m, mIdx) => (
                        <span
                          key={`${m.id || 'mitre'}-${mIdx}`}
                          className="inline-flex items-center rounded bg-[#161B22] border border-gray-800 px-1.5 py-0.2 text-[9px] font-medium text-gray-300"
                        >
                          <strong className="text-blue-400 mr-1">{m?.id}</strong> {m?.name?.split(':')?.[0] || m?.name || m?.id}
                        </span>
                      ))}
                      {alert.xaiTopContributors?.[0] && (
                        <span className="text-[10px] text-gray-400 italic">
                          ↳ {alert.xaiTopContributors[0]?.explanation}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL 2: Top Risky IAM Entities & Role Chaining Visualizer (5 cols) */}
        <div className="flex flex-col space-y-4 lg:col-span-5">
          {/* Top Risky Identities Container */}
          <div className="bg-[#161B22] border border-gray-800 p-4 rounded flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-400" />
                <h3 className="text-[11px] uppercase text-gray-400 font-bold tracking-wider">
                  High Risk Identities (UEBA)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-500">RANKED</span>
            </div>

            {/* Top Risky Identities List */}
            <div className="space-y-2">
              {topRiskyEntities.map((entity, idx) => {
                const shortName = entity.arn?.split('/')?.pop() || entity.arn || 'Unknown Principal';
                const isCrit = entity.maxScore >= 0.85;
                const isHigh = entity.maxScore >= 0.70 && entity.maxScore < 0.85;

                return (
                  <div
                    key={`${entity.arn}-${idx}`}
                    className={`flex items-center justify-between p-2 bg-[#0B0E14] border-l-2 rounded-r ${
                      isCrit
                        ? 'border-red-500'
                        : isHigh
                        ? 'border-orange-500'
                        : 'border-gray-700 opacity-80'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-gray-500">#{idx + 1}</span>
                        <p className="text-xs font-bold text-gray-100 truncate font-mono" title={entity.arn}>
                          {shortName}
                        </p>
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {entity.criticals > 0 ? 'Threat Activity Detected' : 'Normal / Low Drift'} • {entity.roleHops} Hops
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-mono font-bold ${isCrit ? 'text-red-500' : isHigh ? 'text-orange-500' : 'text-gray-400'}`}>
                        {(entity.maxScore * 100).toFixed(1)}
                      </span>
                      <button
                        onClick={() => onContainEntity(entity.arn, 'ATTACH_DENY_POLICY')}
                        className="rounded bg-red-950/60 border border-red-800/50 p-1 text-red-400 hover:bg-red-900/60"
                        title="Quarantine Identity via SOAR"
                      >
                        <Zap className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Defense Action Box */}
          <div className="bg-[#0F1219] border border-blue-900/50 p-4 rounded">
            <h3 className="text-[10px] uppercase text-blue-400 font-bold mb-2 tracking-wider">Active Defense Action</h3>
            <div className="bg-blue-600/10 border border-blue-600/60 p-3 rounded">
              <p className="text-[11px] text-blue-200 leading-relaxed font-sans">
                SOAR Auto-remediation armed: ML engine isolates multi-hop STS tokens and enforces SCP DenyAll policy on confirmed compromised principals.
              </p>
              {topRiskyEntities?.[0]?.arn && (
                <button
                  onClick={() => onContainEntity(topRiskyEntities[0]?.arn, 'ATTACH_DENY_POLICY')}
                  className="mt-3 w-full bg-blue-600 text-white text-[10px] py-1.5 font-bold font-mono uppercase tracking-wider rounded hover:bg-blue-500 transition"
                >
                  ⚡ Confirm Quarantine: {topRiskyEntities[0]?.arn?.split('/')?.pop() || topRiskyEntities[0]?.arn}
                </button>
              )}
            </div>
          </div>

          {/* Interactive Role Chaining Pivot Graph */}
          <div className="bg-[#161B22] border border-gray-800 rounded p-3 font-mono">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400 mb-2">
              <span>Role Chaining Graph (T1548.005)</span>
              <span className="text-blue-400">3 Hops to Admin</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 bg-[#0B0E14] p-1.5 rounded border border-gray-800">
                <span className="w-5 h-5 bg-red-900/40 text-red-400 border border-red-800/60 rounded flex items-center justify-center text-[10px] font-bold">U1</span>
                <span className="text-gray-300">user/intern-contractor</span>
                <span className="text-[9px] text-red-400 ml-auto">T1078</span>
              </div>
              <div className="text-center text-gray-600 text-[10px]">↓ sts:AssumeRole</div>
              <div className="flex items-center gap-2 bg-[#0B0E14] p-1.5 rounded border border-gray-800">
                <span className="w-5 h-5 bg-blue-900/40 text-blue-400 border border-blue-800/60 rounded flex items-center justify-center text-[10px] font-bold">R1</span>
                <span className="text-gray-300">role/DevInternalAccessRole</span>
                <span className="text-[9px] text-blue-400 ml-auto">Hop 1</span>
              </div>
              <div className="text-center text-gray-600 text-[10px]">↓ sts:AssumeRole</div>
              <div className="flex items-center gap-2 bg-[#0B0E14] p-1.5 rounded border border-red-900/40">
                <span className="w-5 h-5 bg-red-600 text-white rounded flex items-center justify-center text-[10px] font-bold">ADM</span>
                <span className="text-red-300 font-bold">role/SecOpsAdminRole</span>
                <span className="text-[9px] text-red-400 ml-auto font-bold">Target</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANELS 3 & 4: Statistical Analytics & MITRE ATT&CK Matrix */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 font-sans">
        {/* PANEL 3: Confidence Score Histogram & Severity Pie (6 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <h3 className="text-[11px] uppercase text-gray-400 font-bold tracking-wider">
                Principal Deviation & Score Distribution
              </h3>
            </div>
            <span className="text-[10px] font-mono text-gray-500">HISTOGRAM</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Recharts Score Bins Histogram */}
            <div className="h-48">
              <p className="text-[10px] font-mono uppercase text-gray-500 mb-1">Confidence Distribution</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="bin" tick={{ fill: '#64748b', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0E14', borderColor: '#374151', borderRadius: '4px', fontSize: '11px' }}
                    labelStyle={{ color: '#F3F4F6', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Severity Donut Chart */}
            <div className="h-48">
              <p className="text-[10px] font-mono uppercase text-gray-500 mb-1">Severity Partitioning</p>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0E14', borderColor: '#374151', borderRadius: '4px', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* PANEL 4: MITRE ATT&CK Cloud Matrix Heatmap (6 cols) */}
        <div className="rounded bg-[#161B22] border border-gray-800 p-4 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-green-400" />
              <h3 className="text-[11px] uppercase text-gray-400 font-bold tracking-wider">
                MITRE ATT&CK® Cloud Technique Matrix
              </h3>
            </div>
            <span className="text-[10px] font-mono text-gray-500">COVERAGE</span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 font-mono">
            {mitreSummary.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => setSelectedMitre(item.id)}
                className="cursor-pointer rounded border border-gray-800 bg-[#0B0E14] p-2.5 transition hover:border-blue-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-blue-950/50 border border-blue-800/50 px-1.5 py-0.2 text-[10px] font-bold text-blue-400">
                    {item.id}
                  </span>
                  <span className="text-[11px] font-bold text-red-400">
                    {item.hits} Hits
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] font-bold text-gray-200 font-sans truncate">
                  {item.name}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{item.tactic}</span>
                  <span className="text-orange-400">Peak: {(item.maxScore * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

};
