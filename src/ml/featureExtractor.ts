import { CloudTrailEvent, FeatureVector } from '../types';

// High risk AWS IAM & STS API actions commonly leveraged in cloud privilege escalation and abuse
export const HIGH_RISK_ACTIONS = new Set([
  'AssumeRole',
  'AssumeRoleWithSAML',
  'AssumeRoleWithWebIdentity',
  'CreatePolicyVersion',
  'SetDefaultPolicyVersion',
  'AttachUserPolicy',
  'AttachRolePolicy',
  'AttachGroupPolicy',
  'PutUserPolicy',
  'PutRolePolicy',
  'PutGroupPolicy',
  'CreateAccessKey',
  'UpdateAssumeRolePolicy',
  'PassRole',
  'CreateLoginProfile',
  'UpdateLoginProfile',
  'AddUserToGroup',
  'PutBucketPolicy',
  'PutBucketAcl',
  'PutObjectAcl',
  'GetFederationToken',
  'GetSessionToken',
  'DeactivateMFADevice',
  'DeleteVirtualMFADevice',
]);

// Typical benign baseline API calls
export const BENIGN_ROUTINE_ACTIONS = new Set([
  'DescribeInstances',
  'DescribeSecurityGroups',
  'DescribeVolumes',
  'ListBuckets',
  'GetObject',
  'HeadObject',
  'GetCallerIdentity',
  'GetUser',
  'ListRoles',
  'ListPolicies',
  'GetAccountSummary',
  'ListAttachedUserPolicies',
  'DescribeKeyPairs',
  'DescribeSubnets',
  'DescribeVpcs',
  'LookupEvents',
]);

// Known scripting / red-team user agents
const SUSPICIOUS_USER_AGENTS = ['pacu', 'boto3', 'aws-sdk-go', 'python-requests', 'curl', 'postman', 'scoutsuite', 'prowler'];

export class FeatureExtractor {
  // In-memory historical state for entity baseline profiling & sliding window
  private entityHistories: Map<string, CloudTrailEvent[]> = new Map();
  private entityRoleChains: Map<string, number> = new Map();
  private knownEntityIps: Map<string, Set<string>> = new Map();
  private knownEntityUserAgents: Map<string, Set<string>> = new Map();
  private knownEntityApis: Map<string, Set<string>> = new Map();

  // Reset or initialize state
  public reset() {
    this.entityHistories.clear();
    this.entityRoleChains.clear();
    this.knownEntityIps.clear();
    this.knownEntityUserAgents.clear();
    this.knownEntityApis.clear();
  }

  // Pre-seed baseline entity knowledge
  public seedBaseline(baselineEvents: CloudTrailEvent[]) {
    for (const event of baselineEvents) {
      if (!event) continue;
      const entity = event.userIdentity?.arn || event.userIdentity?.principalId || 'UnknownEntity';
      if (!this.knownEntityIps.has(entity)) this.knownEntityIps.set(entity, new Set());
      if (!this.knownEntityUserAgents.has(entity)) this.knownEntityUserAgents.set(entity, new Set());
      if (!this.knownEntityApis.has(entity)) this.knownEntityApis.set(entity, new Set());

      if (event.sourceIPAddress) this.knownEntityIps.get(entity)!.add(event.sourceIPAddress);
      if (event.userAgent) this.knownEntityUserAgents.get(entity)!.add(event.userAgent.toLowerCase());
      if (event.eventName) this.knownEntityApis.get(entity)!.add(event.eventName);
    }
  }

