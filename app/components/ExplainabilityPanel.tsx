'use client';
import { useEffect, useRef, useState } from 'react';
import { ScenarioData, Mode } from '@/types';
import { langfuse } from '@/lib/langfuse';
import type { LangfuseTraceClient } from 'langfuse-core';

interface Props {
  scenario: ScenarioData;
  mode: Mode;
  onTraceReady?: (trace: LangfuseTraceClient) => void;
}

const TRAINING_NOTE =
  'Use this to explain AI behavior to new associates';

// Helper: look up a trace step by partial name match
function findStep(trace: ScenarioData['trace'], name: string) {
  return trace.find((s) =>
    s.name.toLowerCase().includes(name.toLowerCase())
  );
}

export default function ExplainabilityPanel({ scenario, mode, onTraceReady }: Props) {
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  // Persist the active Langfuse trace across renders without triggering re-renders
  const traceRef = useRef<LangfuseTraceClient | null>(null);

  const isDebug = mode === 'debug';
  const isTraining = mode === 'training';

  useEffect(() => {
    setExplanation('');
    setLoading(true);
    setSource('fallback');

    // ── 1. Create a new Langfuse trace for this scenario ─────────────────────
    let trace: LangfuseTraceClient | null = null;
    try {
      trace = langfuse.trace({
        name: 'agent-assist-scenario',
        metadata: {
          scenario: scenario.promptVersion,
          caseId: scenario.caseId,
          participant: scenario.participantName,
        },
      });
      traceRef.current = trace;
      // Notify parent so it can wire up feedback scoring
      onTraceReady?.(trace);
    } catch {
      // Never let observability break the UI
    }

    // ── 2. Log mock pipeline spans immediately (fixture data) ────────────────
    const primaryDoc = scenario.retrievedDocs[0];
    const intentStep = findStep(scenario.trace, 'intent');
    const retrievalStep = findStep(scenario.trace, 'knowledge') ?? findStep(scenario.trace, 'retrieval');
    const crmStep = findStep(scenario.trace, 'salesforce') ?? findStep(scenario.trace, 'crm');
    const fallbackStep = findStep(scenario.trace, 'fallback');

    const fallbackTriggered = !!fallbackStep && fallbackStep.status !== 'skipped';
    const fallbackReason = fallbackStep?.detail ?? undefined;

    try {
      if (trace) {
        // span 1 — Intent Classification
        trace.span({
          name: 'intent-classification',
          input: { query: scenario.customerMessage },
          output: { intent: scenario.intent, confidence: scenario.confidence },
          metadata: {
            status: intentStep?.status ?? 'success',
            latencyMs: intentStep?.latencyMs ?? 0,
          },
        });

        // span 2 — Knowledge Retrieval
        trace.span({
          name: 'knowledge-retrieval',
          input: { query: scenario.customerMessage, intent: scenario.intent },
          output: {
            docName: primaryDoc?.name ?? 'Unknown',
            similarityScore: primaryDoc?.matchScore ?? 0,
            chunkCount: scenario.retrievedDocs.length,
            aboveThreshold: (primaryDoc?.matchScore ?? 0) >= 0.80,
          },
          metadata: {
            status: retrievalStep?.status ?? 'success',
            latencyMs: retrievalStep?.latencyMs ?? 0,
          },
        });

        // span 3 — Salesforce CRM Tool Call
        const crmSuccess = !crmStep || crmStep.status === 'success';
        trace.span({
          name: 'salesforce-crm-tool-call',
          input: {
            tool: 'salesforce.participant.lookup',
            participantId: scenario.caseId,
          },
          output: crmSuccess
            ? { status: 'success', recordFound: true }
            : {
                status: 'failed',
                error: crmStep?.errorCode ?? crmStep?.detail ?? 'UNKNOWN_ERROR',
                latencyMs: crmStep?.latencyMs ?? 0,
              },
          metadata: {
            status: crmStep?.status ?? 'success',
            latencyMs: crmStep?.latencyMs ?? 0,
          },
        });

        // span 4 — Fallback Check
        trace.span({
          name: 'fallback-check',
          input: {
            confidence: scenario.confidence,
            crmStatus: crmStep?.status ?? 'success',
          },
          output: {
            fallbackTriggered,
            reason: fallbackReason ?? 'not triggered — confidence above threshold',
          },
          metadata: { latencyMs: fallbackStep?.latencyMs ?? 0 },
        });
      }
    } catch {
      // Never let observability break the UI
    }

    // ── 3. Wrap the OpenRouter /api/explain call in a generation span ────────
    const responsePreview = scenario.suggestedResponse.substring(0, 60);
    const systemPrompt =
      'You are an AI explainability assistant for an internal retirement plan support tool called Agent Assist. Explain in 2-3 plain English sentences why the system generated this suggestion. Be specific. Write for a non-technical support associate, not an engineer.';
    const userPrompt = `Intent detected: ${scenario.intent}. Confidence: ${scenario.confidence}%. Retrieved document: ${primaryDoc?.name ?? 'Unknown'}. Suggested response starts with: ${responsePreview}. Explain why this suggestion was generated.`;

    let generation: ReturnType<LangfuseTraceClient['generation']> | null = null;
    try {
      if (trace) {
        generation = trace.generation({
          name: 'why-this-suggestion',
          model: 'anthropic/claude-3-haiku',
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
      }
    } catch {
      // Never let observability break the UI
    }

    fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: scenario.intent,
        confidence: scenario.confidence,
        docName: primaryDoc?.name ?? 'Unknown',
        responsePreview,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const responseText: string = data.explanation ?? '';

        // End the generation span with output + token usage
        try {
          generation?.end({
            output: responseText,
            usage: {
              promptTokens: data.usage?.input_tokens,
              completionTokens: data.usage?.output_tokens,
            },
          });
        } catch {
          // Never let observability break the UI
        }

        if (responseText) {
          setExplanation(responseText);
          setSource('api');
        } else {
          setExplanation(scenario.whyExplanationFallback);
          setSource('fallback');
        }
      })
      .catch(() => {
        // End generation with an error note
        try {
          generation?.end({ output: '[fetch failed — fallback used]' });
        } catch {
          // Never let observability break the UI
        }
        setExplanation(scenario.whyExplanationFallback);
        setSource('fallback');
      })
      .finally(() => {
        setLoading(false);
        // ── 4. Flush immediately so events are sent without waiting for batch ──
        try {
          langfuse.flushAsync().catch(() => {});
        } catch {
          // Never let observability break the UI
        }
      });
  }, [scenario.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Confidence color thresholds: green ≥80, amber 60-79, red <60
  const confidenceColor =
    scenario.confidence >= 80
      ? 'text-green-400'
      : scenario.confidence >= 60
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div
      className={`border-r flex flex-col min-h-0 ${
        isDebug
          ? 'border-[var(--ascensus-border-strong)] bg-[var(--ascensus-ink-2)]'
          : 'border-[var(--ascensus-border)] bg-[var(--ascensus-ink)]'
      }`}
    >
      {/* Panel header */}
      <div
        className={`px-4 py-2.5 border-b flex flex-col gap-0.5 shrink-0 ${
          isDebug
            ? 'border-[var(--ascensus-border-strong)] bg-[var(--ascensus-panel)]'
            : isTraining
            ? 'border-[var(--ascensus-teal-border)] bg-[var(--ascensus-ink-2)]'
            : 'border-[var(--ascensus-border)] bg-[var(--ascensus-ink-2)]'
        }`}
      >
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            isTraining ? 'text-[var(--ascensus-teal)]' : 'text-[var(--ascensus-text)]'
          }`}
        >
          Explainability
        </span>
        {isTraining && (
          <p className="text-[11px] italic text-[var(--ascensus-teal)] opacity-80 leading-snug">
            {TRAINING_NOTE}
          </p>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Intent */}
        <div>
          <div className="text-xs text-[var(--ascensus-muted)] uppercase tracking-wider mb-2 font-semibold">
            Intent Detected
          </div>
          <div
            className={`rounded border p-3 ${
              isDebug
                ? 'bg-[var(--ascensus-ink-2)] border-[var(--ascensus-teal-border)]'
                : 'bg-[var(--ascensus-panel)] border-[var(--ascensus-border)]'
            }`}
          >
            <div className="font-mono text-sm text-[var(--ascensus-teal)] break-all">
              {scenario.intent}
            </div>
            <div className={`text-xs mt-1.5 font-medium ${confidenceColor}`}>
              Confidence: {scenario.confidence}%
              {scenario.confidence < 70 && (
                <span className="text-[var(--ascensus-muted)] font-normal ml-1">
                  — below 70% threshold
                </span>
              )}
            </div>
            {/* Debug: show raw score value */}
            {isDebug && (
              <div className="mt-1.5 font-mono text-xs text-[var(--ascensus-muted)]">
                raw_score: {(scenario.confidence / 100).toFixed(4)} · threshold: 0.7000
              </div>
            )}
          </div>
        </div>

        {/* Retrieved docs */}
        <div>
          <div className="text-xs text-[var(--ascensus-muted)] uppercase tracking-wider mb-2 font-semibold">
            Retrieved Guidance
          </div>
          <div className="flex flex-col gap-2">
            {scenario.retrievedDocs.map((doc, i) => (
              <div
                key={i}
                className={`rounded border p-3 ${
                  doc.matchScore && doc.matchScore >= 0.8
                    ? 'bg-[var(--ascensus-panel-2)] border-[var(--ascensus-teal-border)]'
                    : 'bg-amber-900/10 border-amber-900/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[var(--ascensus-text)] leading-snug">
                    {doc.name}
                  </span>
                  {doc.matchScore !== undefined && (
                    <span
                      className={`text-xs font-mono shrink-0 ${
                        doc.matchScore >= 0.8
                          ? 'text-green-400'
                          : doc.matchScore >= 0.6
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {(doc.matchScore * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--ascensus-muted)] leading-relaxed">
                  {doc.excerpt}
                </p>
                {/* Debug: chunk/threshold detail */}
                {isDebug && doc.matchScore !== undefined && (
                  <div className="mt-2 pt-2 border-t border-[var(--ascensus-border)] font-mono text-xs text-[var(--ascensus-muted)] space-y-0.5">
                    <div>chunk_score: {doc.matchScore.toFixed(4)} · threshold: 0.6500 · {doc.matchScore >= 0.65 ? <span className="text-green-600">above</span> : <span className="text-red-500">below</span>}</div>
                    <div>chunks_retrieved: {scenario.retrievedDocs.length}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Why this suggestion */}
        <div>
          <div className="text-xs text-[var(--ascensus-muted)] uppercase tracking-wider mb-2 font-semibold flex items-center gap-2 flex-wrap">
            Why This Suggestion
            {loading && (
              <span className="text-xs text-[var(--ascensus-teal)] font-normal normal-case flex items-center gap-1">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-[var(--ascensus-teal)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1 h-1 bg-[var(--ascensus-teal)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1 h-1 bg-[var(--ascensus-teal)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
                Analyzing reasoning...
              </span>
            )}
          </div>
          <div
            className={`rounded border p-3 ${
              isDebug
                ? 'bg-[var(--ascensus-ink-2)] border-[var(--ascensus-border-strong)]'
                : 'bg-[var(--ascensus-panel)] border-[var(--ascensus-border)]'
            }`}
          >
            {loading ? (
              <p className="text-xs text-[var(--ascensus-muted)] italic">Analyzing reasoning...</p>
            ) : (
              <p className="text-xs text-[var(--ascensus-text)] leading-relaxed">
                {explanation || scenario.whyExplanationFallback}
              </p>
            )}
          </div>
          {isDebug && !loading && (
            <div className="mt-1.5 text-xs text-[var(--ascensus-muted)] font-mono">
              Source: {source === 'api' ? 'OpenRouter API (live)' : 'Fixture fallback'}
            </div>
          )}
        </div>

        {/* Prompt version footer */}
        <div className="mt-auto pt-3 border-t border-[var(--ascensus-border)]">
          <span className="text-xs text-[var(--ascensus-muted)] font-mono">
            {scenario.promptVersion}
          </span>
        </div>
      </div>
    </div>
  );
}
