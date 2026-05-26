import { NextRequest, NextResponse } from 'next/server';
import { langfuse } from '@/lib/langfuse';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    intent,
    confidence,
    docName,
    responsePreview,
    // Scenario fixture fields for mock pipeline spans
    scenario,
  } = body;

  const apiKey = process.env.OPENROUTER_API_KEY;

  // ── 1. Create a Langfuse trace for this scenario load ──────────────────────
  let traceId: string | null = null;
  let trace: ReturnType<typeof langfuse.trace> | null = null;

  try {
    trace = langfuse.trace({
      name: 'agent-assist-scenario',
      metadata: {
        scenario: scenario?.promptVersion ?? 'unknown',
        caseId: scenario?.caseId ?? 'unknown',
        participant: scenario?.participantName ?? 'unknown',
      },
    });
    traceId = trace.id;
  } catch {
    // Never let observability break the demo
  }

  // ── 2. Mock pipeline spans (fixture data) ──────────────────────────────────
  if (trace && scenario) {
    const traceArr: Array<{
      name: string;
      status: string;
      latencyMs: number;
      detail?: string;
      errorCode?: string;
    }> = scenario.trace ?? [];

    const findStep = (keyword: string) =>
      traceArr.find((s) => s.name.toLowerCase().includes(keyword.toLowerCase()));

    const intentStep   = findStep('intent');
    const retrievalStep = findStep('knowledge') ?? findStep('retrieval');
    const crmStep      = findStep('salesforce') ?? findStep('crm');
    const fallbackStep = findStep('fallback');

    const primaryDoc = scenario.retrievedDocs?.[0];
    const fallbackTriggered = !!fallbackStep && fallbackStep.status !== 'skipped';

    try {
      // span 1 — Intent Classification
      trace.span({
        name: 'intent-classification',
        input: { query: scenario.customerMessage },
        output: { intent, confidence },
        metadata: {
          status: intentStep?.status ?? 'success',
          latencyMs: intentStep?.latencyMs ?? 0,
        },
      });

      // span 2 — Knowledge Retrieval
      trace.span({
        name: 'knowledge-retrieval',
        input: { query: scenario.customerMessage, intent },
        output: {
          docName: primaryDoc?.name ?? docName,
          similarityScore: primaryDoc?.matchScore ?? 0,
          chunkCount: scenario.retrievedDocs?.length ?? 1,
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
          confidence,
          crmStatus: crmStep?.status ?? 'success',
        },
        output: {
          fallbackTriggered,
          reason: fallbackStep?.detail ?? 'not triggered — confidence above threshold',
        },
        metadata: { latencyMs: fallbackStep?.latencyMs ?? 0 },
      });
    } catch {
      // Never let observability break the demo
    }
  }

  // ── 3. Call OpenRouter wrapped in a generation span ────────────────────────
  const systemPrompt =
    'You are an AI explainability assistant for an internal retirement plan support tool called Agent Assist. Explain in 2-3 plain English sentences why the system generated this suggestion. Be specific. Write for a non-technical support associate, not an engineer.';
  const userPrompt = `Intent detected: ${intent}. Confidence: ${confidence}%. Retrieved document: ${docName}. Suggested response starts with: ${responsePreview}. Explain why this suggestion was generated.`;

  let generation: ReturnType<typeof langfuse.generation> | null = null;
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
    // Never let observability break the demo
  }

  if (!apiKey) {
    try { generation?.end({ output: '[no api key — fallback used]' }); } catch {}
    try { await langfuse.flushAsync(); } catch {}
    return NextResponse.json({ explanation: '', traceId });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ascensus-triage.vercel.app',
        'X-Title': 'Agent Assist Triage Console',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json();
    const explanation: string = data.choices?.[0]?.message?.content ?? '';

    // End generation span with output + token usage
    try {
      generation?.end({
        output: explanation,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
        },
      });
    } catch {}

    // Flush so events ship immediately (no batch delay)
    try { await langfuse.flushAsync(); } catch {}

    return NextResponse.json({ explanation, traceId });
  } catch (err) {
    console.error('OpenRouter explain error:', err);
    try { generation?.end({ output: '[openrouter error — fallback used]' }); } catch {}
    try { await langfuse.flushAsync(); } catch {}
    // Return empty so client silently falls back to fixture explanation
    return NextResponse.json({ explanation: '', traceId });
  }
}