  /**
   * Extracts the 10-dimensional feature vector for a CloudTrail event relative to the entity's 15-minute sliding window
   */
  public extractFeatures(currentEvent: CloudTrailEvent, windowEvents?: CloudTrailEvent[]): FeatureVector {
    const entity = currentEvent?.userIdentity?.arn || currentEvent?.userIdentity?.principalId || 'UnknownEntity';
    const now = currentEvent?.eventTime ? new Date(currentEvent.eventTime).getTime() : Date.now();
    const fifteenMinutesAgo = now - 15 * 60 * 1000;

    // Maintain entity sliding window
    let history = this.entityHistories.get(entity) || [];
    history = history.filter(e => e?.eventTime && new Date(e.eventTime).getTime() >= fifteenMinutesAgo);
    if (currentEvent) history.push(currentEvent);
    this.entityHistories.set(entity, history);

    const eventsToAnalyze = windowEvents && windowEvents.length > 0 ? windowEvents : history;

    // 1. API Call Count (Frequency)
    const apiCallCount = eventsToAnalyze.length;

    // 2. AssumeRole Depth (Role Chaining)
    let currentDepth = this.entityRoleChains.get(entity) || 0;
    if (currentEvent?.eventName === 'AssumeRole') {
      currentDepth += 1;
      this.entityRoleChains.set(entity, currentDepth);
    } else if (currentEvent?.userIdentity?.type === 'IAMUser') {
      currentDepth = 0;
      this.entityRoleChains.set(entity, 0);
    }
    const assumeRoleDepth = currentDepth;

    // 3. High Risk Action Count
    let highRiskCount = 0;
    for (const e of eventsToAnalyze) {
      if (HIGH_RISK_ACTIONS.has(e.eventName)) {
        highRiskCount++;
      }
    }

    // 4. AccessDenied Count
    let accessDeniedCount = 0;
    const errorCodes = new Set<string>();
    for (const e of eventsToAnalyze) {
      if (e.errorCode === 'AccessDenied' || e.errorCode === 'UnauthorizedOperation') {
        accessDeniedCount++;
      }
      if (e.errorCode) {
        errorCodes.add(e.errorCode);
      }
    }

    // 5. Source IP Entropy (Shannon entropy)
    const ipCounts: Record<string, number> = {};
    for (const e of eventsToAnalyze) {
      ipCounts[e.sourceIPAddress] = (ipCounts[e.sourceIPAddress] || 0) + 1;
    }
    let ipEntropy = 0;
    const totalEvents = eventsToAnalyze.length;
    for (const ip in ipCounts) {
      const p = ipCounts[ip] / totalEvents;
      if (p > 0) {
        ipEntropy -= p * Math.log2(p);
      }
    }

    // 6. Rare API Action Score (Rarity relative to baseline & general benign profile)
    let rareApiScore = 0;
    const knownApis = this.knownEntityApis.get(entity);
    if (HIGH_RISK_ACTIONS.has(currentEvent.eventName)) {
      rareApiScore = 0.85;
    } else if (!BENIGN_ROUTINE_ACTIONS.has(currentEvent.eventName)) {
      rareApiScore = 0.55;
    } else if (knownApis && !knownApis.has(currentEvent.eventName)) {
      rareApiScore = 0.40;
    } else {
      rareApiScore = 0.05;
    }

    // 7. Off-hours Score (UTC hour outside typical 08:00 - 18:00 or weekend)
    const eventDate = new Date(currentEvent.eventTime);
    const hour = eventDate.getUTCHours();
    const day = eventDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
    let offHoursScore = 0.1;
    if (day === 0 || day === 6) {
      offHoursScore += 0.4;
    }
    if (hour < 6 || hour > 20) {
      offHoursScore += 0.4;
    }
    offHoursScore = Math.min(1.0, offHoursScore);

    // 8. Novel User Agent Score
    const ua = currentEvent.userAgent.toLowerCase();
    let novelUaScore = 0.1;
    for (const sus of SUSPICIOUS_USER_AGENTS) {
      if (ua.includes(sus)) {
        novelUaScore = 0.9;
        break;
      }
    }
    const knownUas = this.knownEntityUserAgents.get(entity);
    if (knownUas && !knownUas.has(ua) && novelUaScore < 0.5) {
      novelUaScore = 0.6;
    }

    // 9. Cross-Account Action (1 if target != source or assumed cross-account)
    let crossAccount = 0;
    if (currentEvent?.recipientAccountId && currentEvent?.userIdentity?.accountId) {
      if (currentEvent.recipientAccountId !== currentEvent.userIdentity.accountId) {
        crossAccount = 1;
      }
    }
    if (currentEvent?.requestParameters?.roleArn) {
      const targetRoleArn: string = currentEvent.requestParameters.roleArn;
      const match = targetRoleArn.match(/arn:aws:iam::(\d+):/);
      if (match && match[1] && currentEvent?.userIdentity?.accountId && match[1] !== currentEvent.userIdentity.accountId) {
        crossAccount = 1;
      }
    }

    // 10. Error Code Diversity
    const errorCodeDiversity = errorCodes.size;

    return {
      entityArn: entity,
      windowStart: new Date(fifteenMinutesAgo).toISOString(),
      windowEnd: currentEvent.eventTime,
      apiCallCount,
      assumeRoleDepth,
      highRiskActionCount: highRiskCount,
      accessDeniedCount,
      ipEntropy: Number(ipEntropy.toFixed(3)),
      rareApiScore: Number(rareApiScore.toFixed(3)),
      offHoursScore: Number(offHoursScore.toFixed(3)),
      novelUserAgentScore: Number(novelUaScore.toFixed(3)),
      crossAccountAction: crossAccount,
      errorCodeDiversity,
    };
  }

