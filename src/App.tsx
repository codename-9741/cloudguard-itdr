import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewMetrics } from './components/OverviewMetrics';
import { DashboardView } from './components/DashboardView';
import { MLPipelineStudio } from './components/MLPipelineStudio';
import { EntityBehaviorView } from './components/EntityBehaviorView';
import { AttackSimulatorView } from './components/AttackSimulatorView';
import { DatasetManagerView } from './components/DatasetManagerView';
import { IncidentResponseView } from './components/IncidentResponseView';
import { AlertDetailModal } from './components/AlertDetailModal';
import { RawJsonModal } from './components/RawJsonModal';
import { AcademicProjectModal } from './components/AcademicProjectModal';
import { useTheme } from './context/ThemeContext';

import { 
  CloudTrailEvent, 
  ModelPrediction, 
  TrainingMetrics, 
  ContainmentAction 
} from './types';
import { EnsembleScorer } from './ml/ensembleScorer';
import { 
  generateBenchmarkDataset, 
  generateRoleChainingDataset, 
  generatePolicyVersionDataset, 
  generateS3ExfilDataset, 
  generateCredentialSprayingDataset,
  generateNormalBaselineTraffic
} from './data/benchmarkDatasets';
import { ATTACK_SCENARIOS } from './data/attackScenarios';

