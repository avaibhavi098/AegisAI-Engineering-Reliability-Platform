import { GoogleGenAI, Type } from '@google/genai';
import { AIAnalysisResult } from '../src/types/index.js';

let geminiClient: GoogleGenAI | null = null;

export function setMockGeminiClient(mock: any): void {
  geminiClient = mock;
}

export function resetGeminiClient(): void {
  geminiClient = null;
}

export function getGeminiClientInstance(): GoogleGenAI {
  return getGeminiClient();
}

function getGeminiClient(): GoogleGenAI {
  if (geminiClient) {
    return geminiClient;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please ensure your Gemini API key is set in AI Studio Settings > Secrets.');
  }
  geminiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return geminiClient;
}

// Timeout wrapper helper
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 30000, operation = 'Gemini AI'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${operation} analysis timed out after ${timeoutMs / 1000}s. Please verify connection and try again.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

// Check if an error from Gemini is temporary and safe to retry or failover
export function isRetryableGeminiError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  const status = err?.status || err?.statusCode || err?.response?.status;
  const msg = (err instanceof Error ? err.message : String(error)).toLowerCase();

  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 504 ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('service unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('network error') ||
    msg.includes('timed out') ||
    msg.includes('failed to fetch')
  );
}

// Resilient Gemini model caller with automatic high-demand failover and backoff
async function callGeminiWithFailover(
  operationName: string,
  preferredModel: string,
  userPrompt: string,
  systemInstruction: string,
  schema: any,
  temperature = 0.15
): Promise<{ text: string; modelUsed: string }> {
  // Normalize deprecated or invalid models
  let primary = preferredModel;
  if (!primary || primary.includes('2.5') || primary.includes('2.0') || primary.includes('1.5')) {
    primary = 'gemini-3.8-flash';
  }

  // Model failover chain:
  // If primary is 3.8-flash, fallback is 3.6-flash (which absorbs high-demand spikes smoothly).
  const fallbackModel = primary === 'gemini-3.6-flash' ? 'gemini-3.8-flash' : 'gemini-3.6-flash';
  const modelsToTry = process.env.NODE_ENV === 'test' ? [primary] : [primary, fallbackModel];

  const client = getGeminiClient();
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    let attempt = 0;
    const maxRetries = process.env.NODE_ENV === 'test' ? 0 : 2;

    while (attempt <= maxRetries) {
      try {
        const geminiCall = client.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature,
          },
        });

        const response = await withTimeout(geminiCall, 35000, `${operationName} (${model})`);
        const text = response.text?.trim() || '';
        if (text) {
          return { text, modelUsed: model };
        }
        throw new Error(`Empty response returned by ${model}`);
      } catch (err: unknown) {
        attempt++;
        lastError = err;
        const isRetryable = isRetryableGeminiError(err);
        const errMsg = err instanceof Error ? err.message : String(err);

        // If this model is experiencing high demand (503 / UNAVAILABLE), immediately switch to next model
        const isHighDemand =
          (err as any)?.status === 503 ||
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('unavailable');

        if (isHighDemand && model === primary) {
          // Immediately try the fallback model without delay
          break;
        }

        if (attempt > maxRetries || !isRetryable) {
          break;
        }

        // Brief exponential backoff
        const delay = process.env.NODE_ENV === 'test' ? 5 : Math.min(800 * Math.pow(1.5, attempt - 1) + Math.random() * 200, 2500);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If models could not complete the request
  const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
  const rawStatus = (lastError as any)?.status || (lastError as any)?.statusCode;
  const is429 = rawStatus === 429 || errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted') || errMsg.toLowerCase().includes('rate limit');
  const isTimeout = rawStatus === 504 || errMsg.toLowerCase().includes('timed out') || errMsg.toLowerCase().includes('timeout');

  if (is429) {
    const quotaError = new Error('Gemini AI rate limit or quota exceeded. Please retry in a few moments.');
    (quotaError as any).status = 429;
    (quotaError as any).isRateLimit = true;
    (quotaError as any).originalError = errMsg;
    throw quotaError;
  }

  if (isTimeout) {
    const timeoutError = new Error('Gemini AI analysis timed out. Please retry.');
    (timeoutError as any).status = 504;
    (timeoutError as any).isTimeout = true;
    (timeoutError as any).originalError = errMsg;
    throw timeoutError;
  }

  if (isRetryableGeminiError(lastError)) {
    const highDemandError = new Error(
      `Gemini AI is currently experiencing high demand. Automatic failover was attempted. Please retry in a few seconds.`
    );
    (highDemandError as any).status = 503;
    (highDemandError as any).isHighDemand = true;
    (highDemandError as any).originalError = errMsg;
    throw highDemandError;
  }
  throw lastError || new Error(`${operationName}: Failed across available Gemini models.`);
}