  /**
   * Converts a FeatureVector to a normalized 10-length numerical array [0, 1] for ML models
   */
  public static vectorToArray(fv: FeatureVector): number[] {
    return [
      Math.min(1.0, fv.apiCallCount / 50),                 // 0: apiCallCount norm
      Math.min(1.0, fv.assumeRoleDepth / 5),                // 1: assumeRoleDepth norm (0 to 5 hops)
      Math.min(1.0, fv.highRiskActionCount / 10),           // 2: highRiskActionCount norm
      Math.min(1.0, fv.accessDeniedCount / 15),             // 3: accessDeniedCount norm
      Math.min(1.0, fv.ipEntropy / 3.0),                    // 4: ipEntropy norm
      Math.min(1.0, fv.rareApiScore),                       // 5: rareApiScore [0, 1]
      Math.min(1.0, fv.offHoursScore),                      // 6: offHoursScore [0, 1]
      Math.min(1.0, fv.novelUserAgentScore),                // 7: novelUserAgentScore [0, 1]
      fv.crossAccountAction === 1 ? 1.0 : 0.0,              // 8: crossAccountAction
      Math.min(1.0, fv.errorCodeDiversity / 5),             // 9: errorCodeDiversity norm
    ];
  }

  public static FEATURE_NAMES = [
    { key: 'apiCallCount', label: 'API Call Frequency', desc: 'Volume of AWS API requests in 15m window' },
    { key: 'assumeRoleDepth', label: 'AssumeRole Chaining Depth', desc: 'Number of consecutive STS AssumeRole hops' },
    { key: 'highRiskActionCount', label: 'High-Risk IAM Actions', desc: 'Sensitive privilege escalation API calls' },
    { key: 'accessDeniedCount', label: 'AccessDenied Spikes', desc: 'Authorization failures indicating probing' },
    { key: 'ipEntropy', label: 'Source IP Entropy', desc: 'Shannon dispersion across client IP addresses' },
    { key: 'rareApiScore', label: 'API Call Rarity', desc: 'Deviation from entity baseline API usage' },
    { key: 'offHoursScore', label: 'Temporal Anomaly', desc: 'Activity during unusual off-business hours' },
    { key: 'novelUserAgentScore', label: 'Suspicious User-Agent', desc: 'Scripted / automated red-team SDK usage' },
    { key: 'crossAccountAction', label: 'Cross-Account Pivot', desc: 'Accessing resources across AWS accounts' },
    { key: 'errorCodeDiversity', label: 'Error Code Diversity', desc: 'Distinct API error types encountered' },
  ];
}
