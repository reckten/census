import { NextRequest, NextResponse } from 'next/server';
import { langfuse } from '@/lib/langfuse';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { traceId, feedback } = body;

  if (!traceId || !feedback) {
    return NextResponse.json({ ok: false, error: 'missing traceId or feedback' }, { status: 400 });
  }

  try {
    langfuse.score({
      traceId,
      name: 'associate-feedback',
      value: feedback === 'helpful' ? 1 : feedback === 'not-helpful' ? 0 : 0.5,
      comment: feedback,
    });
    await langfuse.flushAsync();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Langfuse score error:', err);
    // Return ok so client never surfaces observability errors
    return NextResponse.json({ ok: true });
  }
}
