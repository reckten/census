'use client';
import { useState, useEffect } from 'react';
import { ScenarioData, Mode, TraceStatus, TraceStep } from '@/types';

interface Props {
  scenario: ScenarioData;
  mode: Mode;
}

const TRAINING_NOTE =
  'This is the pipeline — when something goes wrong, this tells you which step failed';

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
  if (name.includes('crm') || name.includes('tool')) {
    rows.push({ label: 'tool_name',         value: 'crm_write_endpoint' });
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

export default function DebugPanel({ scenario, mode }: Props) {
  const isDebug    = mode === 'debug';
  const isTraining = mode === 'training';

  const [logsOpen, setLogsOpen] = useState(isDebug);

  useEffect(() => {
    setLogsOpen(isDebug);
  }, [isDebug]);

  const panelBg     = isDebug ? 'bg-[var(--ascensus-ink-2)]'  : 'bg-[var(--ascensus-ink)]';
  const headerBg    = isDebug ? 'bg-[var(--ascensus-panel)]'  : isTraining ? 'bg-[var(--ascensus-ink-2)]' : 'bg-[var(--ascensus-ink-2)]';
  const headerBorder= isDebug ? 'border-[var(--ascensus-border-strong)]' : isTraining ? 'border-[var(--ascensus-teal-border)]' : 'border-[var(--ascensus-border)]';
  const stepBg      = isDebug ? 'bg-[var(--ascensus-ink-2)]'  : 'bg-[var(--ascensus-ink)]';

  return (
    <div className={`flex flex-col min-h-0 ${panelBg}`}>
      {/* Panel header */}
      <div className={`px-4 py-2.5 border-b ${headerBorder} ${headerBg} flex flex-col gap-0.5 shrink-0`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isTraining ? 'text-[var(--ascensus-teal)]' : isDebug ? 'text-[var(--ascensus-teal)]' : 'text-[var(--ascensus-text)]'}`}>
            Debug / Trace
          </span>
          {isDebug && (
            <span className="text-[10px] text-[var(--ascensus-teal)] font-mono bg-[var(--ascensus-teal-soft)] border border-[var(--ascensus-teal-border)] px-1.5 py-0.5 rounded">
              PIPELINE VIEW
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

        {/* Known issue pattern — Scenario 3 only */}
          {scenario.knownIssuePattern && (
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
                    <span className={`text-xs font-semibold ${isDebug ? 'text-[var(--ascensus-text)]' : 'text-[var(--ascensus-text)]'}`}>
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
      </div>
    </div>
  );
}
