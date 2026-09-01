import { CloudTrailEvent } from '../types';

// Helper to generate realistic timestamps over past 24 hours
const baseTime = new Date('2026-08-29T10:00:00Z').getTime();

export function createTimestamp(offsetMinutes: number): string {
  return new Date(baseTime + offsetMinutes * 60 * 1000).toISOString();
}

/**
 * Normal Baseline Dataset: Represents 1,000+ authentic normal AWS CloudTrail events
 * across legitimate developer, DevOps, CI/CD, and system identities.
 */
export function generateNormalBaseline(): CloudTrailEvent[] {
  const events: CloudTrailEvent[] = [];
  const benignEntities = [
    { name: 'alice-developer', arn: 'arn:aws:iam::123456789012:user/alice-developer', role: 'Developer' },
    { name: 'bob-frontend', arn: 'arn:aws:iam::123456789012:user/bob-frontend', role: 'FrontendDev' },
    { name: 'charlie-qa', arn: 'arn:aws:iam::123456789012:user/charlie-qa', role: 'QATester' },
    { name: 'cicd-github-runner', arn: 'arn:aws:iam::123456789012:role/GitHubActionsRunner', role: 'Automation' },
    { name: 'terraform-pipeline', arn: 'arn:aws:iam::123456789012:role/TerraformProvisioner', role: 'Automation' },
    { name: 'readonly-auditor', arn: 'arn:aws:iam::123456789012:user/security-auditor-readonly', role: 'Auditor' },
    { name: 'eks-node-instance', arn: 'arn:aws:iam::123456789012:role/EKSClusterNodeGroupRole', role: 'Service' },
  ];

  const benignApis = [
    { service: 'ec2.amazonaws.com', action: 'DescribeInstances' },
    { service: 'ec2.amazonaws.com', action: 'DescribeSecurityGroups' },
    { service: 's3.amazonaws.com', action: 'ListBuckets' },
    { service: 's3.amazonaws.com', action: 'GetObject' },
    { service: 's3.amazonaws.com', action: 'HeadObject' },
    { service: 'iam.amazonaws.com', action: 'GetUser' },
    { service: 'iam.amazonaws.com', action: 'GetAccountSummary' },
    { service: 'iam.amazonaws.com', action: 'ListAttachedUserPolicies' },
    { service: 'sts.amazonaws.com', action: 'GetCallerIdentity' },
    { service: 'cloudwatch.amazonaws.com', action: 'GetMetricData' },
    { service: 'logs.amazonaws.com', action: 'FilterLogEvents' },
    { service: 'dynamodb.amazonaws.com', action: 'GetItem' },
    { service: 'lambda.amazonaws.com', action: 'ListFunctions' },
  ];

  const benignIps = ['198.51.100.24', '198.51.100.25', '203.0.113.10', '203.0.113.11', '54.240.196.185'];
  const userAgents = [
    'aws-sdk-js/3.400.0 (Node.js/v20.10.0; Linux)',
    'aws-cli/2.15.15 Python/3.11.6 Linux/6.5.0 botocore/2.4.15',
    'Terraform/1.7.4 (+https://www.terraform.io) terraform-provider-aws/5.38.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 AWS-Console',
  ];

  let idCounter = 1000;
  // Generate 800 regular distributed benign events
  for (let i = 0; i < 800; i++) {
    const entity = benignEntities[i % benignEntities.length];
    const api = benignApis[Math.floor(Math.random() * benignApis.length)];
    const ip = benignIps[Math.floor(Math.random() * benignIps.length)];
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
    const offset = Math.floor((i / 800) * 720); // Distributed over 12 hours

    events.push({
      eventID: `evt-norm-${idCounter++}`,
      eventTime: createTimestamp(offset),
      eventSource: api.service,
      eventName: api.action,
      awsRegion: 'us-east-1',
      sourceIPAddress: ip,
      userAgent: ua,
      userIdentity: {
        type: entity.arn.includes('role') ? 'AssumedRole' : 'IAMUser',
        principalId: `AIDA${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        arn: entity.arn,
        accountId: '123456789012',
        userName: entity.name,
      },
      requestParameters: {
        bucketName: api.action.includes('Object') ? 'company-assets-prod' : undefined,
      },
      recipientAccountId: '123456789012',
      isSimulatedAttack: false,
    });
  }

  return events;
}

/**
 * Benchmark Attack Dataset 1: Role Chaining Privilege Escalation
 * Multi-hop sts:AssumeRole chaining from low-privilege contractor to Full Admin.
 */
export function generateRoleChainingAttack(): CloudTrailEvent[] {
  const events: CloudTrailEvent[] = [];
  let t = 400; // start at minute 400

  // 1. Initial Reconnaissance
  events.push({
    eventID: 'evt-atk-rc-01',
    eventTime: createTimestamp(t++),
    eventSource: 'sts.amazonaws.com',
    eventName: 'GetCallerIdentity',
    awsRegion: 'us-east-1',
    sourceIPAddress: '185.220.101.5', // Suspicious Tor/VPN IP
    userAgent: 'Pacu/1.4.1 (AWS Exploitation Framework)',
    userIdentity: {
      type: 'IAMUser',
      principalId: 'AIDA-COMPROMISED-INTERN',
      arn: 'arn:aws:iam::123456789012:user/intern-contractor',
      accountId: '123456789012',
      userName: 'intern-contractor',
    },
    isSimulatedAttack: true,
    attackLabel: 'Initial Credential Abuse (T1078)',
  });

  // 2. Enumerate AssumeRole permissions
  events.push({
    eventID: 'evt-atk-rc-02',
    eventTime: createTimestamp(t++),
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
  });

  // 3. First AssumeRole Hop -> DevRole
  events.push({
    eventID: 'evt-atk-rc-03',
    eventTime: createTimestamp(t++),
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
  });

  // 4. Second AssumeRole Hop -> StagingDeployerRole
  events.push({
    eventID: 'evt-atk-rc-04',
    eventTime: createTimestamp(t++),
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
  });

  // 5. Third AssumeRole Hop -> ProductionSecOpsAdmin
  events.push({
    eventID: 'evt-atk-rc-05',
    eventTime: createTimestamp(t++),
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
  });

  // 6. High-Privilege Abuse: Attach AdministratorAccess
  events.push({
    eventID: 'evt-atk-rc-06',
    eventTime: createTimestamp(t++),
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
  });

  return events;
}

/**
 * Benchmark Attack Dataset 2: Stealthy IAM Policy Version Injection (T1098)
 * Exploiting iam:CreatePolicyVersion to elevate default IAM policy to wildcard Action/Resource.
 */
export function generatePolicyVersionPrivilegeEscalation(): CloudTrailEvent[] {
  const events: CloudTrailEvent[] = [];
  let t = 450;

  events.push({
    eventID: 'evt-atk-pv-01',
    eventTime: createTimestamp(t++),
    eventSource: 'iam.amazonaws.com',
    eventName: 'CreatePolicyVersion',
    awsRegion: 'us-west-2',
    sourceIPAddress: '45.154.255.89', // Off-shore bulletproof proxy
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
  });

  events.push({
    eventID: 'evt-atk-pv-02',
    eventTime: createTimestamp(t++),
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
  });

  return events;
}

/**
 * Benchmark Attack Dataset 3: S3 Data Staging & Exfiltration (T1530)
 */
export function generateS3ExfiltrationAttack(): CloudTrailEvent[] {
  const events: CloudTrailEvent[] = [];
  let t = 500;

  // Mass S3 object download burst
  for (let i = 0; i < 20; i++) {
    events.push({
      eventID: `evt-atk-s3-${i + 1}`,
      eventTime: createTimestamp(t++),
      eventSource: 's3.amazonaws.com',
      eventName: 'GetObject',
      awsRegion: 'us-east-1',
      sourceIPAddress: '91.240.118.20',
      userAgent: 'aws-cli/1.29.0 Python/3.8.10 exfil-script/0.2',
      userIdentity: {
        type: 'IAMUser',
        principalId: 'AIDA-MARKETING-ANALYST',
        arn: 'arn:aws:iam::123456789012:user/marketing-analyst',
        accountId: '123456789012',
        userName: 'marketing-analyst',
      },
      requestParameters: {
        bucketName: 'customer-pii-financial-records-prod',
        key: `export_customers_batch_${i + 1}.parquet.enc`,
      },
      isSimulatedAttack: true,
      attackLabel: 'S3 Data Exfiltration Burst (T1530)',
    });
  }

  // Attempt to remove bucket encryption/policy
  events.push({
    eventID: 'evt-atk-s3-21',
    eventTime: createTimestamp(t++),
    eventSource: 's3.amazonaws.com',
    eventName: 'PutBucketPolicy',
    awsRegion: 'us-east-1',
    sourceIPAddress: '91.240.118.20',
    userAgent: 'aws-cli/1.29.0 Python/3.8.10 exfil-script/0.2',
    userIdentity: {
      type: 'IAMUser',
      principalId: 'AIDA-MARKETING-ANALYST',
      arn: 'arn:aws:iam::123456789012:user/marketing-analyst',
      accountId: '123456789012',
      userName: 'marketing-analyst',
    },
    errorCode: 'AccessDenied',
    errorMessage: 'User is not authorized to perform s3:PutBucketPolicy on resource',
    isSimulatedAttack: true,
    attackLabel: 'S3 ACL Tampering & AccessDenied Failure (T1530)',
  });

  return events;
}

/**
 * Benchmark Attack Dataset 4: Credential Spraying & AccessDenied Flood (T1078)
 */
export function generateCredentialSprayingAttack(): CloudTrailEvent[] {
  const events: CloudTrailEvent[] = [];
  let t = 550;

  const probeServices = [
    { s: 'secretsmanager.amazonaws.com', a: 'ListSecrets' },
    { s: 'ssm.amazonaws.com', a: 'DescribeParameters' },
    { s: 'kms.amazonaws.com', a: 'ListKeys' },
    { s: 'iam.amazonaws.com', a: 'ListUsers' },
    { s: 'iam.amazonaws.com', a: 'CreateVirtualMFADevice' },
    { s: 'ec2.amazonaws.com', a: 'DescribeInstances' },
    { s: 'rds.amazonaws.com', a: 'DescribeDBInstances' },
  ];

  for (let i = 0; i < 15; i++) {
    const probe = probeServices[i % probeServices.length];
    events.push({
      eventID: `evt-atk-spray-${i + 1}`,
      eventTime: createTimestamp(t++),
      eventSource: probe.s,
      eventName: probe.a,
      awsRegion: 'ap-northeast-1',
      sourceIPAddress: `194.26.29.${10 + (i % 5)}`, // Distributed proxy pool
      userAgent: 'ScoutSuite/5.12.0 botocore/1.29.0',
      userIdentity: {
        type: 'IAMUser',
        principalId: 'AIDA-LEAKED-GIT-KEY',
        arn: 'arn:aws:iam::123456789012:user/leaked-contractor-key',
        accountId: '123456789012',
        userName: 'leaked-contractor-key',
      },
      errorCode: 'AccessDenied',
      errorMessage: `User is not authorized to perform ${probe?.s?.split('.')?.[0] || 'aws'}:${probe?.a || 'Action'} on resource: *`,
      isSimulatedAttack: true,
      attackLabel: 'Credential Spraying & Discovery (T1078)',
    });
  }

  return events;
}

/**
 * Returns complete aggregated dataset (Normal Baseline + Simulated Attacks)
 */
export function getAllBenchmarkEvents(): CloudTrailEvent[] {
  const normal = generateNormalBaseline();
  const roleChaining = generateRoleChainingAttack();
  const policyVersion = generatePolicyVersionPrivilegeEscalation();
  const s3Exfil = generateS3ExfiltrationAttack();
  const spraying = generateCredentialSprayingAttack();

  const all = [...normal, ...roleChaining, ...policyVersion, ...s3Exfil, ...spraying];
  // Sort chronologically
  return all.sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
}

// Convenient aliases
export const generateBenchmarkDataset = getAllBenchmarkEvents;
export const generateRoleChainingDataset = generateRoleChainingAttack;
export const generatePolicyVersionDataset = generatePolicyVersionPrivilegeEscalation;
export const generateS3ExfilDataset = generateS3ExfiltrationAttack;
export const generateCredentialSprayingDataset = generateCredentialSprayingAttack;
export const generateNormalBaselineTraffic = (count?: number) => generateNormalBaseline();

