'use client';
import { ScenarioData, Mode } from '@/types';

interface Props {
  scenario: ScenarioData;
  mode: Mode;
  onFeedback: (type: 'helpful' | 'not-helpful' | 'escalate') => void;
  feedbackState?: string;
}

const TRAINING_NOTE =
  'Confidence is the model’s self-rated certainty, not a guarantee of accuracy — treat it as a calibration signal, not a verdict';

// ── Confidence helpers (thresholds: green ≥80, amber 60-79, red <60) ─────────
function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

// In Demo mode: confidence badge is large, prominent, first-read focal point
function DemoConfidenceBadge({ score }: { score: number }) {
  const level = confidenceLevel(score);
  const cfg = {
    high:   { dot: 'bg-green-400',  ring: 'ring-green-600/40',  text: 'text-green-300',  border: 'border-green-700/50',  bg: 'bg-green-900/25',  label: 'High Confidence',   sub: 'Response ready to send' },
    medium: { dot: 'bg-amber-400',  ring: 'ring-amber-600/40',  text: 'text-amber-300',  border: 'border-amber-700/50',  bg: 'bg-amber-900/25',  label: 'Review Required',    sub: 'Verify before sending' },
    low:    { dot: 'bg-red-400',    ring: 'ring-red-600/40',    text: 'text-red-300',    border: 'border-red-700/50',    bg: 'bg-red-900/25',    label: 'Escalate',           sub: 'Do not send without review' },
  }[level];

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-lg px-5 py-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full ${cfg.dot} ring-4 ${cfg.ring} shrink-0`}></div>
        <div>
          <div className={`text-lg font-bold ${cfg.text} leading-none tracking-tight`}>
            {cfg.label}
          </div>
          <div className={`text-2xl font-extrabold ${cfg.text} leading-none mt-1`}>
            {score}%
          </div>
          <div className="text-xs text-slate-400 mt-1">{cfg.sub}</div>
        </div>
      </div>
    </div>
  );
}

// In Debug / Training: compact badge
function CompactConfidenceBadge({ score }: { score: number }) {
  const level = confidenceLevel(score);
  const cfg = {
    high:   { dot: 'bg-green-400',  text: 'text-green-400',  border: 'border-green-700/60',  bg: 'bg-green-900/30',  label: 'High confidence' },
    medium: { dot: 'bg-amber-400',  text: 'text-amber-400',  border: 'border-amber-700/60',  bg: 'bg-amber-900/30',  label: 'Low confidence' },
    low:    { dot: 'bg-red-400',    text: 'text-red-400',    border: 'border-red-700/60',    bg: 'bg-red-900/30',    label: 'Very low confidence' },
  }[level];

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded px-3 py-1.5 flex items-center gap-2`}>
      <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`}></div>
      <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}: {score}%</span>
    </div>
  );
}

export default function AssistPanel({ scenario, mode, onFeedback, feedbackState }: Props) {
  const isDemo = mode === 'demo';
  const isDebug = mode === 'debug';
  const isTraining = mode === 'training';

  const hasFailure = scenario.failureDomainTags && scenario.failureDomainTags.length > 0;

  // Fallback = confidence below threshold OR explicit fallback tag (e.g. tool failure).
  // Used to flag the response as auto-generated guardrail output, not a normal recommendation.
  const isFallback =
    scenario.confidence < 70 ||
    (scenario.failureDomainTags?.includes('FALLBACK_TRIGGERED') ?? false);
  const fallbackReason =
    scenario.failureDomainTags?.includes('FALLBACK_TRIGGERED')
      ? 'Tool call failed — safe clarifying response generated'
      : `Confidence ${scenario.confidence}% below 70% threshold — clarifying response generated`;

  // Typography scale: Demo gets larger, Debug shrinks slightly
  const responseTextClass = isDemo ? 'text-sm leading-relaxed' : 'text-xs leading-relaxed';
  const responseMinHeight  = isDemo ? 'min-h-[160px]' : 'min-h-[110px]';
  const sectionLabelClass  = isDemo
    ? 'text-xs text-[var(--ascensus-text)] uppercase tracking-wider mb-2 font-bold'
    : 'text-xs text-[var(--ascensus-muted)] uppercase tracking-wider mb-1.5 font-semibold';

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
          Assist
        </span>
        {isTraining && (
          <p className="text-[11px] italic text-[var(--ascensus-teal)] opacity-80 leading-snug">
            {TRAINING_NOTE}
          </p>
        )}
      </div>

      <div className={`flex-1 flex flex-col overflow-y-auto ${isDemo ? 'p-5 gap-5' : 'p-4 gap-3'}`}>

        {/* ── CONFIDENCE BADGE — large focal point in Demo ── */}
        {isDemo
          ? <DemoConfidenceBadge score={scenario.confidence} />
          : <CompactConfidenceBadge score={scenario.confidence} />
        }

        {/* Failure domain tags — only in non-demo */}
        {!isDemo && hasFailure && (
          <div className="flex flex-wrap gap-1.5">
            {scenario.failureDomainTags!.map((tag) => (
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
        )}

        {/* Suggested response */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className={`${sectionLabelClass} mb-0`}>
              {isFallback ? 'Fallback Response Sent' : 'Suggested Response'}
            </div>
            {isFallback && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-900/30 border border-amber-700/60 rounded px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                Auto-sent · Awaiting reply
              </span>
            )}
          </div>
          {isFallback && (
            <div className="mb-2 rounded border border-amber-700/60 bg-amber-900/15 px-3 py-2 text-xs text-amber-200 leading-relaxed">
              <span className="font-semibold text-amber-300">Why a fallback was sent:</span>{' '}
              {fallbackReason}. The associate should follow up once the participant responds.
            </div>
          )}
          {/* In Demo: show failure tags inside the response block if present */}
          {isDemo && hasFailure && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {scenario.failureDomainTags!.map((tag) => (
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
          )}
          <textarea
            readOnly
            value={scenario.suggestedResponse}
            className={`w-full bg-[var(--ascensus-panel)] border border-[var(--ascensus-border)] rounded p-3 ${responseTextClass} text-[var(--ascensus-text)] resize-none focus:outline-none focus:border-[var(--ascensus-teal)] ${responseMinHeight}`}
          />
          <div className="text-xs text-[var(--ascensus-muted)] mt-1">
            {isFallback
              ? 'This response was sent automatically — associate prepares follow-up after participant replies'
              : 'Associate may edit before sending'}
          </div>
        </div>

        {/* Next action */}
        <div>
          <div className={sectionLabelClass}>Recommended Next Action</div>
          <div
            className={`rounded border leading-relaxed ${isDemo ? 'p-3.5 text-sm' : 'p-3 text-xs'} ${
              scenario.nextAction.startsWith('🔴')
                ? 'bg-red-900/20 border-red-700/50 text-red-300'
                : scenario.nextAction.startsWith('⚠️')
                ? 'bg-amber-900/20 border-amber-700/50 text-amber-300'
                : 'bg-[var(--ascensus-panel-2)] border-[var(--ascensus-teal-border)] text-[var(--ascensus-text)]'
            }`}
          >
            {scenario.nextAction}
          </div>
        </div>

        {/* Feedback */}
        <div className="mt-auto">
          <div className={sectionLabelClass}>Associate Feedback</div>
          <div className="flex gap-2">
            <button
              onClick={() => onFeedback('helpful')}
              className={`flex-1 rounded border font-medium transition-colors ${isDemo ? 'px-3 py-2.5 text-sm' : 'px-2 py-2 text-xs'} ${
                feedbackState === 'helpful'
                  ? 'bg-green-700/40 border-green-600 text-green-300'
                  : 'bg-[var(--ascensus-panel)] border-[var(--ascensus-border)] text-[var(--ascensus-muted)] hover:border-green-700/60 hover:text-green-400'
              }`}
            >
              ✓ Helpful
            </button>
            <button
              onClick={() => onFeedback('not-helpful')}
              className={`flex-1 rounded border font-medium transition-colors ${isDemo ? 'px-3 py-2.5 text-sm' : 'px-2 py-2 text-xs'} ${
                feedbackState === 'not-helpful'
                  ? 'bg-red-700/40 border-red-600 text-red-300'
                  : 'bg-[var(--ascensus-panel)] border-[var(--ascensus-border)] text-[var(--ascensus-muted)] hover:border-red-700/60 hover:text-red-400'
              }`}
            >
              ✗ Not Helpful
            </button>
            <button
              onClick={() => onFeedback('escalate')}
              className={`flex-1 rounded border font-medium transition-colors ${isDemo ? 'px-3 py-2.5 text-sm' : 'px-2 py-2 text-xs'} ${
                feedbackState === 'escalate'
                  ? 'bg-amber-700/40 border-amber-600 text-amber-300'
                  : 'bg-[var(--ascensus-panel)] border-[var(--ascensus-border)] text-[var(--ascensus-muted)] hover:border-amber-700/60 hover:text-amber-400'
              }`}
            >
              ↑ Escalate
            </button>
          </div>
          {feedbackState && (
            <div className="text-xs text-[var(--ascensus-muted)] mt-2 text-center">
              Feedback recorded: <span className="text-[var(--ascensus-text)]">{feedbackState}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
