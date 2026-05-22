import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { intent, confidence, docName, responsePreview } = body;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 500 });
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
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          {
            role: 'system',
            content:
              'You are an AI system explainability assistant for an internal retirement plan support tool. Explain in 2-3 plain English sentences why the system generated this suggestion. Be specific about the intent detected, the document retrieved, and any confidence signals. Write for a non-technical support associate. Keep it concise and clear.',
          },
          {
            role: 'user',
            content: `Intent: ${intent}. Confidence: ${confidence}%. Retrieved document: ${docName}. Suggested response preview: "${responsePreview}". Explain why this suggestion was generated.`,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error('OpenRouter explain error:', err);
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
