import { AttackScenario, CloudTrailEvent } from '../types';
import { createTimestamp } from './benchmarkDatasets';

export const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: 'scen-role-chaining',
    title: 'Multi-Hop IAM Role Chaining (T1548.005)',
    mitreId: 'T1548.005',
    category: 'ROLE_CHAINING',
    description: 'Adversary pivots across 3 chained STS AssumeRole trust policies starting from low-privilege contractor to gain AdministratorAccess.',
    expectedAnomalyScore: 0.94,
    eventsCount: 6,
    steps: [
      {
        step: 1,
        eventName: 'GetCallerIdentity',
        entity: 'intern-contractor',
        description: 'Verify compromised credentials and discover AWS account ID.',
        payloadSnippet: 'sts:GetCallerIdentity -> Account: 123456789012',
      },
      {
        step: 2,
        eventName: 'ListRoles',
        entity: 'intern-contractor',
        description: 'Enumerate IAM roles and trust policies for assume-role permissions.',
        payloadSnippet: 'iam:ListRoles -> Found DevInternalAccessRole',
      },
      {
        step: 3,
        eventName: 'AssumeRole (Hop 1)',
        entity: 'intern-contractor -> DevInternalAccessRole',
        description: 'Execute first STS AssumeRole hop into development role.',
        payloadSnippet: 'sts:AssumeRole -> RoleArn: arn:aws:iam::...:role/DevInternalAccessRole',
      },
      {
        step: 4,
        eventName: 'AssumeRole (Hop 2)',
        entity: 'DevInternalAccessRole -> StagingDeployerServiceRole',
        description: 'Execute second STS AssumeRole hop across intermediate trust boundary.',
        payloadSnippet: 'sts:AssumeRole -> RoleArn: arn:aws:iam::...:role/StagingDeployerServiceRole',
      },
      {
        step: 5,
        eventName: 'AssumeRole (Hop 3)',
        entity: 'StagingDeployerServiceRole -> ProductionSecOpsAdminRole',
        description: 'Execute third STS AssumeRole hop into critical administrative role.',
        payloadSnippet: 'sts:AssumeRole -> RoleArn: arn:aws:iam::...:role/ProductionSecOpsAdminRole',
      },
      {
        step: 6,
        eventName: 'AttachUserPolicy',
        entity: 'ProductionSecOpsAdminRole -> AdministratorAccess',
        description: 'Abuse admin role to permanently attach AdministratorAccess to attacker account.',
        payloadSnippet: 'iam:AttachUserPolicy -> PolicyArn: arn:aws:iam::aws:policy/AdministratorAccess',
      },
    ],
  },
  {
    id: 'scen-policy-version',
    title: 'Stealth IAM Policy Version Privilege Escalation (T1098)',
    mitreId: 'T1098',
    category: 'PRIVILEGE_ESCALATION',
    description: 'Exploits iam:CreatePolicyVersion with setAsDefault=true to covertly replace a restricted developer policy with full Action:* / Resource:* rights.',
    expectedAnomalyScore: 0.89,
    eventsCount: 2,
    steps: [
      {
        step: 1,
        eventName: 'CreatePolicyVersion',
        entity: 'temp-developer-jenkins',
        description: 'Create new policy version granting unrestricted Action:* permissions and set as default.',
        payloadSnippet: 'iam:CreatePolicyVersion -> {"Effect":"Allow","Action":"*","Resource":"*"}, setAsDefault=true',
      },
      {
        step: 2,
        eventName: 'CreateAccessKey',
        entity: 'temp-developer-jenkins',
        description: 'Generate redundant API access key pair for persistence.',
        payloadSnippet: 'iam:CreateAccessKey -> User: temp-developer-jenkins',
      },
    ],
  },
  {
    id: 'scen-s3-exfil',
    title: 'S3 Data Staging & Mass Exfiltration (T1530)',
    mitreId: 'T1530',
    category: 'EXFILTRATION',
    description: 'Rapid burst of 20+ s3:GetObject API calls targeting confidential customer financial records followed by bucket policy tampering.',
    expectedAnomalyScore: 0.86,
    eventsCount: 21,
    steps: [
      {
        step: 1,
        eventName: 'GetObject (Burst x20)',
        entity: 'marketing-analyst',
        description: 'Automated script loops through production customer financial parquet objects.',
        payloadSnippet: 's3:GetObject -> Bucket: customer-pii-financial-records-prod (20 files)',
      },
      {
        step: 2,
        eventName: 'PutBucketPolicy (Denied)',
        entity: 'marketing-analyst',
        description: 'Attempt to alter bucket ACL / policy to disable public block or logging.',
        payloadSnippet: 's3:PutBucketPolicy -> AccessDenied 403 Forbidden',
      },
    ],
  },
  {
    id: 'scen-credential-spraying',
    title: 'Compromised Access Key Spraying & Discovery (T1078)',
    mitreId: 'T1078',
    category: 'CREDENTIAL_ACCESS',
    description: 'External threat actor uses leaked credentials to perform rapid automated probing across SecretsManager, KMS, and IAM producing high AccessDenied spikes.',
    expectedAnomalyScore: 0.91,
    eventsCount: 15,
    steps: [
      {
        step: 1,
        eventName: 'AccessDenied Flood (x15 APIs)',
        entity: 'leaked-contractor-key',
        description: 'Rapid enumeration of AWS SecretsManager, KMS keys, IAM users, and RDS instances.',
        payloadSnippet: 'ScoutSuite automated scan -> 15 consecutive AccessDenied failures across 7 services',
      },
    ],
  },
];