// Clean and sanitize string inputs
function sanitizeText(text: unknown, maxLen = 10000): string {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, maxLen);
}

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    incidentSummary: {
      type: Type.STRING,
      description: 'Clear, concise 2-3 sentence overview of the incident or anomaly, symptoms, and impact on services.',
    },
    probableRootCause: {
      type: Type.STRING,
      description: 'The most probable root cause identified from the stack traces, logs, metrics, and failure topology.',
    },
    possibleAlternativeCauses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of 2-4 plausible secondary or alternative causes that should also be investigated.',
    },
    recommendedTroubleshootingSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Step-by-step actionable procedures for engineers to diagnose, verify, and resolve the system state.',
    },
    riskFactors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Critical operational and business risk factors, cascading failure potentials, or blast radius concerns.',
    },
    severityAssessment: {
      type: Type.STRING,
      description: 'Technical assessment of the severity level (e.g. CRITICAL/HIGH/MEDIUM/LOW) with clear rationale.',
    },
    confidenceScore: {
      type: Type.INTEGER,
      description: 'Confidence percentage strictly from 0 to 100 based only on the strength, consistency, and specificity of the provided error logs, stack traces, and telemetry signals. Must not be a generic or default value.',
    },
    preventionSuggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Actionable long-term architectural, configuration, and monitoring improvements to prevent recurrence.',
    },
    runbookCommands: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Practical bash, kubectl, psql, redis-cli, or curl commands for immediate mitigation and telemetry gathering.',
    },
  },
  required: [
    'incidentSummary',
    'probableRootCause',
    'possibleAlternativeCauses',
    'recommendedTroubleshootingSteps',
    'riskFactors',
    'severityAssessment',
    'confidenceScore',
    'preventionSuggestions',
  ],
};

export interface IncidentAnalysisInput {
  incidentId?: string;
  title: string;
  description?: string;
  serviceName: string;
  severity?: string;
  status?: string;
  errorLogs?: string;
  modelName?: string;
  performanceMetrics?: {
    latencyMs?: number;
    errorRate?: number;
    uptimePercent?: number;
    requestRateRps?: number;
    systemAvailability?: number;
    errorBudgetBurnRate?: number;
  };
  recentIncidents?: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    serviceName: string;
  }>;
}

