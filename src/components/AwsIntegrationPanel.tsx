import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Globe, 
  Database, 
  ArrowDownToLine, 
  Radio, 
  Play, 
  Pause, 
  Settings2, 
  ShieldCheck, 
  Filter, 
  Server,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CloudTrailEvent } from '../types';

interface AwsIntegrationPanelProps {
  onIngestAwsEvents: (events: CloudTrailEvent[], sourceLabel: string) => void;
  onLiveStreamToggle?: (active: boolean) => void;
  isLiveStreamActive?: boolean;
}

export interface AwsConnectionState {
  connected: boolean;
  accountId?: string;
  callerArn?: string;
  userId?: string;
  region: string;
  discoveredTrails?: { name: string; s3BucketName?: string; isMultiRegionTrail?: boolean; homeRegion?: string }[];
  lastSyncTime?: string;
}

export const AwsIntegrationPanel: React.FC<AwsIntegrationPanelProps> = ({
  onIngestAwsEvents,
  onLiveStreamToggle,
  isLiveStreamActive = false,
}) => {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Prefix, setS3Prefix] = useState('AWSLogs/');

  // Query options
  const [timeRangeMinutes, setTimeRangeMinutes] = useState<number>(60);
  const [maxResults, setMaxResults] = useState<number>(50);
  const [serviceFilter, setServiceFilter] = useState('iam.amazonaws.com');
  const [onlyWriteOperations, setOnlyWriteOperations] = useState(true);

  // States
  const [isTesting, setIsTesting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingS3, setIsFetchingS3] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [connectionState, setConnectionState] = useState<AwsConnectionState>({
    connected: false,
    region: 'us-east-1',
  });

  const [isExpanded, setIsExpanded] = useState(true);
  const [autoPollInterval, setAutoPollInterval] = useState<number>(30); // seconds
  const [isAutoPolling, setIsAutoPolling] = useState(false);

  // Check initial server environment config
  useEffect(() => {
    fetch('/api/aws/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.connected) {
          setConnectionState({
            connected: true,
            region: data.configuredRegion || 'us-east-1',
          });
          if (data.configuredS3Bucket) setS3Bucket(data.configuredS3Bucket);
          if (data.configuredRegion) setRegion(data.configuredRegion);
        }
      })
      .catch(() => {});
  }, []);

  // Automated background polling effect
  useEffect(() => {
    if (!isAutoPolling || !connectionState.connected) return;

    const timer = setInterval(() => {
      handleFetchLiveCloudTrail(true);
    }, autoPollInterval * 1000);

    return () => clearInterval(timer);
  }, [isAutoPolling, autoPollInterval, connectionState.connected, region, serviceFilter, onlyWriteOperations]);

  // Test STS Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/aws/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKeyId: accessKeyId.trim() || undefined,
          secretAccessKey: secretAccessKey.trim() || undefined,
          sessionToken: sessionToken.trim() || undefined,
          region,
        }),
      });

      const data = await res.json();
      if (data.connected) {
        setConnectionState({
          connected: true,
          accountId: data.accountId,
          callerArn: data.callerArn,
          userId: data.userId,
          region: data.region,
          discoveredTrails: data.discoveredTrails,
          lastSyncTime: new Date().toLocaleTimeString(),
        });
        setStatusMessage({
          type: 'success',
          text: `Connected to AWS Account ${data.accountId} (${data.callerArn}) in ${data.region}`,
        });
      } else {
        setConnectionState({ connected: false, region });
        setStatusMessage({
          type: 'error',
          text: data.error || 'Unable to authenticate with AWS. Check credentials and IAM permissions.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Connection error: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Pull Live CloudTrail Events via LookupEvents API
  const handleFetchLiveCloudTrail = async (isBackgroundPoll = false) => {
    if (!isBackgroundPoll) setIsFetching(true);
    try {
      const lookupAttributeKey = serviceFilter !== 'ALL' ? 'EventSource' : undefined;
      const lookupAttributeValue = serviceFilter !== 'ALL' ? serviceFilter : undefined;

      const res = await fetch('/api/aws/cloudtrail/fetch-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKeyId: accessKeyId.trim() || undefined,
          secretAccessKey: secretAccessKey.trim() || undefined,
          sessionToken: sessionToken.trim() || undefined,
          region,
          timeRangeMinutes,
          maxResults,
          lookupAttributeKey,
          lookupAttributeValue,
          readOnlyFilter: onlyWriteOperations ? 'false' : undefined,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        if (data.events.length > 0) {
          onIngestAwsEvents(data.events, `AWS CloudTrail Live (${region})`);
          setConnectionState((prev) => ({
            ...prev,
            lastSyncTime: new Date().toLocaleTimeString(),
          }));
          if (!isBackgroundPoll) {
            setStatusMessage({
              type: 'success',
              text: `Successfully ingested ${data.events.length} live CloudTrail events from ${region}!`,
            });
          }
        } else {
          if (!isBackgroundPoll) {
            setStatusMessage({
              type: 'info',
              text: `Query succeeded, but 0 events matched the criteria in the last ${timeRangeMinutes} minutes.`,
            });
          }
        }
      } else {
        if (!isBackgroundPoll) {
          setStatusMessage({
            type: 'error',
            text: data.error || 'Failed to fetch live CloudTrail events.',
          });
        }
      }
    } catch (err: any) {
      if (!isBackgroundPoll) {
        setStatusMessage({
          type: 'error',
          text: `CloudTrail fetch error: ${err.message}`,
        });
      }
    } finally {
      if (!isBackgroundPoll) setIsFetching(false);
    }
  };

  // Fetch S3 CloudTrail Archive Logs
  const handleFetchS3Logs = async () => {
    if (!s3Bucket.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter an AWS S3 Bucket Name holding your CloudTrail .json.gz delivery logs.',
      });
      return;
    }

    setIsFetchingS3(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/aws/s3/fetch-trail-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKeyId: accessKeyId.trim() || undefined,
          secretAccessKey: secretAccessKey.trim() || undefined,
          sessionToken: sessionToken.trim() || undefined,
          region,
          bucketName: s3Bucket.trim(),
          prefix: s3Prefix.trim(),
          maxFiles: 5,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        onIngestAwsEvents(data.events, `AWS S3 Bucket (${s3Bucket})`);
        setStatusMessage({
          type: 'success',
          text: `Extracted & decompressed ${data.recordsExtracted} events from ${data.filesProcessed} S3 archive files!`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to retrieve CloudTrail logs from S3.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `S3 fetch error: ${err.message}`,
      });
    } finally {
      setIsFetchingS3(false);
    }
  };

  // Quick Mock / Sandbox Connector for Instant Evaluation
  const handleConnectSandboxAws = () => {
    setConnectionState({
      connected: true,
      accountId: '123456789012',
      callerArn: 'arn:aws:iam::123456789012:role/CloudGuard-ITDR-IngestionAgent',
      userId: 'AROAEXAMPLEITDRAGENT:session',
      region: 'us-east-1',
      discoveredTrails: [
        { name: 'management-events-trail-global', s3BucketName: 'aws-cloudtrail-logs-123456789012', isMultiRegionTrail: true, homeRegion: 'us-east-1' },
        { name: 'iam-security-trail-regional', s3BucketName: 'itdr-secops-cloudtrail-archive', isMultiRegionTrail: false, homeRegion: 'us-east-1' }
      ],
      lastSyncTime: new Date().toLocaleTimeString(),
    });
    setStatusMessage({
      type: 'success',
      text: 'Connected to AWS CloudTrail Sandbox Infrastructure (ARN: arn:aws:iam::123456789012:role/CloudGuard-ITDR-IngestionAgent).',
    });
  };

  return (
    <div className="rounded bg-[#161B22] border border-gray-800 p-4 font-sans shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-950/60 border border-blue-800/50 text-blue-400">
            <Cloud className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-100">
                AWS Infrastructure Direct Integration & CloudTrail Bridge
              </h3>
              {connectionState.connected ? (
                <span className="inline-flex items-center gap-1 rounded bg-green-950/60 border border-green-800/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  CONNECTED (AWS IAM / CLOUDTRAIL)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-gray-800 px-2 py-0.5 font-mono text-[10px] text-gray-400">
                  DISCONNECTED
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Direct connection to AWS CloudTrail Event History APIs and S3 delivery trails for real-time threat detection and model training.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!connectionState.connected && (
            <button
              onClick={handleConnectSandboxAws}
              className="rounded border border-blue-800/50 bg-blue-950/30 px-2.5 py-1 font-mono text-xs text-blue-400 transition hover:bg-blue-900/40"
            >
              Demo AWS Connection
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 rounded border border-gray-800 bg-[#0B0E14] px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span className="font-mono text-[11px]">{isExpanded ? 'Collapse' : 'Configure'}</span>
          </button>
        </div>
      </div>

      {/* Connected State Info Ribbon */}
      {connectionState.connected && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[10px] uppercase text-gray-500">AWS Account ID</span>
            <div className="font-semibold text-gray-200">{connectionState.accountId || '123456789012'}</div>
          </div>
          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[10px] uppercase text-gray-500">Caller Identity ARN</span>
            <div className="truncate text-blue-400 text-[11px]" title={connectionState.callerArn}>
              {connectionState.callerArn || 'arn:aws:iam::account:role/ITDR'}
            </div>
          </div>
          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[10px] uppercase text-gray-500">Active Region</span>
            <div className="font-semibold text-green-400">{connectionState.region}</div>
          </div>
          <div className="rounded border border-gray-800 bg-[#0B0E14] p-2.5">
            <span className="text-[10px] uppercase text-gray-500">Discovered Trails</span>
            <div className="font-semibold text-purple-400">
              {connectionState.discoveredTrails?.length ? `${connectionState.discoveredTrails.length} Trails Active` : 'CloudTrail Global'}
            </div>
          </div>
        </div>
      )}

      {/* Configuration & Action Workspace */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Credentials and Target Region Configuration */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
            <div>
              <label className="text-[10px] uppercase text-gray-400">AWS Access Key ID</label>
              <input
                type="password"
                placeholder="AKIAIOSFODNN7EXAMPLE or .env"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-gray-400">AWS Secret Access Key</label>
              <input
                type="password"
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCY..."
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                className="mt-1 w-full rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-gray-400">AWS Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full rounded border border-gray-800 bg-[#0B0E14] px-2.5 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="us-east-1">us-east-1 (N. Virginia)</option>
                <option value="us-west-2">us-west-2 (Oregon)</option>
                <option value="eu-west-1">eu-west-1 (Ireland)</option>
                <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                <option value="ap-south-1">ap-south-1 (Mumbai)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full flex items-center justify-center gap-1.5 rounded border border-blue-700 bg-blue-600 px-3 py-1.5 font-mono text-xs font-bold text-white uppercase tracking-wider transition hover:bg-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing STS...' : 'Verify AWS STS'}</span>
              </button>
            </div>
          </div>

          {/* Action Hub: Direct CloudTrail Query & S3 Archive Fetch */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* Direct CloudTrail Live Lookup Section */}
            <div className="rounded border border-gray-800 bg-[#0B0E14] p-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-1.5 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-200">
                  <Radio className="h-3.5 w-3.5 text-blue-400" />
                  <span>CloudTrail Event History Query</span>
                </div>
                <span className="font-mono text-[10px] text-gray-500">LookupEventsCommand</span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-2.5">
                <div>
                  <label className="text-[10px] text-gray-400">Target Service Filter</label>
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className="mt-0.5 w-full rounded border border-gray-800 bg-[#161B22] px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="iam.amazonaws.com">IAM (iam.amazonaws.com)</option>
                    <option value="sts.amazonaws.com">STS (sts.amazonaws.com)</option>
                    <option value="s3.amazonaws.com">S3 (s3.amazonaws.com)</option>
                    <option value="ec2.amazonaws.com">EC2 (ec2.amazonaws.com)</option>
                    <option value="ALL">All EventSources</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400">Time Window</label>
                  <select
                    value={timeRangeMinutes}
                    onChange={(e) => setTimeRangeMinutes(Number(e.target.value))}
                    className="mt-0.5 w-full rounded border border-gray-800 bg-[#161B22] px-2 py-1 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
                  >
                    <option value={15}>Past 15 Minutes</option>
                    <option value={60}>Past 1 Hour</option>
                    <option value={360}>Past 6 Hours</option>
                    <option value={1440}>Past 24 Hours</option>
                    <option value={10080}>Past 7 Days</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800/80 pt-2 font-mono text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 text-[11px]">
                  <input
                    type="checkbox"
                    checked={onlyWriteOperations}
                    onChange={(e) => setOnlyWriteOperations(e.target.checked)}
                    className="rounded border-gray-700 bg-gray-900 text-blue-500"
                  />
                  <span>Mutating APIs only (ReadOnly=false)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAutoPolling(!isAutoPolling)}
                    className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition ${
                      isAutoPolling 
                        ? 'border-green-800 bg-green-950/40 text-green-400' 
                        : 'border-gray-800 bg-[#161B22] text-gray-400 hover:text-gray-200'
                    }`}
                    title="Automatically poll CloudTrail every 30 seconds"
                  >
                    <Radio className={`h-3 w-3 ${isAutoPolling ? 'animate-pulse text-green-400' : ''}`} />
                    <span>{isAutoPolling ? 'Auto-Sync: ON' : 'Auto-Sync: OFF'}</span>
                  </button>

                  <button
                    onClick={() => handleFetchLiveCloudTrail(false)}
                    disabled={isFetching}
                    className="flex items-center gap-1.5 rounded border border-blue-800 bg-blue-950/50 px-2.5 py-1 text-xs font-bold text-blue-400 hover:bg-blue-900/60 transition disabled:opacity-50"
                  >
                    <ArrowDownToLine className={`h-3 w-3 ${isFetching ? 'animate-bounce' : ''}`} />
                    <span>{isFetching ? 'Pulling Logs...' : 'Pull Live CloudTrail'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* S3 CloudTrail Delivery Bucket Ingestion Section */}
            <div className="rounded border border-gray-800 bg-[#0B0E14] p-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-1.5 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-200">
                  <Database className="h-3.5 w-3.5 text-purple-400" />
                  <span>S3 CloudTrail Archive Bucket Delivery</span>
                </div>
                <span className="font-mono text-[10px] text-gray-500">.json.gz Decompressor</span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-2.5">
                <div>
                  <label className="text-[10px] text-gray-400">S3 Bucket Name</label>
                  <input
                    type="text"
                    placeholder="my-aws-cloudtrail-bucket"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    className="mt-0.5 w-full rounded border border-gray-800 bg-[#161B22] px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-400">Log Prefix Path</label>
                  <input
                    type="text"
                    placeholder="AWSLogs/123456789012/CloudTrail/"
                    value={s3Prefix}
                    onChange={(e) => setS3Prefix(e.target.value)}
                    className="mt-0.5 w-full rounded border border-gray-800 bg-[#161B22] px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-800/80 pt-2 font-mono text-xs">
                <span className="text-[10px] text-gray-500">Extracts .json.gz raw chunks directly</span>
                <button
                  onClick={handleFetchS3Logs}
                  disabled={isFetchingS3}
                  className="flex items-center gap-1.5 rounded border border-purple-800 bg-purple-950/50 px-2.5 py-1 text-xs font-bold text-purple-400 hover:bg-purple-900/60 transition disabled:opacity-50"
                >
                  <Layers className={`h-3 w-3 ${isFetchingS3 ? 'animate-spin' : ''}`} />
                  <span>{isFetchingS3 ? 'Decompressing S3 Logs...' : 'Ingest S3 Bucket Archive'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`rounded border p-2.5 font-mono text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'border-green-800/80 bg-green-950/30 text-green-300'
                  : statusMessage.type === 'error'
                  ? 'border-red-800/80 bg-red-950/30 text-red-300'
                  : 'border-blue-800/80 bg-blue-950/30 text-blue-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              ) : (
                <Radio className="h-4 w-4 shrink-0 text-blue-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
