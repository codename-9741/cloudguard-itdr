export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface CloudTrailEvent {
  eventID: string;
  eventTime: string;
  eventSource: string; // e.g. 'iam.amazonaws.com', 'sts.amazonaws.com', 's3.amazonaws.com'
  eventName: string; // e.g. 'AssumeRole', 'CreatePolicyVersion', 'AttachUserPolicy', 'GetObject'
  awsRegion: string;
  sourceIPAddress: string;
  userAgent: string;
  userIdentity: {
    type: 'IAMUser' | 'AssumedRole' | 'Root' | 'FederatedUser' | 'AWSService';
    principalId: string;
    arn: string;
    accountId: string;
    userName?: string;
    sessionContext?: {
      sessionIssuer?: {
        arn: string;
        userName: string;
      };
      attributes?: {
        creationDate: string;
        mfaAuthenticated: string;
      };
    };
  };
  requestParameters?: Record<string, any>;
  responseElements?: Record<string, any>;
  errorCode?: string; // e.g. 'AccessDenied', 'NoSuchEntityException'
  errorMessage?: string;
  recipientAccountId?: string;
  isSimulatedAttack?: boolean;
  attackLabel?: string;
}

export interface FeatureVector {
  entityArn: string;
  windowStart: string;
  windowEnd: string;
  // 10 AWS CloudTrail engineered features
  apiCallCount: number;          // Feature 1: Total API frequency in window
  assumeRoleDepth: number;       // Feature 2: AssumeRole hop chaining depth
  highRiskActionCount: number;   // Feature 3: Privilege/sensitive IAM actions
  accessDeniedCount: number;     // Feature 4: Failed authorization calls
  ipEntropy: number;             // Feature 5: Source IP Shannon entropy
  rareApiScore: number;          // Feature 6: Statistical rarity of API call
  offHoursScore: number;         // Feature 7: Time-of-day deviation
  novelUserAgentScore: number;   // Feature 8: Scripted / novel client score
  crossAccountAction: number;    // Feature 9: 1 if cross-account / 0 if internal
  errorCodeDiversity: number;    // Feature 10: Count of distinct error codes
}

export interface ModelPrediction {
  eventId: string;
  entityArn: string;
  timestamp: string;
  rawEvent: CloudTrailEvent;
  features: FeatureVector;
  isolationForestScore: number;  // 0.0 - 1.0 (Spatial anomaly score)
  lstmAutoencoderScore: number;  // 0.0 - 1.0 (Sequential reconstruction error)
  ensembleConfidenceScore: number; // 0.0 - 1.0 (0.4 * IF + 0.6 * LSTM)
  isAnomaly: boolean;
  severity: Severity;
  mitreTechniques: MitreTechnique[];
  xaiTopContributors: { feature: string; label: string; score: number; explanation: string }[];
  containmentStatus?: 'ACTIVE' | 'CONTAINED' | 'MONITORED';
}

export interface MitreTechnique {
  id: string; // e.g. 'T1548.005', 'T1078', 'T1098', 'T1530'
  name: string;
  tactic: string; // e.g. 'Privilege Escalation', 'Initial Access', 'Persistence', 'Exfiltration'
  description: string;
}

export interface AlertFeedback {
  id: string;
  alertId: string;
  timestamp: string;
  analystVerdict: 'TRUE_POSITIVE' | 'FALSE_POSITIVE';
  comment: string;
  analyst: string;
  entityArn: string;
  confidenceScore: number;
}

export interface TrainingMetrics {
  version: string;
  trainedAt: string;
  totalSamples: number;
  normalBaselineSamples: number;
  simulatedAttackSamples: number;
  isolationForestTrees: number;
  lstmEpochs: number;
  lossHistory: { epoch: number; trainLoss: number; valLoss: number }[];
  rocAuc: number;
  precision: number;
  recall: number;
  f1Score: number;
  threshold: number;
  featureImportances: { feature: string; label: string; importance: number }[];
  falsePositiveRate: number;
  retrainingRecommended: boolean;
}

export interface ContainmentAction {
  id: string;
  entityArn: string;
  actionType: 'REVOKE_SESSIONS' | 'ATTACH_DENY_POLICY' | 'QUARANTINE_ROLE' | 'INVALIDATE_STS_TOKEN';
  status: 'EXECUTED' | 'PENDING' | 'FAILED';
  executedAt: string;
  details: string;
  remediationScript: string;
}

export interface AttackScenario {
  id: string;
  title: string;
  mitreId: string;
  category: 'ROLE_CHAINING' | 'PRIVILEGE_ESCALATION' | 'LATERAL_MOVEMENT' | 'CREDENTIAL_ACCESS' | 'EXFILTRATION';
  description: string;
  expectedAnomalyScore: number;
  eventsCount: number;
  steps: {
    step: number;
    eventName: string;
    entity: string;
    description: string;
    payloadSnippet: string;
  }[];
}