export async function analyzeIncidentWithAI(params: IncidentAnalysisInput): Promise<AIAnalysisResult> {
  // 1. Validate inputs
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid input: params must be an object');
  }
  const title = sanitizeText(params.title, 500);
  if (!title) {
    throw new Error('Invalid input: Incident title is required for AI analysis');
  }
  const serviceName = sanitizeText(params.serviceName, 200) || 'Unknown Service';
  const description = sanitizeText(params.description, 4000) || 'No detailed incident description provided.';
  const severity = sanitizeText(params.severity, 50) || 'HIGH';
  const status = sanitizeText(params.status, 50) || 'INVESTIGATING';
  const errorLogs = sanitizeText(params.errorLogs, 25000) || 'No explicit stack traces provided. Rely on telemetry and symptom descriptions.';
  const modelToUse = sanitizeText(params.modelName, 100) || 'gemini-3.8-flash';

  const metricsInfo = params.performanceMetrics
    ? `- Latency: ${params.performanceMetrics.latencyMs ?? 'N/A'} ms\n- Error Rate: ${params.performanceMetrics.errorRate != null ? (params.performanceMetrics.errorRate * 100).toFixed(2) + '%' : 'N/A'}\n- Service Uptime: ${params.performanceMetrics.uptimePercent ?? 'N/A'}%\n- Request Rate: ${params.performanceMetrics.requestRateRps ?? 'N/A'} RPS\n- System Availability: ${params.performanceMetrics.systemAvailability ?? 'N/A'}%\n- Error Budget Burn Rate: ${params.performanceMetrics.errorBudgetBurnRate ?? 'N/A'}x`
    : 'Standard production thresholds active.';

  const recentIncidentsInfo = params.recentIncidents && params.recentIncidents.length > 0
    ? params.recentIncidents.slice(0, 5).map(inc => `- [${inc.id}] (${inc.severity} - ${inc.status}) in ${inc.serviceName}: ${inc.title}`).join('\n')
    : 'No correlated recent incidents recorded in this cluster window.';

  // 2. Build structured prompt
  const systemInstruction = `You are a Principal Site Reliability Engineer (SRE) and Incident Commander for a mission-critical cloud platform.
Your responsibility is to analyze production technical incidents using provided logs, telemetry metrics, and incident history.
Generate a structured, evidence-based technical root-cause assessment and actionable runbook remediation.

EVIDENCE-BASED CONFIDENCE SCORING RULES:
1. You MUST evaluate and return an integer confidenceScore between 0 and 100 based ONLY on the strength, consistency, and specificity of the available evidence provided (logs, stack traces, metrics, description).
2. High confidence (80-100): Direct, unambiguous error logs, precise stack traces, or clear telemetry signatures that directly prove the root cause mechanism.
3. Moderate confidence (50-79): Indirect evidence, circumstantial indicators, or multiple plausible competing failure modes that require reasonable inference.
4. Low confidence (0-49): Sparse, contradictory, generic, or inconclusive logs/telemetry where significant speculation is required.
5. NEVER fabricate or default the confidence score. It must strictly reflect the empirical strength of the provided data.`;

  const userPrompt = `Analyze this technical production incident and return a comprehensive structured diagnosis.

=== INCIDENT OVERVIEW ===
- Incident ID: ${params.incidentId || 'ADHOC-INCIDENT'}
- Title: ${title}
- Affected Service: ${serviceName}
- Declared Severity: ${severity}
- Current Status: ${status}
- Description: ${description}

=== AVAILABLE PERFORMANCE METRICS ===
${metricsInfo}

=== RECENT INCIDENT INFORMATION FOR CORRELATION ===
${recentIncidentsInfo}

=== APPLICATION & SYSTEM LOGS / TRACES ===
\`\`\`
${errorLogs}
\`\`\`

Generate a thorough, precise SRE diagnostic report following the requested schema. Ensure the confidenceScore is calibrated solely against the empirical evidence presented above.`;

  // 3. Call Gemini with automatic high-demand failover and backoff
  const { text: responseText, modelUsed: actualModelUsed } = await callGeminiWithFailover(
    'Gemini Incident Analysis',
    modelToUse,
    userPrompt,
    systemInstruction,
    analysisResponseSchema,
    0.15
  );

  if (!responseText) {
    throw new Error('Gemini AI returned an empty response.');
  }

  let parsed: any;
  try {
    const cleaned = responseText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error(`Failed to parse structured JSON from Gemini AI response: ${(parseErr as Error).message}`);
  }

  // Validate that confidenceScore is a valid number between 0 and 100 based on evidence
  if (
    typeof parsed.confidenceScore !== 'number' ||
    Number.isNaN(parsed.confidenceScore) ||
    parsed.confidenceScore < 0 ||
    parsed.confidenceScore > 100
  ) {
    throw new Error(
      `Invalid AI confidence score returned by Gemini: ${parsed.confidenceScore}. Must be a valid number between 0 and 100.`
    );
  }
  const confidenceScore = Math.round(parsed.confidenceScore);

  // Validate core AI analysis fields
  if (!parsed.incidentSummary || typeof parsed.incidentSummary !== 'string') {
    throw new Error('Gemini AI response missing required field: incidentSummary');
  }
  if (!parsed.probableRootCause || typeof parsed.probableRootCause !== 'string') {
    throw new Error('Gemini AI response missing required field: probableRootCause');
  }
  if (!parsed.severityAssessment || typeof parsed.severityAssessment !== 'string') {
    throw new Error('Gemini AI response missing required field: severityAssessment');
  }

  const possibleAlternativeCauses = Array.isArray(parsed.possibleAlternativeCauses)
    ? parsed.possibleAlternativeCauses.filter((c: unknown) => typeof c === 'string' && (c as string).trim())
    : [];
  const recommendedTroubleshootingSteps = Array.isArray(parsed.recommendedTroubleshootingSteps)
    ? parsed.recommendedTroubleshootingSteps.filter((s: unknown) => typeof s === 'string' && (s as string).trim())
    : [];
  const riskFactors = Array.isArray(parsed.riskFactors)
    ? parsed.riskFactors.filter((r: unknown) => typeof r === 'string' && (r as string).trim())
    : [];
  const preventionSuggestions = Array.isArray(parsed.preventionSuggestions)
    ? parsed.preventionSuggestions.filter((p: unknown) => typeof p === 'string' && (p as string).trim())
    : [];
  const runbookCommands = Array.isArray(parsed.runbookCommands)
    ? parsed.runbookCommands.filter((rc: unknown) => typeof rc === 'string' && (rc as string).trim())
    : [];

  const result: AIAnalysisResult = {
    incidentSummary: parsed.incidentSummary.trim(),
    probableRootCause: parsed.probableRootCause.trim(),
    possibleAlternativeCauses,
    recommendedTroubleshootingSteps,
    riskFactors,
    severityAssessment: parsed.severityAssessment.trim(),
    confidenceScore,
    preventionSuggestions,
    runbookCommands,

    // Backward compatibility aliases
    rootCauseSummary: parsed.probableRootCause.trim(),
    blastRadius: riskFactors.length > 0 ? riskFactors[0] : `Affected service: ${serviceName}`,
    probableCauseChain: [
      `Primary trigger: ${parsed.probableRootCause.trim()}`,
      ...possibleAlternativeCauses.slice(0, 2),
    ],
    impactedServices: [serviceName],
    suggestedFix: recommendedTroubleshootingSteps.length > 0 ? recommendedTroubleshootingSteps[0] : '',
    mitigationSteps: recommendedTroubleshootingSteps,
    preventionRecommendations: preventionSuggestions,

    analyzedAt: new Date().toISOString(),
    modelUsed: actualModelUsed,
    isAiGenerated: true,
  };

  return result;
}

