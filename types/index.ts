export type ScenarioId = 1 | 2 | 3;
export type Mode = 'demo' | 'debug' | 'training';
export type TraceStatus = 'success' | 'warning' | 'failure' | 'skipped';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface TraceStep {
  name: string;
  status: TraceStatus;
  latencyMs: number;
  detail?: string;
  docCount?: number;
  tokens?: number;
  promptVersion?: string;
  errorCode?: string;
  errorDetail?: string;
}

export interface RetrievedDoc {
  name: string;
  excerpt: string;
  matchScore?: number;
}

export interface ScenarioData {
  id: ScenarioId;
  caseId: string;
  participantName: string;
  timestamp: string;
  customerMessage: string;
  intent: string;
  confidence: number;
  retrievedDocs: RetrievedDoc[];
  suggestedResponse: string;
  nextAction: string;
  whyExplanationFallback: string;
  trace: TraceStep[];
  failureDomainTags?: string[];
  knownIssuePattern?: string;
  promptVersion: string;
}