export function generateScenarioEvents(scenarioId: string): CloudTrailEvent[] {
  const baseOffset = Math.floor(Math.random() * 50) + 600;
  const now = new Date();

  switch (scenarioId) {
    case 'scen-role-chaining':
      return [
        {
          eventID: `evt-live-rc-${Date.now()}-1`,
          eventTime: new Date(now.getTime() - 5 * 60000).toISOString(),
          eventSource: 'sts.amazonaws.com',
          eventName: 'GetCallerIdentity',
          awsRegion: 'us-east-1',
          sourceIPAddress: '185.220.101.5',
          userAgent: 'Pacu/1.4.1 (AWS Exploitation Framework)',
          userIdentity: {
            type: 'IAMUser',
            principalId: 'AIDA-COMPROMISED-INTERN',
            arn: 'arn:aws:iam::123456789012:user/intern-contractor',
            accountId: '123456789012',
            userName: 'intern-contractor',
          },
          isSimulatedAttack: true,
          attackLabel: 'Initial Discovery (T1078)',
        },
        {
          eventID: `evt-live-rc-${Date.now()}-2`,
          eventTime: new Date(now.getTime() - 4 * 60000).toISOString(),
          eventSource: 'iam.amazonaws.com',
          eventName: 'ListRoles',
          awsRegion: 'us-east-1',
          sourceIPAddress: '185.220.101.5',
          userAgent: 'Pacu/1.4.1 (AWS Exploitation Framework)',
          userIdentity: {
            type: 'IAMUser',
            principalId: 'AIDA-COMPROMISED-INTERN',
            arn: 'arn:aws:iam::123456789012:user/intern-contractor',
            accountId: '123456789012',
            userName: 'intern-contractor',
          },
          isSimulatedAttack: true,
          attackLabel: 'IAM Discovery (T1087.004)',
        },
        {
          eventID: `evt-live-rc-${Date.now()}-3`,
          eventTime: new Date(now.getTime() - 3 * 60000).toISOString(),
          eventSource: 'sts.amazonaws.com',
          eventName: 'AssumeRole',
          awsRegion: 'us-east-1',
          sourceIPAddress: '185.220.101.5',
          userAgent: 'Pacu/1.4.1 (AWS Exploitation Framework)',
          userIdentity: {
            type: 'IAMUser',
            principalId: 'AIDA-COMPROMISED-INTERN',
            arn: 'arn:aws:iam::123456789012:user/intern-contractor',
            accountId: '123456789012',
            userName: 'intern-contractor',
          },
          requestParameters: {
            roleArn: 'arn:aws:iam::123456789012:role/DevInternalAccessRole',
            roleSessionName: 'session-dev-pivot',
          },
          isSimulatedAttack: true,
          attackLabel: 'Role Chaining Hop 1 (T1548.005)',
        },
        {
          eventID: `evt-live-rc-${Date.now()}-4`,
          eventTime: new Date(now.getTime() - 2 * 60000).toISOString(),
          eventSource: 'sts.amazonaws.com',
          eventName: 'AssumeRole',
          awsRegion: 'us-east-1',
          sourceIPAddress: '185.220.101.5',
          userAgent: 'Pacu/1.4.1 (AWS Exploitation Framework)',
          userIdentity: {
            type: 'AssumedRole',
            principalId: 'AROA-DEV-INTERNAL:session-dev-pivot',
            arn: 'arn:aws:sts::123456789012:assumed-role/DevInternalAccessRole/session-dev-pivot',
            accountId: '123456789012',
          },
          requestParameters: {
            roleArn: 'arn:aws:iam::123456789012:role/StagingDeployerServiceRole',
            roleSessionName: 'session-staging-pivot',
          },
          isSimulatedAttack: true,
          attackLabel: 'Role Chaining Hop 2 (T1548.005)',
        },
        {
          eventID: `evt-live-rc-${Date.now()}-5`,
          eventTime: new Date(now.getTime() - 1 * 60000).toISOString(),
          eventSource: 'sts.amazonaws.com',
          eventName: 'AssumeRole',
          awsRegion: 'us-east-1',
          sourceIPAddress: '185.220.101.5',
          userAgent: 'Pacu/1.4.1 (AWS Exploitation Framework)',
          userIdentity: {
            type: 'AssumedRole',
            principalId: 'AROA-STAGING-DEPLOYER:session-staging-pivot',
            arn: 'arn:aws:sts::123456789012:assumed-role/StagingDeployerServiceRole/session-staging-pivot',
            accountId: '123456789012',
          },
          requestParameters: {
            roleArn: 'arn:aws:iam::123456789012:role/ProductionSecOpsAdminRole',
            roleSessionName: 'session-admin-compromise',
          },
          isSimulatedAttack: true,
          attackLabel: 'Role Chaining Hop 3 (T1548.005)',
        },
        {
          eventID: `evt-live-rc-${Date.now()}-6`,
          eventTime: new Date().toISOString(),
          eventSource: 'iam.amazonaws.com',
          eventName: 'AttachUserPolicy',
          awsRegion: 'us-east-1',
          sourceIPAddress: '185.220.101.5',
          userAgent: 'Pacu/1.4.1 (AWS Exploitation Framework)',
          userIdentity: {
            type: 'AssumedRole',
            principalId: 'AROA-PROD-SECOPS:session-admin-compromise',
            arn: 'arn:aws:sts::123456789012:assumed-role/ProductionSecOpsAdminRole/session-admin-compromise',
            accountId: '123456789012',
          },
          requestParameters: {
            userName: 'intern-contractor',
            policyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
          },
          isSimulatedAttack: true,
          attackLabel: 'Privilege Escalation via AttachUserPolicy (T1098)',
        },
      ];

    case 'scen-policy-version':
      return [
        {
          eventID: `evt-live-pv-${Date.now()}-1`,
          eventTime: new Date(now.getTime() - 60000).toISOString(),
          eventSource: 'iam.amazonaws.com',
          eventName: 'CreatePolicyVersion',
          awsRegion: 'us-west-2',
          sourceIPAddress: '45.154.255.89',
          userAgent: 'boto3/1.28.1 Python/3.9.1 Linux/5.10.0',
          userIdentity: {
            type: 'IAMUser',
            principalId: 'AIDA-DEVELOPER-TEMP',
            arn: 'arn:aws:iam::123456789012:user/temp-developer-jenkins',
            accountId: '123456789012',
            userName: 'temp-developer-jenkins',
          },
          requestParameters: {
            policyArn: 'arn:aws:iam::123456789012:policy/DeveloperStandardPolicy',
            policyDocument: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}',
            setAsDefault: true,
          },
          isSimulatedAttack: true,
          attackLabel: 'Malicious Policy Version Injection (T1098)',
        },
        {
          eventID: `evt-live-pv-${Date.now()}-2`,
          eventTime: new Date().toISOString(),
          eventSource: 'iam.amazonaws.com',
          eventName: 'CreateAccessKey',
          awsRegion: 'us-west-2',
          sourceIPAddress: '45.154.255.89',
          userAgent: 'boto3/1.28.1 Python/3.9.1 Linux/5.10.0',
          userIdentity: {
            type: 'IAMUser',
            principalId: 'AIDA-DEVELOPER-TEMP',
            arn: 'arn:aws:iam::123456789012:user/temp-developer-jenkins',
            accountId: '123456789012',
            userName: 'temp-developer-jenkins',
          },
          requestParameters: {
            userName: 'temp-developer-jenkins',
          },
          isSimulatedAttack: true,
          attackLabel: 'Backdoor Access Key Persistence (T1098)',
        },
      ];

    default:
      return [];
  }
}
