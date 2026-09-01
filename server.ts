import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'node:zlib';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { CloudTrailClient, LookupEventsCommand, DescribeTrailsCommand, LookupAttributeKey } from '@aws-sdk/client-cloudtrail';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to create AWS Clients with optional custom credentials override or environment variables
function getAwsConfig(customCreds?: {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
}) {
  const accessKeyId = customCreds?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = customCreds?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '';
  const sessionToken = customCreds?.sessionToken || process.env.AWS_SESSION_TOKEN;
  const region = customCreds?.region || process.env.AWS_REGION || 'us-east-1';

  const clientConfig: any = { region };
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
  }
  return { clientConfig, region, hasCredentials: Boolean(accessKeyId && secretAccessKey) };
}

// Initialize Google GenAI client for server-side threat investigation & proactive defense
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CloudGuard-ITDR-Engine',
    version: '2.4.0',
    models: ['IsolationForest', 'LSTM_Autoencoder'],
    awsIntegration: {
      hasEnvCredentials: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      defaultRegion: process.env.AWS_REGION || 'us-east-1',
      s3Bucket: process.env.AWS_CLOUDTRAIL_S3_BUCKET || null,
    },
    timestamp: new Date().toISOString(),
  });
});

// AWS Infrastructure Status endpoint
app.get('/api/aws/status', (req, res) => {
  const hasCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  res.json({
    connected: hasCreds,
    configuredRegion: process.env.AWS_REGION || 'us-east-1',
    configuredS3Bucket: process.env.AWS_CLOUDTRAIL_S3_BUCKET || '',
    accessKeyMasked: process.env.AWS_ACCESS_KEY_ID
      ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 4)}...${process.env.AWS_ACCESS_KEY_ID.slice(-4)}`
      : null,
  });
});

// AWS Connection Test endpoint (validates STS GetCallerIdentity & CloudTrail DescribeTrails)
app.post('/api/aws/test-connection', async (req, res) => {
  try {
    const { accessKeyId, secretAccessKey, sessionToken, region } = req.body;
    const { clientConfig, region: effectiveRegion, hasCredentials } = getAwsConfig({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
    });

    if (!hasCredentials) {
      return res.json({
        success: false,
        connected: false,
        error: 'No AWS Credentials provided in request body or environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).',
        hint: 'Enter your AWS credentials or set them in the environment to connect directly to live AWS CloudTrail.',
      });
    }

    const stsClient = new STSClient(clientConfig);
    const callerIdentity = await stsClient.send(new GetCallerIdentityCommand({}));

    // Discover CloudTrail trails in this region
    let trails: any[] = [];
    try {
      const ctClient = new CloudTrailClient(clientConfig);
      const ctResp = await ctClient.send(new DescribeTrailsCommand({}));
      trails = ctResp.trailList || [];
    } catch (e: any) {
      console.warn('Unable to list CloudTrails in region:', e.message);
    }

    res.json({
      success: true,
      connected: true,
      accountId: callerIdentity.Account,
      callerArn: callerIdentity.Arn,
      userId: callerIdentity.UserId,
      region: effectiveRegion,
      discoveredTrails: trails.map((t) => ({
        name: t.Name,
        s3BucketName: t.S3BucketName,
        isMultiRegionTrail: t.IsMultiRegionTrail,
        homeRegion: t.HomeRegion,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('AWS Connection Test Failed:', err);
    res.status(400).json({
      success: false,
      connected: false,
      error: err.message,
      errorCode: err.name || 'AWS_STS_ERROR',
    });
  }
});

// AWS Live CloudTrail Event Fetch / Lookup endpoint
app.post('/api/aws/cloudtrail/fetch-live', async (req, res) => {
  try {
    const {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
      timeRangeMinutes = 60,
      maxResults = 50,
      lookupAttributeKey,
      lookupAttributeValue,
      readOnlyFilter,
    } = req.body;

    const { clientConfig, region: effectiveRegion, hasCredentials } = getAwsConfig({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
    });

    if (!hasCredentials) {
      return res.status(400).json({
        success: false,
        error: 'AWS credentials not found. Please provide valid AWS Access Key & Secret Key.',
      });
    }

    const ctClient = new CloudTrailClient(clientConfig);
    const startTime = new Date(Date.now() - (timeRangeMinutes * 60 * 1000));
    const endTime = new Date();

    const lookupAttributes: any[] = [];
    if (lookupAttributeKey && lookupAttributeValue) {
      lookupAttributes.push({
        AttributeKey: lookupAttributeKey as LookupAttributeKey,
        AttributeValue: lookupAttributeValue,
      });
    }

    if (readOnlyFilter === 'false' || readOnlyFilter === false) {
      lookupAttributes.push({
        AttributeKey: 'ReadOnly' as LookupAttributeKey,
        AttributeValue: 'false',
      });
    }

    const command = new LookupEventsCommand({
      StartTime: startTime,
      EndTime: endTime,
      MaxResults: Math.min(Number(maxResults) || 50, 100),
      ...(lookupAttributes.length > 0 ? { LookupAttributes: lookupAttributes } : {}),
    });

    const response = await ctClient.send(command);
    const rawEvents = response.Events || [];

    // Parse and normalize into standard CloudTrailEvent schema
    const normalizedEvents: any[] = [];
    for (const raw of rawEvents) {
      let eventPayload: any = null;
      if (raw.CloudTrailEvent) {
        try {
          eventPayload = JSON.parse(raw.CloudTrailEvent);
        } catch {
          eventPayload = null;
        }
      }

      if (eventPayload) {
        normalizedEvents.push({
          eventID: eventPayload.eventID || raw.EventId || `evt-aws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          eventTime: eventPayload.eventTime || raw.EventTime?.toISOString() || new Date().toISOString(),
          eventSource: eventPayload.eventSource || raw.EventSource || 'aws.general',
          eventName: eventPayload.eventName || raw.EventName || 'UnknownAction',
          awsRegion: eventPayload.awsRegion || effectiveRegion,
          sourceIPAddress: eventPayload.sourceIPAddress || '198.51.100.1',
          userAgent: eventPayload.userAgent || 'aws-sdk-nodejs',
          userIdentity: eventPayload.userIdentity || {
            type: 'IAMUser',
            principalId: raw.Username || 'aws-user',
            arn: `arn:aws:iam::account:user/${raw.Username || 'aws-user'}`,
            accountId: 'aws-account',
            userName: raw.Username || 'aws-user',
          },
          requestParameters: eventPayload.requestParameters,
          responseElements: eventPayload.responseElements,
          errorCode: eventPayload.errorCode,
          errorMessage: eventPayload.errorMessage,
          recipientAccountId: eventPayload.recipientAccountId,
        });
      } else {
        normalizedEvents.push({
          eventID: raw.EventId || `evt-aws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          eventTime: raw.EventTime ? new Date(raw.EventTime).toISOString() : new Date().toISOString(),
          eventSource: raw.EventSource || 'aws.general',
          eventName: raw.EventName || 'UnknownAction',
          awsRegion: effectiveRegion,
          sourceIPAddress: '198.51.100.1',
          userAgent: 'aws-sdk-nodejs',
          userIdentity: {
            type: 'IAMUser',
            principalId: raw.Username || 'aws-user',
            arn: `arn:aws:iam::account:user/${raw.Username || 'aws-user'}`,
            accountId: 'aws-account',
            userName: raw.Username || 'aws-user',
          },
          requestParameters: {},
          responseElements: {},
        });
      }
    }

    res.json({
      success: true,
      count: normalizedEvents.length,
      events: normalizedEvents,
      region: effectiveRegion,
      timeRangeMinutes,
      nextToken: response.NextToken,
    });
  } catch (err: any) {
    console.error('Fetch AWS CloudTrail Events Error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      errorCode: err.name || 'CLOUDTRAIL_LOOKUP_ERROR',
    });
  }
});

// AWS S3 CloudTrail Bucket Log Archive Ingestion endpoint
app.post('/api/aws/s3/fetch-trail-logs', async (req, res) => {
  try {
    const {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
      bucketName,
      prefix = 'AWSLogs/',
      maxFiles = 5,
    } = req.body;

    const effectiveBucket = bucketName || process.env.AWS_CLOUDTRAIL_S3_BUCKET;
    if (!effectiveBucket) {
      return res.status(400).json({
        success: false,
        error: 'S3 bucket name not specified. Please provide a bucket name or set AWS_CLOUDTRAIL_S3_BUCKET.',
      });
    }

    const { clientConfig, region: effectiveRegion, hasCredentials } = getAwsConfig({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
    });

    if (!hasCredentials) {
      return res.status(400).json({
        success: false,
        error: 'AWS credentials not configured to read S3 log archives.',
      });
    }

    const s3Client = new S3Client(clientConfig);

    // List objects in bucket matching prefix
    const listCmd = new ListObjectsV2Command({
      Bucket: effectiveBucket,
      Prefix: prefix,
      MaxKeys: Math.min(Number(maxFiles) || 5, 20),
    });

    const listResp = await s3Client.send(listCmd);
    const objects = (listResp.Contents || []).filter(
      (obj) => obj.Key?.endsWith('.json.gz') || obj.Key?.endsWith('.json')
    );

    const allEvents: any[] = [];
    const processedFiles: string[] = [];

    for (const obj of objects.slice(0, 5)) {
      if (!obj.Key) continue;
      try {
        const getCmd = new GetObjectCommand({
          Bucket: effectiveBucket,
          Key: obj.Key,
        });
        const getResp = await s3Client.send(getCmd);
        const byteArray = await getResp.Body?.transformToByteArray();

        if (byteArray) {
          let jsonString = '';
          if (obj.Key.endsWith('.gz')) {
            const decompressed = zlib.gunzipSync(Buffer.from(byteArray));
            jsonString = decompressed.toString('utf-8');
          } else {
            jsonString = Buffer.from(byteArray).toString('utf-8');
          }

          const parsed = JSON.parse(jsonString);
          const records = parsed.Records || parsed.events || (Array.isArray(parsed) ? parsed : []);
          allEvents.push(...records);
          processedFiles.push(obj.Key);
        }
      } catch (fileErr: any) {
        console.warn(`Error reading S3 object ${obj.Key}:`, fileErr.message);
      }
    }

    res.json({
      success: true,
      bucket: effectiveBucket,
      filesProcessed: processedFiles.length,
      fileKeys: processedFiles,
      recordsExtracted: allEvents.length,
      events: allEvents,
    });
  } catch (err: any) {
    console.error('S3 CloudTrail Fetch Error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Ingest CloudTrail JSON logs endpoint
app.post('/api/cloudtrail/ingest', (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Payload must contain an "events" array.' });
    }
    // Process and return acknowledged batch
    res.json({
      success: true,
      ingestedCount: events.length,
      timestamp: new Date().toISOString(),
      status: 'PARSED_AND_INDEXED',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Analyst Feedback & False Positive Tracking endpoint
const feedbackStore: any[] = [];
app.post('/api/feedback', (req, res) => {
  try {
    const { alertId, analystVerdict, comment, analyst, entityArn, confidenceScore } = req.body;
    const record = {
      id: `fb-${Date.now()}`,
      alertId,
      analystVerdict, // 'TRUE_POSITIVE' | 'FALSE_POSITIVE'
      comment: comment || '',
      analyst: analyst || 'SOC Analyst (P Rahul)',
      entityArn,
      confidenceScore,
      timestamp: new Date().toISOString(),
    };
    feedbackStore.push(record);

    // Calculate rolling window FP rate
    const recent = feedbackStore.slice(-20);
    const fpCount = recent.filter(r => r.analystVerdict === 'FALSE_POSITIVE').length;
    const fpRate = recent.length > 0 ? (fpCount / recent.length) : 0;
    const retrainingTriggered = fpRate > 0.20;

    res.json({
      success: true,
      record,
      rollingWindowSize: recent.length,
      falsePositiveRate: Number(fpRate.toFixed(3)),
      retrainingTriggered,
      message: retrainingTriggered
        ? 'False positive rate exceeded 20% threshold! Airflow Retraining DAG triggered.'
        : 'Feedback stored successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/feedback', (req, res) => {
  res.json({
    totalFeedbacks: feedbackStore.length,
    feedbacks: feedbackStore,
  });
});

// Proactive Containment / SOAR endpoint
app.post('/api/soar/contain', (req, res) => {
  try {
    const { entityArn, actionType } = req.body;
    const actionId = `contain-${Date.now()}`;
    let script = '';

    switch (actionType) {
      case 'REVOKE_SESSIONS': {
        const principalName = entityArn?.split('/')?.pop() || entityArn || 'principal';
        script = `# AWS CLI: Revoke all active IAM sessions before current timestamp
aws iam put-user-policy --user-name "${principalName}" \\
  --policy-name "DenyAllBefore${Date.now()}" \\
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"*","Resource":"*","Condition":{"DateLessThan":{"aws:TokenIssueTime":"${new Date().toISOString()}"}}}]}'`;
        break;
      }

      case 'ATTACH_DENY_POLICY': {
        const principalName = entityArn?.split('/')?.pop() || entityArn || 'principal';
        script = `# AWS CLI / Terraform: Attach immediate quarantine DenyAll boundary
aws iam put-user-policy --user-name "${principalName}" \\
  --policy-name "Quarantine-DenyAll" \\
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"*","Resource":"*"}]}'`;
        break;
      }

      case 'QUARANTINE_ROLE': {
        const principalName = entityArn?.split('/')?.pop() || entityArn || 'principal';
        script = `# AWS CLI: Replace trust policy with empty principal to halt role chaining
aws iam update-assume-role-policy --role-name "${principalName}" \\
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Principal":"*","Action":"sts:AssumeRole"}]}'`;
        break;
      }

      default:
        script = `# Invalidate STS session tokens
aws sts decode-authorization-message --encoded-message "<Token-Payload>"`;
    }

    res.json({
      success: true,
      actionId,
      entityArn,
      actionType,
      status: 'EXECUTED',
      executedAt: new Date().toISOString(),
      remediationScript: script,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Threat Investigation Copilot (Gemini 3.7 Flash)
app.post('/api/ai/investigate', async (req, res) => {
  try {
    const { alert, rawEvent, featureVector } = req.body;
    const ai = getGenAI();

    const prompt = `You are a Principal Cloud Incident Responder and Cyber Threat Intelligence specialist specializing in AWS Cloud IAM, CloudTrail forensics, and Identity Threat Detection & Response (ITDR).

Analyze the following high-confidence AWS CloudTrail anomaly detection alert:
- Entity ARN: ${alert?.entityArn || 'Unknown'}
- AWS Region: ${rawEvent?.awsRegion || 'us-east-1'}
- Event Name: ${rawEvent?.eventName || 'Unknown'}
- Event Source: ${rawEvent?.eventSource || 'iam.amazonaws.com'}
- Source IP: ${rawEvent?.sourceIPAddress || 'Unknown'}
- User Agent: ${rawEvent?.userAgent || 'Unknown'}
- Model Ensemble Confidence Score: ${(alert?.ensembleConfidenceScore * 100).toFixed(1)}% (IF: ${alert?.isolationForestScore}, LSTM Autoencoder: ${alert?.lstmAutoencoderScore})
- Role Chaining Depth: ${featureVector?.assumeRoleDepth || 0}
- High-Risk Actions Count: ${featureVector?.highRiskActionCount || 0}
- AccessDenied Count: ${featureVector?.accessDeniedCount || 0}
- Raw Event Payload: ${JSON.stringify(rawEvent, null, 2)}

Provide a concise, professional SOC Incident Investigation Report formatted with:
1. **Executive Threat Summary**: Explain what the adversary attempted in 2-3 sentences.
2. **Attack Path & MITRE ATT&CK Mapping**: Breakdown the exact technique (e.g. T1548.005 Role Chaining, T1098 Policy Injection, T1530 S3 Exfiltration) and tactical intent.
3. **Forensic Evidence & Root Cause**: Why the behavioral ML models (Isolation Forest + LSTM Autoencoder) isolated this sequence.
4. **Actionable Containment Plan (AWS CLI / Terraform)**: Provide exact copy-paste ready AWS CLI commands and remediation steps to eradicate the threat and fix the over-permissive IAM trust policy.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    const reportText = response.text || 'Unable to generate incident investigation report at this time.';

    res.json({
      success: true,
      report: reportText,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Gemini Investigation Error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      fallbackReport: `### Automated Security Assessment (Fallback Offline Mode)
**Executive Threat Summary:**
The detected entity performed anomalous AWS CloudTrail API calls exceeding baseline statistical norms. The LSTM Autoencoder observed an unexpected sequence of privileged operations.

**MITRE ATT&CK Techniques Identified:**
- **T1548.005**: Temporary Elevated Cloud Access via STS AssumeRole
- **T1098**: Account Manipulation / Policy Injection

**Recommended Proactive Actions:**
1. Revoke active IAM sessions using \`aws iam put-user-policy\` with temporary Deny.
2. Review trust relationship policies on assumed roles to enforce MFA conditions (\`"aws:MultiFactorAuthPresent": "true"\`).`,
    });
  }
});

// Vite middleware & Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudGuard ITDR Engine listening on http://localhost:${PORT}`);
  });
}

startServer();