export interface LogAnalysisInput {
  serviceName?: string;
  rawLogs?: string;
  logs?: string[];
  modelName?: string;
  performanceMetrics?: {
    latencyMs?: number;
    errorRate?: number;
  };
}

export async function analyzeLogsWithAI(params: LogAnalysisInput): Promise<AIAnalysisResult> {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid input: params must be an object');
  }

  const serviceName = sanitizeText(params.serviceName, 200) || 'Target Service';
  const modelToUse = sanitizeText(params.modelName, 100) || 'gemini-3.8-flash';

  let logContent = '';
  if (typeof params.rawLogs === 'string' && params.rawLogs.trim().length > 0) {
    logContent = sanitizeText(params.rawLogs, 30000);
  } else if (Array.isArray(params.logs) && params.logs.length > 0) {
    logContent = sanitizeText(params.logs.slice(0, 80).join('\n'), 30000);
  }

  if (!logContent) {
    throw new Error('No log content provided. Please provide log lines or raw stack traces for AI analysis.');
  }

  const metricsInfo = params.performanceMetrics
    ? `- Current Latency: ${params.performanceMetrics.latencyMs ?? 'N/A'} ms\n- Error Rate: ${params.performanceMetrics.errorRate != null ? (params.performanceMetrics.errorRate * 100).toFixed(2) + '%' : 'N/A'}`
    : 'Telemetry within observed service operational limits.';

  const systemInstruction = `You are an expert Staff Site Reliability Engineer and log parsing specialist.
Analyze application, infrastructure, database, and gateway log streams.
Detect subtle runtime failures, stack trace anomalies, concurrency deadlocks, memory leaks, and socket exhaustion.
Return a structured analysis adhering to the provided JSON schema.

EVIDENCE-BASED CONFIDENCE SCORING RULES:
1. You MUST compute and return an integer confidenceScore from 0 to 100 based solely on the strength, consistency, and specificity of the provided log messages and stack traces.
2. High confidence (80-100): Explicit stack traces, fatal exceptions, or repeated concrete error signatures that directly demonstrate the failure mode.
3. Moderate confidence (50-79): Indirect error clues, intermittent warning patterns, or multiple possible root causes.
4. Low confidence (0-49): Sparse, generic, inconclusive, or noisy log traces requiring speculative interpretation.
5. NEVER fabricate or default the confidence score. It must strictly reflect the empirical strength of the provided logs.`;

  const userPrompt = `Analyze the following application log stream for service "${serviceName}" and diagnose any anomalies or failures:

=== SERVICE CONTEXT & TELEMETRY ===
- Target Service: ${serviceName}
${metricsInfo}

=== LOG STREAM / STACK TRACES ===
\`\`\`
${logContent}
\`\`\`

Diagnose the root cause, alternative explanations, troubleshooting steps, risks, severity, confidence, prevention suggestions, and mitigation commands. Ensure the confidenceScore reflects strictly the empirical strength of the logs.`;

  const { text: responseText, modelUsed: actualModelUsed } = await callGeminiWithFailover(
    'Gemini Log Analysis',
    modelToUse,
    userPrompt,
    systemInstruction,
    analysisResponseSchema,
    0.15
  );

  if (!responseText) {
    throw new Error('Gemini AI returned an empty response.');
  }

  let parsed: any;
  try {
    const cleaned = responseText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error(`Failed to parse structured JSON from Gemini AI response: ${(parseErr as Error).message}`);
  }

  // Validate that confidenceScore is a valid number between 0 and 100
  if (
    typeof parsed.confidenceScore !== 'number' ||
    Number.isNaN(parsed.confidenceScore) ||
    parsed.confidenceScore < 0 ||
    parsed.confidenceScore > 100
  ) {
    throw new Error(
      `Invalid AI confidence score returned by Gemini for log analysis: ${parsed.confidenceScore}. Must be a valid number between 0 and 100.`
    );
  }
  const confidenceScore = Math.round(parsed.confidenceScore);

  // Validate core AI analysis fields
  if (!parsed.incidentSummary || typeof parsed.incidentSummary !== 'string') {
    throw new Error('Gemini AI response missing required field: incidentSummary');
  }
  if (!parsed.probableRootCause || typeof parsed.probableRootCause !== 'string') {
    throw new Error('Gemini AI response missing required field: probableRootCause');
  }
  if (!parsed.severityAssessment || typeof parsed.severityAssessment !== 'string') {
    throw new Error('Gemini AI response missing required field: severityAssessment');
  }

  const possibleAlternativeCauses = Array.isArray(parsed.possibleAlternativeCauses)
    ? parsed.possibleAlternativeCauses.filter((c: unknown) => typeof c === 'string' && (c as string).trim())
    : [];
  const recommendedTroubleshootingSteps = Array.isArray(parsed.recommendedTroubleshootingSteps)
    ? parsed.recommendedTroubleshootingSteps.filter((s: unknown) => typeof s === 'string' && (s as string).trim())
    : [];
  const riskFactors = Array.isArray(parsed.riskFactors)
    ? parsed.riskFactors.filter((r: unknown) => typeof r === 'string' && (r as string).trim())
    : [];
  const preventionSuggestions = Array.isArray(parsed.preventionSuggestions)
    ? parsed.preventionSuggestions.filter((p: unknown) => typeof p === 'string' && (p as string).trim())
    : [];
  const runbookCommands = Array.isArray(parsed.runbookCommands)
    ? parsed.runbookCommands.filter((rc: unknown) => typeof rc === 'string' && (rc as string).trim())
    : [];

  const result: AIAnalysisResult = {
    incidentSummary: parsed.incidentSummary.trim(),
    probableRootCause: parsed.probableRootCause.trim(),
    possibleAlternativeCauses,
    recommendedTroubleshootingSteps,
    riskFactors,
    severityAssessment: parsed.severityAssessment.trim(),
    confidenceScore,
    preventionSuggestions,
    runbookCommands,

    rootCauseSummary: parsed.probableRootCause.trim(),
    blastRadius: riskFactors.length > 0 ? riskFactors[0] : `Affected operations on ${serviceName}`,
    probableCauseChain: [
      `Trigger: ${parsed.probableRootCause.trim()}`,
      ...possibleAlternativeCauses.slice(0, 2),
    ],
    impactedServices: [serviceName],
    suggestedFix: recommendedTroubleshootingSteps.length > 0 ? recommendedTroubleshootingSteps[0] : '',
    mitigationSteps: recommendedTroubleshootingSteps,
    preventionRecommendations: preventionSuggestions,

    analyzedAt: new Date().toISOString(),
    modelUsed: actualModelUsed,
    isAiGenerated: true,
  };

  return result;
}
