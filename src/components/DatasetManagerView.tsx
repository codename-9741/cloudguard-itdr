import React, { useState, useMemo } from 'react';
import { 
  Database, 
  Upload, 
  Download, 
  Search, 
  FileText, 
  CheckCircle, 
  Layers, 
  Code, 
  Play,
  RotateCcw,
  Cloud,
  Workflow
} from 'lucide-react';
import { CloudTrailEvent, TrainingMetrics } from '../types';
import { AwsIntegrationPanel } from './AwsIntegrationPanel';
import { AutomatedTrainingPipeline } from './AutomatedTrainingPipeline';

interface DatasetManagerViewProps {
  events: CloudTrailEvent[];
  onLoadDataset: (datasetType: string) => void;
  onUploadCustomLogs: (customEvents: CloudTrailEvent[]) => void;
  onInspectRawEvent: (event: CloudTrailEvent) => void;
  onIngestAwsEvents: (events: CloudTrailEvent[], sourceLabel: string) => void;
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

export const DatasetManagerView: React.FC<DatasetManagerViewProps> = ({
  events,
  onLoadDataset,
  onUploadCustomLogs,
  onInspectRawEvent,
  onIngestAwsEvents,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('ALL');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'AWS' | 'PIPELINE' | 'LOCAL'>('ALL');

  // Filtered log events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (!e) return false;
      if (selectedService !== 'ALL' && (!e.eventSource || !e.eventSource.includes(selectedService))) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (e.eventName || '').toLowerCase().includes(q);
        const matchSource = (e.eventSource || '').toLowerCase().includes(q);
        const matchArn = (e.userIdentity?.arn || e.userIdentity?.userName || '').toLowerCase().includes(q);
        const matchIp = (e.sourceIPAddress || '').toLowerCase().includes(q);
        return matchName || matchSource || matchArn || matchIp;
      }
      return true;
    });
  }, [events, selectedService, searchQuery]);

  // File Upload Handler (Drag-and-Drop or Click)
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        let logEvents: CloudTrailEvent[] = [];
        if (Array.isArray(parsed)) {
          logEvents = parsed;
        } else if (parsed.Records && Array.isArray(parsed.Records)) {
          logEvents = parsed.Records;
        } else if (parsed.events && Array.isArray(parsed.events)) {
          logEvents = parsed.events;
        } else {
          throw new Error('Unsupported JSON structure. Expected array or {"Records": [...]}');
        }

        onUploadCustomLogs(logEvents);
        setUploadStatus(`Successfully parsed and loaded ${logEvents.length} CloudTrail events!`);
        setTimeout(() => setUploadStatus(null), 5000);
      } catch (err: any) {
        setUploadStatus(`Error parsing JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cloudtrail_dataset_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Sub-Navigation Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-[#0F1219] p-2 rounded">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setActiveSubTab('ALL')}
            className={`rounded px-3 py-1 font-semibold transition ${
              activeSubTab === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-[#161B22] text-gray-400 hover:text-gray-200'
            }`}
          >
            All Ingestion Modules
          </button>
          <button
            onClick={() => setActiveSubTab('AWS')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 font-semibold transition ${
              activeSubTab === 'AWS'
                ? 'bg-blue-600 text-white'
                : 'bg-[#161B22] text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cloud className="h-3.5 w-3.5 text-blue-400" />
            <span>AWS Infrastructure Bridge</span>
          </button>
          <button
            onClick={() => setActiveSubTab('PIPELINE')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 font-semibold transition ${
              activeSubTab === 'PIPELINE'
                ? 'bg-blue-600 text-white'
                : 'bg-[#161B22] text-gray-400 hover:text-gray-200'
            }`}
          >
            <Workflow className="h-3.5 w-3.5 text-purple-400" />
            <span>Automated Training Pipeline</span>
          </button>
          <button
            onClick={() => setActiveSubTab('LOCAL')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 font-semibold transition ${
              activeSubTab === 'LOCAL'
                ? 'bg-blue-600 text-white'
                : 'bg-[#161B22] text-gray-400 hover:text-gray-200'
            }`}
          >
            <Upload className="h-3.5 w-3.5 text-green-400" />
            <span>Local Upload & Benchmarks</span>
          </button>
        </div>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs font-mono text-gray-300 transition hover:bg-gray-800 hover:text-white"
        >
          <Download className="h-3 w-3" />
          <span>Export Dataset JSON</span>
        </button>
      </div>

      {/* 1. Direct AWS Infrastructure Integration Component */}
      {(activeSubTab === 'ALL' || activeSubTab === 'AWS') && (
        <AwsIntegrationPanel onIngestAwsEvents={onIngestAwsEvents} />
      )}

      {/* 2. Automated Training Pipeline Component */}
      {(activeSubTab === 'ALL' || activeSubTab === 'PIPELINE') && (
        <AutomatedTrainingPipeline
          allEvents={events}
          trainingMetrics={trainingMetrics}
          onExecutePipelineTraining={onExecutePipelineTraining}
          isTraining={isTraining}
          fpRate={fpRate}
          awsEventsCount={awsEventsCount}
          localUploadedCount={localUploadedCount}
          ifWeight={ifWeight}
          lstmWeight={lstmWeight}
          onUpdateWeights={onUpdateWeights}
          threshold={threshold}
          onUpdateThreshold={onUpdateThreshold}
        />
      )}

      {/* 3. Benchmark Catalog & Local File Upload */}
      {(activeSubTab === 'ALL' || activeSubTab === 'LOCAL') && (
        <>
          {/* Header & Dataset Catalog */}
          <div className="rounded bg-[#161B22] border border-gray-800 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">
                    AWS CloudTrail Dataset Ingestion & Catalog
                  </h2>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Select pre-packaged real-world AWS benchmark datasets or upload custom CloudTrail JSON log files.
                </p>
              </div>
            </div>

            {/* Benchmark Datasets Quick Selector Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div
                onClick={() => onLoadDataset('ALL')}
                className="cursor-pointer rounded border border-gray-800 bg-[#0B0E14] p-2.5 transition hover:border-blue-500"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="rounded bg-blue-950/50 border border-blue-800/60 px-1.5 py-0.2 text-[9px] font-bold text-blue-400">
                    Full Suite
                  </span>
                  <span className="text-[11px] font-bold text-gray-200">1,240+ Events</span>
                </div>
                <h4 className="mt-1.5 text-xs font-bold text-gray-200">Combined Benchmark</h4>
                <p className="mt-0.5 text-[10px] text-gray-400">Normal Baseline + 4 Simulated IAM Attacks</p>
              </div>

              <div
                onClick={() => onLoadDataset('ROLE_CHAINING')}
                className="cursor-pointer rounded border border-gray-800 bg-[#0B0E14] p-2.5 transition hover:border-purple-500"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="rounded bg-purple-950/50 border border-purple-800/60 px-1.5 py-0.2 text-[9px] font-bold text-purple-400">
                    T1548.005
                  </span>
                  <span className="text-[11px] font-bold text-purple-400">6 Multi-Hop</span>
                </div>
                <h4 className="mt-1.5 text-xs font-bold text-gray-200">Role Chaining Attack</h4>
                <p className="mt-0.5 text-[10px] text-gray-400">sts:AssumeRole pivots across 4 IAM roles</p>
              </div>

              <div
                onClick={() => onLoadDataset('POLICY_VERSION')}
                className="cursor-pointer rounded border border-gray-800 bg-[#0B0E14] p-2.5 transition hover:border-red-500"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="rounded bg-red-950/50 border border-red-800/60 px-1.5 py-0.2 text-[9px] font-bold text-red-400">
                    T1098
                  </span>
                  <span className="text-[11px] font-bold text-red-400">2 Actions</span>
                </div>
                <h4 className="mt-1.5 text-xs font-bold text-gray-200">Policy Version Escalation</h4>
                <p className="mt-0.5 text-[10px] text-gray-400">CreatePolicyVersion wildcard privilege bump</p>
              </div>

              <div
                onClick={() => onLoadDataset('S3_EXFIL')}
                className="cursor-pointer rounded border border-gray-800 bg-[#0B0E14] p-2.5 transition hover:border-orange-500"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="rounded bg-orange-950/50 border border-orange-800/60 px-1.5 py-0.2 text-[9px] font-bold text-orange-400">
                    T1530
                  </span>
                  <span className="text-[11px] font-bold text-orange-400">21 Events</span>
                </div>
                <h4 className="mt-1.5 text-xs font-bold text-gray-200">S3 Exfiltration Burst</h4>
                <p className="mt-0.5 text-[10px] text-gray-400">Bulk GetObject + PutBucketPolicy tampering</p>
              </div>
            </div>
          </div>

          {/* Drag & Drop File Uploader */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="rounded border border-dashed border-gray-800 bg-[#161B22]/50 p-4 text-center transition hover:border-blue-500/50"
          >
            <Upload className="mx-auto h-6 w-6 text-blue-400" />
            <h3 className="mt-1.5 text-xs font-bold uppercase tracking-wider text-gray-200">Upload Custom AWS CloudTrail Logs</h3>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Drag & drop a <code className="text-blue-400 font-mono">.json</code> export from AWS CloudTrail S3 or choose a local file.
            </p>
            <div className="mt-2.5 flex justify-center font-mono">
              <label className="cursor-pointer rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition">
                Browse Log Files
                <input
                  type="file"
                  accept=".json,.log,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
            </div>
            {uploadStatus && (
              <div className="mt-2.5 inline-block rounded bg-blue-950/40 px-2.5 py-0.5 text-xs font-mono font-semibold text-blue-400 border border-blue-800/50">
                {uploadStatus}
              </div>
            )}
          </div>
        </>
      )}

      {/* Raw CloudTrail Event Explorer Table */}
      <div className="rounded bg-[#161B22] border border-gray-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
              Raw CloudTrail Event Explorer ({filteredEvents.length} records)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-500" />
              <input
                type="text"
                placeholder="Search raw logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 rounded border border-gray-800 bg-[#0B0E14] py-1 pl-7 pr-2 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="rounded border border-gray-800 bg-[#0B0E14] px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Services</option>
              <option value="iam">IAM (iam.amazonaws.com)</option>
              <option value="sts">STS (sts.amazonaws.com)</option>
              <option value="s3">S3 (s3.amazonaws.com)</option>
              <option value="ec2">EC2 (ec2.amazonaws.com)</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-gray-300 font-mono">
            <thead className="border-b border-gray-800 bg-[#0B0E14] text-[10px] uppercase text-gray-400">
              <tr>
                <th className="px-2.5 py-1.5">Timestamp</th>
                <th className="px-2.5 py-1.5">Event Name</th>
                <th className="px-2.5 py-1.5">Service</th>
                <th className="px-2.5 py-1.5">User Identity ARN</th>
                <th className="px-2.5 py-1.5">Source IP</th>
                <th className="px-2.5 py-1.5">Status</th>
                <th className="px-2.5 py-1.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80">
              {filteredEvents.slice(0, 100).map((e, idx) => (
                <tr
                  key={`${e.eventID}-${idx}`}
                  className={`transition hover:bg-gray-800/40 ${
                    e.isSimulatedAttack ? 'bg-red-950/20 text-red-300' : ''
                  }`}
                >
                  <td className="px-2.5 py-1.5 text-[11px] text-gray-400">
                    {e.eventTime ? new Date(e.eventTime).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td className="px-2.5 py-1.5 font-bold text-gray-200">
                    {e.eventName}
                    {e.isSimulatedAttack && (
                      <span className="ml-1.5 rounded bg-red-950 px-1 py-0.2 text-[9px] text-red-400 border border-red-800/60">
                        ATTACK
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-blue-400">
                    {e.eventSource?.split('.')?.[0] || e.eventSource}
                  </td>
                  <td className="px-2.5 py-1.5 text-[11px] text-gray-300 truncate max-w-[200px]" title={e.userIdentity?.arn || e.userIdentity?.userName}>
                    {e.userIdentity?.arn?.split('/')?.pop() || e.userIdentity?.userName || e.userIdentity?.principalId}
                  </td>
                  <td className="px-2.5 py-1.5 text-gray-400">{e.sourceIPAddress}</td>
                  <td className="px-2.5 py-1.5">
                    {e.errorCode ? (
                      <span className="rounded bg-red-950/40 px-1.5 py-0.2 text-[10px] text-red-400 font-bold border border-red-800/50">
                        {e.errorCode}
                      </span>
                    ) : (
                      <span className="rounded bg-green-950/40 px-1.5 py-0.2 text-[10px] text-green-400 font-bold border border-green-800/50">
                        Success
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-right">
                    <button
                      onClick={() => onInspectRawEvent(e)}
                      className="rounded bg-[#161B22] border border-gray-800 px-2 py-0.5 text-[10px] text-gray-300 hover:border-blue-500 hover:text-white"
                    >
                      JSON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