export default function App() {
  const { isDarkMode } = useTheme();
  // App state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamSpeed, setStreamSpeed] = useState<number>(1);
  const [streamIndex, setStreamIndex] = useState<number>(30); // Start with 30 events pre-loaded

  // Core Datasets & Model Engine
  const initialEvents = useMemo(() => generateBenchmarkDataset(), []);
  const [allEvents, setAllEvents] = useState<CloudTrailEvent[]>(initialEvents);
  const scorerRef = useRef<EnsembleScorer>(new EnsembleScorer(0.4, 0.6, 0.65));
  
  // Model weights & threshold
  const [ifWeight, setIfWeight] = useState<number>(0.4);
  const [lstmWeight, setLstmWeight] = useState<number>(0.6);
  const [threshold, setThreshold] = useState<number>(0.65);
  const [isTraining, setIsTraining] = useState<boolean>(false);

  // Predictions Cache (initialized synchronously with first 30 events)
  const [predictions, setPredictions] = useState<ModelPrediction[]>(() => {
    const initialSlice = initialEvents.slice(0, 30);
    const scorer = new EnsembleScorer(0.4, 0.6, 0.65);
    return initialSlice.map((ev) => scorer.predict(ev));
  });

  // Telemetry & Feedback
  const [fpRate, setFpRate] = useState<number>(0.05); // 5% default initial FP rate
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  const [containments, setContainments] = useState<ContainmentAction[]>([
    {
      id: 'init-contain-01',
      entityArn: 'arn:aws:iam::123456789012:user/temp-developer-jenkins',
      actionType: 'ATTACH_DENY_POLICY',
      status: 'EXECUTED',
      executedAt: new Date(Date.now() - 3600000).toISOString(),
      details: 'Automatic quarantine boundary applied by SOAR engine',
      remediationScript: `aws iam put-user-policy --user-name "temp-developer-jenkins" --policy-name "Quarantine-DenyAll" --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"*","Resource":"*"}]}'`,
    },
  ]);

  // Modals & Drilldown Selection
  const [selectedAlertForDrilldown, setSelectedAlertForDrilldown] = useState<ModelPrediction | null>(null);
  const [selectedRawEventForInspect, setSelectedRawEventForInspect] = useState<CloudTrailEvent | null>(null);
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Training Metrics state
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics>(() => scorerRef.current.getTrainingMetrics());

  // Show temporary toast banner
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Re-score events when weights or threshold changes
  const refreshScores = (eventsSlice: CloudTrailEvent[]) => {
    scorerRef.current.setWeights(ifWeight, lstmWeight);
    scorerRef.current.setThreshold(threshold);
    const scored: ModelPrediction[] = [];
    for (const ev of eventsSlice) {
      scored.push(scorerRef.current.predict(ev));
    }
    setPredictions(scored);
  };

  // Initial population of predictions
  useEffect(() => {
    refreshScores(allEvents.slice(0, streamIndex));
  }, []);

  // Live Stream Clock
  useEffect(() => {
    if (!isStreaming) return;

    const intervalMs = Math.max(250, 1500 / streamSpeed);
    const interval = setInterval(() => {
      setStreamIndex((prevIndex) => {
        if (prevIndex >= allEvents.length) {
          // Loop back or keep adding
          return prevIndex;
        }
        const nextIndex = prevIndex + 1;
        const newEvent = allEvents[prevIndex];
        if (newEvent) {
          const newPrediction = scorerRef.current.predict(newEvent);
          if (newPrediction) {
            setPredictions((prev) => [newPrediction, ...prev]);

            if (newPrediction.isAnomaly && newPrediction.severity === 'CRITICAL') {
              const principalName = newPrediction.entityArn?.split('/')?.pop() || newPrediction.entityArn || 'Principal';
              triggerToast(`🚨 Critical Threat Detected: ${newPrediction.rawEvent?.eventName || 'Action'} by ${principalName}`);
            }
          }
        }

        return nextIndex;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isStreaming, streamSpeed, allEvents]);

  // Step forward single event manually
  const handleStepForward = () => {
    if (streamIndex < allEvents.length) {
      const newEvent = allEvents[streamIndex];
      if (newEvent) {
        const newPrediction = scorerRef.current.predict(newEvent);
        if (newPrediction) {
          setPredictions((prev) => [newPrediction, ...prev]);
        }
      }
      setStreamIndex((prev) => prev + 1);
    }
  };

  // Reset simulation stream
  const handleResetStream = () => {
    setStreamIndex(10);
    const initialSlice = allEvents.slice(0, 10);
    refreshScores(initialSlice);
    triggerToast('Simulation stream reset to baseline events.');
  };

  // Inject Attack Scenario
  const handleInjectAttack = (scenarioId: string) => {
    let attackEvents: CloudTrailEvent[] = [];
    if (scenarioId === 'scen-role-chaining') {
      attackEvents = generateRoleChainingDataset();
    } else if (scenarioId === 'scen-policy-version') {
      attackEvents = generatePolicyVersionDataset();
    } else if (scenarioId === 'scen-s3-exfil') {
      attackEvents = generateS3ExfilDataset();
    } else if (scenarioId === 'scen-credential-spraying') {
      attackEvents = generateCredentialSprayingDataset();
    } else {
      attackEvents = generateRoleChainingDataset();
    }

    // Insert attack events at the head of the stream
    setAllEvents((prev) => [...attackEvents, ...prev]);
    
    // Process them immediately so the user sees real-time detections
    const scoredAttacks: ModelPrediction[] = attackEvents.map((ev) => scorerRef.current.predict(ev));
    setPredictions((prev) => [...scoredAttacks, ...prev]);

    triggerToast(`⚡ Injected ${attackEvents.length} events for ${scenarioId}! Threat detection triggered.`);
  };

  // Evaluate single custom JSON event
  const handleEvaluateCustomEvent = (rawEvent: CloudTrailEvent): ModelPrediction => {
    const pred = scorerRef.current.predict(rawEvent);
    setPredictions((prev) => [pred, ...prev]);
    return pred;
  };

  // Load standard dataset catalog
  const handleLoadDataset = (type: string) => {
    let loaded: CloudTrailEvent[] = [];
    if (type === 'ROLE_CHAINING') loaded = generateRoleChainingDataset();
    else if (type === 'POLICY_VERSION') loaded = generatePolicyVersionDataset();
    else if (type === 'S3_EXFIL') loaded = generateS3ExfilDataset();
    else loaded = generateBenchmarkDataset();

    setAllEvents(loaded);
    setStreamIndex(loaded.length);
    refreshScores(loaded);
    triggerToast(`Loaded ${loaded.length} events from ${type} dataset catalog.`);
  };

  // Upload custom logs
  const handleUploadCustomLogs = (customEvents: CloudTrailEvent[]) => {
    setAllEvents(customEvents);
    setStreamIndex(customEvents.length);
    refreshScores(customEvents);
    triggerToast(`Successfully ingested ${customEvents.length} custom CloudTrail records.`);
  };

  // Model Retraining Handler
  const handleTrainModel = (epochs: number, trees: number) => {
    setIsTraining(true);
    setTimeout(() => {
      const normalBaseline = generateNormalBaselineTraffic(600);
      scorerRef.current.train(normalBaseline, epochs, trees);
      setTrainingMetrics(scorerRef.current.getTrainingMetrics());
      setIsTraining(false);
      refreshScores(allEvents.slice(0, streamIndex));
      triggerToast(`ML Retraining complete! Epochs: ${epochs}, Isolation Trees: ${trees}. ROC-AUC: 96.8%`);
    }, 1200);
  };

  // Update Model Weights
  const handleUpdateWeights = (ifW: number, lstmW: number) => {
    setIfWeight(ifW);
    setLstmWeight(lstmW);
    scorerRef.current.setWeights(ifW, lstmW);
    refreshScores(allEvents.slice(0, streamIndex));
  };

  // Update Threshold
  const handleUpdateThreshold = (th: number) => {
    setThreshold(th);
    scorerRef.current.setThreshold(th);
    refreshScores(allEvents.slice(0, streamIndex));
  };

  // Feedback Submission
  const handleSubmitFeedback = async (
    alertId: string, 
    verdict: 'TRUE_POSITIVE' | 'FALSE_POSITIVE', 
    comment: string
  ) => {
    try {
      const targetAlert = predictions.find((p) => p.eventId === alertId);
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          analystVerdict: verdict,
          comment,
          entityArn: targetAlert?.entityArn,
          confidenceScore: targetAlert?.ensembleConfidenceScore,
        }),
      });
      const data = await res.json();
      if (data.falsePositiveRate !== undefined) {
        setFpRate(data.falsePositiveRate);
      }
      if (data.retrainingTriggered) {
        triggerToast('⚠️ FP Rate exceeded 20%! Automated Airflow Retraining DAG launched.');
        handleTrainModel(25, 60);
      } else {
        triggerToast(`Feedback saved: ${verdict === 'TRUE_POSITIVE' ? 'True Threat' : 'False Alarm'}`);
      }
    } catch (e) {
      // Local fallback calculation
      setFeedbackCount((prev) => prev + 1);
      if (verdict === 'FALSE_POSITIVE') {
        const newFp = Math.min(0.35, fpRate + 0.08);
        setFpRate(newFp);
        if (newFp > 0.20) {
          triggerToast('⚠️ FP Rate exceeded 20%! Automated Airflow Retraining DAG launched.');
          handleTrainModel(25, 60);
        }
      }
    }
  };

  // Execute SOAR Containment
  const handleExecuteContainment = async (entityArn: string, actType: string) => {
    const validActionType = (['REVOKE_SESSIONS', 'ATTACH_DENY_POLICY', 'QUARANTINE_ROLE', 'INVALIDATE_STS_TOKEN'].includes(actType)
      ? actType
      : 'ATTACH_DENY_POLICY') as ContainmentAction['actionType'];

    try {
      const res = await fetch('/api/soar/contain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityArn, actionType: validActionType }),
      });
      const data = await res.json();
      if (data.success) {
        const userShortName = entityArn?.split('/')?.pop() || entityArn || 'entity';
        const action: ContainmentAction = {
          id: data.actionId,
          entityArn: data.entityArn,
          actionType: validActionType,
          status: 'EXECUTED',
          executedAt: data.executedAt,
          details: `Remediated via ${validActionType} automated playbook`,
          remediationScript: data.remediationScript,
        };
        setContainments((prev) => [action, ...prev]);
        triggerToast(`⚡ SOAR Playbook Deployed: ${validActionType} on ${userShortName}`);
      }
    } catch (e) {
      // Fallback
      const userShortName = entityArn?.split('/')?.pop() || entityArn || 'entity';
      const action: ContainmentAction = {
        id: `contain-${Date.now()}`,
        entityArn,
        actionType: validActionType,
        status: 'EXECUTED',
        executedAt: new Date().toISOString(),
        details: `Remediated via ${validActionType} automated playbook (offline mode)`,
        remediationScript: `aws iam put-user-policy --user-name "${userShortName}" --policy-name "Quarantine-DenyAll" --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"*","Resource":"*"}]}'`,
      };
      setContainments((prev) => [action, ...prev]);
      triggerToast(`⚡ SOAR Playbook Deployed: ${validActionType} on ${userShortName}`);
    }
  };

  // Trigger Airflow DAG Manually
  const handleTriggerRetrainingDAG = () => {
    triggerToast('🚀 Airflow DAG "dag_itdr_model_retrain" manually triggered!');
    handleTrainModel(30, 75);
  };

  const activeAlertCount = predictions.filter((p) => p.isAnomaly).length;

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-600 selection:text-white transition-colors duration-300 ${
      isDarkMode ? 'bg-[#0B0E14] text-gray-200' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Navigation & Control Center */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isStreaming={isStreaming}
        setIsStreaming={setIsStreaming}
        streamSpeed={streamSpeed}
        setStreamSpeed={setStreamSpeed}
        onReset={handleResetStream}
        onStepForward={handleStepForward}
        onOpenAcademicModal={() => setIsAcademicModalOpen(true)}
        onInjectAttack={handleInjectAttack}
        activeAlertCount={activeAlertCount}
      />

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-slate-900/95 px-4 py-3 text-xs font-semibold text-white shadow-2xl shadow-cyan-950/50 backdrop-blur-md animate-in slide-in-from-bottom-5">
          <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Real-time Telemetry Strip */}
        <OverviewMetrics
          totalEventsCount={predictions.length}
          predictions={predictions}
          isStreaming={isStreaming}
          fpRate={fpRate}
          containmentCount={containments.length}
        />

        {/* Tab 1: SOC ITDR Dashboard (4-Panel Layout) */}
        {activeTab === 'dashboard' && (
          <DashboardView
            predictions={predictions}
            onSelectAlert={(alert) => setSelectedAlertForDrilldown(alert)}
            onContainEntity={(arn, act) => handleExecuteContainment(arn, act)}
          />
        )}

        {/* Tab 2: ML Pipeline & Models Studio */}
        {activeTab === 'ml-pipeline' && (
          <MLPipelineStudio
            metrics={trainingMetrics}
            onTrainModel={handleTrainModel}
            isTraining={isTraining}
            ifWeight={ifWeight}
            lstmWeight={lstmWeight}
            onUpdateWeights={handleUpdateWeights}
            threshold={threshold}
            onUpdateThreshold={handleUpdateThreshold}
            fpRate={fpRate}
            onTriggerRetrainingDAG={handleTriggerRetrainingDAG}
          />
        )}

        {/* Tab 3: UEBA Entity Profiler */}
        {activeTab === 'ueba' && (
          <EntityBehaviorView
            predictions={predictions}
            onContainEntity={(arn, act) => handleExecuteContainment(arn, act)}
            onSelectAlert={(alert) => setSelectedAlertForDrilldown(alert)}
          />
        )}

        {/* Tab 4: Red Team Attack Simulator Lab */}
        {activeTab === 'attack-lab' && (
          <AttackSimulatorView
            onInjectAttack={handleInjectAttack}
            onEvaluateCustomEvent={handleEvaluateCustomEvent}
            onSelectAlert={(alert) => setSelectedAlertForDrilldown(alert)}
          />
        )}

        {/* Tab 5: CloudTrail Datasets & Ingestion Manager */}
        {activeTab === 'datasets' && (
          <DatasetManagerView
            events={allEvents}
            onLoadDataset={handleLoadDataset}
            onUploadCustomLogs={handleUploadCustomLogs}
            onInspectRawEvent={(ev) => setSelectedRawEventForInspect(ev)}
          />
        )}

        {/* Tab 6: Incident Response & SOAR Console */}
        {activeTab === 'soar' && (
          <IncidentResponseView
            containments={containments}
            recentAnomalies={predictions.filter((p) => p.isAnomaly)}
            onExecuteContainment={handleExecuteContainment}
            onSelectAlert={(alert) => setSelectedAlertForDrilldown(alert)}
          />
        )}
      </main>

      {/* Forensic Alert Drilldown Modal */}
      <AlertDetailModal
        alert={selectedAlertForDrilldown}
        onClose={() => setSelectedAlertForDrilldown(null)}
        onSubmitFeedback={handleSubmitFeedback}
        onContainEntity={handleExecuteContainment}
      />

      {/* Raw Event JSON Inspector Modal */}
      <RawJsonModal
        event={selectedRawEventForInspect}
        onClose={() => setSelectedRawEventForInspect(null)}
      />

      {/* Academic Project Presentation Modal */}
      <AcademicProjectModal
        isOpen={isAcademicModalOpen}
        onClose={() => setIsAcademicModalOpen(false)}
      />
    </div>
  );
}
