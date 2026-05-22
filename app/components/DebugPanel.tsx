'use client';
import { useState, useEffect } from 'react';
import { ScenarioData, Mode, TraceStatus, TraceStep } from '@/types';

interface Props {
  scenario: ScenarioData;
  mode: Mode;
}

const TRAINING_NOTE =
  'When something goes wrong, this shows which step failed';

function StatusIcon({ status }: { status: TraceStatus }) {
  if (status === 'success') return <span className="text-green-400 font-bold">✓</span>;
  if (status === 'warning')  return <span className="text-amber-400 font-bold">⚠</span>;
  if (status === 'failure')  return <span className="text-red-400 font-bold">✗</span>;
  return <span className="text-slate-500">—</span>;
}

function latencyColor(ms: number, status: TraceStatus) {
  if (status === 'failure') return 'text-red-400';
  if (ms > 1000) return 'text-amber-400';
  if (ms > 400)  return 'text-slate-300';
  return 'text-slate-500';
}

function buildMockLog(scenario: ScenarioData): string {
  return JSON.stringify(
    {
      case_id: scenario.caseId,
      participant: scenario.participantName,
      timestamp: scenario.timestamp,
      intent: scenario.intent,
      confidence: scenario.confidence,
      pipeline: scenario.trace.map((s) => ({
        step: s.name,
        status: s.status,
        latency_ms: s.latencyMs,
        ...(s.detail       ? { detail: s.detail }             : {}),
        ...(s.errorCode    ? { error_code: s.errorCode }       : {}),
        ...(s.errorDetail  ? { error_detail: s.errorDetail }   : {}),
        ...(s.tokens       ? { tokens: s.tokens }              : {}),
        ...(s.promptVersion? { prompt_version: s.promptVersion}: {}),
      })),
      failure_domains: scenario.failureDomainTags ?? [],
      ...(scenario.knownIssuePattern ? { known_issue_pattern: scenario.knownIssuePattern } : {}),
    },
    null,
    2
  );
}

// ── Per-step rich detail rows, shown only in Debug mode ──────────────────────
function DebugStepDetail({ step, scenarioIntent, scenarioConfidence }: {
  step: TraceStep;
  scenarioIntent: string;
  scenarioConfidence: number;
}) {
  const rows: { label: string; value: string; highlight?: boolean }[] = [];

  const name = step.name.toLowerCase();

  if (name.includes('intent')) {
    rows.push({ label: 'classified_intent', value: scenarioIntent });
    rows.push({ label: 'raw_score',         value: (scenarioConfidence / 100).toFixed(4) });
    rows.push({ label: 'threshold',         value: '0.7000' });
    rows.push({ label: 'above_threshold',   value: String(scenarioConfidence >= 70), highlight: scenarioConfidence < 70 });
  }
  if (name.includes('retrieval') || name.includes('knowledge')) {
    rows.push({ label: 'docs_retrieved',    value: String(step.docCount ?? 1) });
    rows.push({ label: 'top_chunk_score',   value: step.detail?.includes('0.94') ? '0.9400' : step.detail?.includes('0.71') ? '0.7100' : '0.8900' });
    rows.push({ label: 'score_threshold',   value: '0.6500' });
    rows.push({ label: 'above_threshold',   value: step.status !== 'failure' ? 'true' : 'false' });
    if (step.docCount && step.docCount > 1) {
      rows.push({ label: 'partial_match',   value: 'true — multiple docs, ambiguous', highlight: true });
    }
  }
  if (name.includes('llm') || name.includes('generation')) {
    rows.push({ label: 'model',             value: 'anthropic/claude-haiku-4-5' });
    rows.push({ label: 'prompt_version',    value: step.promptVersion ?? 'unknown' });
    rows.push({ label: 'tokens_used',       value: String(step.tokens ?? '—') });
    rows.push({ label: 'latency_ms',        value: String(step.latencyMs) });
  }
  if (name.includes('salesforce') || name.includes('crm') || name.includes('tool call')) {
    rows.push({ label: 'tool_name',         value: 'salesforce_crm_write_endpoint' });
    rows.push({ label: 'request_summary',   value: 'PUT /participant/{id}/account' });
    rows.push({ label: 'response_status',   value: step.status === 'failure' ? 'TIMEOUT' : '200 OK', highlight: step.status === 'failure' });
    rows.push({ label: 'latency_ms',        value: String(step.latencyMs) });
    if (step.errorCode) {
      rows.push({ label: 'error_code',      value: step.errorCode, highlight: true });
    }
    if (step.errorDetail) {
      rows.push({ label: 'error_detail',    value: step.errorDetail, highlight: true });
    }
  }
  if (name.includes('fallback')) {
    rows.push({ label: 'threshold',         value: '0.7000' });
    rows.push({ label: 'confidence',        value: (scenarioConfidence / 100).toFixed(4) });
    rows.push({ label: 'triggered',         value: step.detail?.includes('Not triggered') ? 'false' : 'true', highlight: !step.detail?.includes('Not triggered') });
    if (step.detail) {
      rows.push({ label: 'reason',          value: step.detail });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 rounded bg-[var(--ascensus-ink-3)] border border-[var(--ascensus-border)] overflow-hidden">
      {rows.map((row, i) => (
        <div key={i} className={`flex gap-2 px-2.5 py-1 border-b border-[var(--ascensus-border)] last:border-0 font-mono text-xs ${row.highlight ? 'bg-red-950/30' : ''}`}>
          <span className="text-[var(--ascensus-muted)] shrink-0 w-36">{row.label}</span>
          <span className={row.highlight ? 'text-red-300' : 'text-[var(--ascensus-text)]'}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Azure DevOps Ticket Modal ─────────────────────────────────────────────────
function buildTicketContent(scenario: ScenarioData): string {
  const failedStep = scenario.trace.find((s) => s.status === 'failure' || s.status === 'warning');
  const failurePoint = failedStep
    ? `${failedStep.name} — ${failedStep.detail ?? failedStep.errorDetail ?? failedStep.status}`
    : 'No failure detected';

  const expected = (() => {
    if (scenario.failureDomainTags?.includes('TOOL_CALL_FAILED')) {
      return 'Salesforce CRM tool call should complete within 3000ms and return participant account data';
    }
    if (scenario.failureDomainTags?.includes('RETRIEVAL_AMBIGUOUS')) {
      return 'Knowledge retrieval should return a single high-confidence document (score ≥ 0.80)';
    }
    return 'Pipeline should complete successfully and return a high-confidence suggested response';
  })();

  const actual = (() => {
    if (scenario.failureDomainTags?.includes('TOOL_CALL_FAILED')) {
      return 'Salesforce CRM timed out after 3002ms — safe fallback triggered, online update not possible';
    }
    if (scenario.failureDomainTags?.includes('FALLBACK_TRIGGERED')) {
      return 'Fallback response was triggered due to tool failure or low confidence';
    }
    if (scenario.failureDomainTags?.includes('RETRIEVAL_AMBIGUOUS')) {
      return 'Two partial-match documents returned (scores 0.71, 0.63) — fallback clarification generated';
    }
    return 'System completed normally';
  })();

  const hasFallback = scenario.failureDomainTags?.includes('FALLBACK_TRIGGERED') ||
                      scenario.failureDomainTags?.includes('TOOL_CALL_FAILED');
  const lowConfOnly = !hasFallback && scenario.confidence < 70;
  const priority = hasFallback ? 'P2' : lowConfOnly ? 'P3' : 'P3';

  const failureDomain = scenario.failureDomainTags?.[0] ?? 'UNKNOWN';
  const frequencyLine = scenario.knownIssuePattern
    ? `FREQUENCY: ${scenario.knownIssuePattern}`
    : 'FREQUENCY: First occurrence — monitoring required';

  return `TITLE: ${failureDomain} — ${scenario.intent} — ${scenario.participantName}

REPRO STEPS:
  - Scenario: Scenario ${scenario.id}
  - Participant: ${scenario.participantName}, Case ID: ${scenario.caseId}
  - Intent classified: ${scenario.intent} (${scenario.confidence}%)
  - Failure point: ${failurePoint}

EXPECTED: ${expected}

ACTUAL: ${actual}

${frequencyLine}

LOGS: See Raw Log attached

SUGGESTED OWNER: Platform Engineering

PRIORITY: ${priority}`;
}

function AzureTicketModal({
  scenario,
  onClose,
}: {
  scenario: ScenarioData;
  onClose: () => void;
}) {
  const content = buildTicketContent(scenario);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--ascensus-ink-2)] border border-[var(--ascensus-border-strong)] rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--ascensus-border-strong)] flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-blue-400 bg-blue-900/30 border border-blue-700/50 px-2 py-0.5 rounded">AZURE DEVOPS</span>
              <h2 className="text-sm font-semibold text-[var(--ascensus-text)]">Create Work Item</h2>
            </div>
            <p className="text-xs text-[var(--ascensus-muted)] mt-1">
              Pre-filled from Scenario {scenario.id} — {scenario.caseId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ascensus-muted)] hover:text-[var(--ascensus-text)] transition-colors w-7 h-7 flex items-center justify-center text-lg ml-4 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Ticket body */}
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--ascensus-text)] bg-[var(--ascensus-ink-3)] border border-[var(--ascensus-border)] rounded p-4 leading-relaxed">
            {content}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--ascensus-border-strong)] flex items-center justify-between shrink-0 gap-3">
          <span className="text-xs text-[var(--ascensus-muted)]">
            This is a mock ticket — copy or export to Azure DevOps manually
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(content).catch(() => {});
              }}
              className="px-3 py-1.5 text-xs rounded border border-[var(--ascensus-border)] text-[var(--ascensus-muted)] hover:text-[var(--ascensus-text)] hover:border-[var(--ascensus-teal)] transition-colors"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded bg-blue-700/50 border border-blue-600/60 text-blue-200 hover:bg-blue-700/70 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DebugPanel({ scenario, mode }: Props) {
  const isDebug    = mode === 'debug';
  const isTraining = mode === 'training';

  const [logsOpen, setLogsOpen] = useState(isDebug);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  useEffect(() => {
    setLogsOpen(isDebug);
  }, [isDebug]);

  // Close modal when scenario changes
  useEffect(() => {
    setTicketModalOpen(false);
  }, [scenario.id]);

  const panelBg     = isDebug ? 'bg-[var(--ascensus-ink-2)]'  : 'bg-[var(--ascensus-ink)]';
  const headerBg    = isDebug ? 'bg-[var(--ascensus-panel)]'  : isTraining ? 'bg-[var(--ascensus-ink-2)]' : 'bg-[var(--ascensus-ink-2)]';
  const headerBorder= isDebug ? 'border-[var(--ascensus-border-strong)]' : isTraining ? 'border-[var(--ascensus-teal-border)]' : 'border-[var(--ascensus-border)]';
  const stepBg      = isDebug ? 'bg-[var(--ascensus-ink-2)]'  : 'bg-[var(--ascensus-ink)]';

  // Ticket button: grayed out for scenario 1 (happy path)
  const isHappyPath = scenario.id === 1;

  return (
    <div className={`flex flex-col min-h-0 ${panelBg}`}>
      {/* Panel header */}
      <div className={`px-4 py-2.5 border-b ${headerBorder} ${headerBg} flex flex-col gap-0.5 shrink-0`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isTraining ? 'text-[var(--ascensus-teal)]' : isDebug ? 'text-[var(--ascensus-teal)]' : 'text-[var(--ascensus-text)]'}`}>
            Debug / Trace
          </span>
          {isDebug && (
            <span className="text-[10px] text-amber-300 font-mono bg-amber-900/30 border border-amber-700/50 px-1.5 py-0.5 rounded font-semibold tracking-wider">
              ENGINEERING VIEW
            </span>
          )}
        </div>
        {isTraining && (
          <p className="text-[11px] italic text-[var(--ascensus-teal)] opacity-80 leading-snug">
            {TRAINING_NOTE}
          </p>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">

        {/* Known issue pattern — Scenario 3 only, Debug or Training mode only */}
        {scenario.knownIssuePattern && (isDebug || isTraining) && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded px-3 py-2.5 flex items-start gap-2">
            <span className="text-amber-400 font-bold text-base shrink-0 mt-0.5">⚠</span>
            <div>
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-0.5">
                Known Issue Pattern
              </div>
              <div className="text-xs text-amber-300/80">{scenario.knownIssuePattern}</div>
            </div>
          </div>
        )}

        {/* Failure domain tags */}
        {scenario.failureDomainTags && scenario.failureDomainTags.length > 0 && (
          <div>
            <div className="text-xs text-[var(--ascensus-muted)] uppercase tracking-wider mb-2 font-semibold">
              Failure Domains
            </div>
            <div className="flex flex-wrap gap-1.5">
              {scenario.failureDomainTags.map((tag) => (
                <span
                  key={tag}
                  className={`text-xs px-2 py-0.5 rounded font-mono border ${
                    tag === 'TOOL_CALL_FAILED' || tag === 'FALLBACK_TRIGGERED'
                      ? 'bg-red-900/30 border-red-700/50 text-red-400'
                      : 'bg-amber-900/30 border-amber-700/50 text-amber-400'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trace timeline */}
        <div>
          <div className="text-xs text-[var(--ascensus-muted)] uppercase tracking-wider mb-3 font-semibold">
            Trace Timeline
          </div>
          <div className="flex flex-col">
            {scenario.trace.map((step, i) => (
              <div
                key={i}
                className={`flex gap-3 pb-4 relative ${
                  i < scenario.trace.length - 1
                    ? 'before:absolute before:left-[7px] before:top-[18px] before:bottom-0 before:w-px before:bg-[var(--ascensus-border)]'
                    : ''
                }`}
              >
                {/* Status icon */}
                <div className={`w-4 h-4 flex items-center justify-center shrink-0 mt-0.5 z-10 text-sm ${stepBg}`}>
                  <StatusIcon status={step.status} />
                </div>

                {/* Step body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--ascensus-text)]">
                      {step.name}
                    </span>
                    <span className={`text-xs font-mono shrink-0 ${latencyColor(step.latencyMs, step.status)}`}>
                      {step.latencyMs}ms
                    </span>
                  </div>

                  {/* Basic detail (always shown) */}
                  {step.detail && (
                    <div className="text-xs text-[var(--ascensus-muted)] mt-0.5 font-mono leading-snug">
                      {step.detail}
                    </div>
                  )}

                  {/* Debug: expanded per-step data table */}
                  {isDebug && (
                    <DebugStepDetail
                      step={step}
                      scenarioIntent={scenario.intent}
                      scenarioConfidence={scenario.confidence}
                    />
                  )}

                  {/* Error detail always shown if present */}
                  {step.errorCode && !isDebug && (
                    <div className="text-xs text-red-400 font-mono mt-0.5">{step.errorCode}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raw log */}
        <div className={`border rounded overflow-hidden ${isDebug ? 'border-[var(--ascensus-border-strong)]' : 'border-[var(--ascensus-border)]'}`}>
          <button
            onClick={() => setLogsOpen(!logsOpen)}
            className={`w-full px-3 py-2 text-xs text-[var(--ascensus-muted)] flex items-center justify-between transition-colors ${
              isDebug ? 'bg-[var(--ascensus-panel)] hover:bg-[var(--ascensus-panel-2)]' : 'bg-[var(--ascensus-ink-2)] hover:bg-[var(--ascensus-panel)]'
            }`}
          >
            <span className="font-semibold uppercase tracking-wider">Raw Log</span>
            <span className="font-mono text-[var(--ascensus-muted)]">{logsOpen ? '▲' : '▼'}</span>
          </button>
          {logsOpen && (
            <pre className={`p-3 text-xs font-mono overflow-x-auto leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap break-all ${isDebug ? 'text-[var(--ascensus-text)] bg-[var(--ascensus-ink-3)]' : 'text-[var(--ascensus-muted)] bg-[var(--ascensus-ink-3)]'}`}>
              {buildMockLog(scenario)}
            </pre>
          )}
        </div>

        {/* Create Azure DevOps Ticket — Debug mode only */}
        {isDebug && (
          <div className="mt-auto pt-2">
            {isHappyPath ? (
              <div className="relative group">
                <button
                  disabled
                  className="w-full px-3 py-2.5 text-xs rounded border border-[var(--ascensus-border)] text-[var(--ascensus-muted)] bg-[var(--ascensus-ink-3)] opacity-50 cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  <span>⊘</span>
                  Create Azure DevOps Ticket
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[var(--ascensus-ink-3)] border border-[var(--ascensus-border)] rounded text-[10px] text-[var(--ascensus-muted)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-snug">
                  No failures detected — ticket not required
                </div>
              </div>
            ) : (
              <button
                onClick={() => setTicketModalOpen(true)}
                className="w-full px-3 py-2.5 text-xs rounded border border-blue-700/60 text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 hover:border-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>＋</span>
                Create Azure DevOps Ticket
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ticket modal */}
      {ticketModalOpen && (
        <AzureTicketModal scenario={scenario} onClose={() => setTicketModalOpen(false)} />
      )}
    </div>
  );
}
