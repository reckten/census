'use client';
import { ScenarioData, Mode } from '@/types';

interface Props {
  scenario: ScenarioData;
  mode: Mode;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TRAINING_NOTE =
  'The raw participant message — what the model receives as input before any classification or retrieval runs';

export default function InteractionPanel({ scenario, mode }: Props) {
  const isDebug = mode === 'debug';
  const isTraining = mode === 'training';

  const isFallback =
    scenario.confidence < 70 ||
    (scenario.failureDomainTags?.includes('FALLBACK_TRIGGERED') ?? false);

  // Sent-bubble timestamp = participant timestamp + ~30s, so it reads as a reply
  const replyTime = new Date(new Date(scenario.timestamp).getTime() + 30_000).toISOString();

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
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isTraining ? 'text-[var(--ascensus-teal)]' : 'text-[var(--ascensus-text)]'
            }`}
          >
            Interaction
          </span>
          <span className="font-mono text-xs text-[var(--ascensus-muted)]">
            {scenario.caseId}
          </span>
        </div>
        {isTraining && (
          <p className="text-[11px] italic text-[var(--ascensus-teal)] opacity-80 leading-snug">
            {TRAINING_NOTE}
          </p>
        )}
      </div>

      {/* Participant info bar */}
      <div
        className={`px-4 py-2.5 border-b shrink-0 ${
          isDebug
            ? 'border-[var(--ascensus-border-strong)] bg-[var(--ascensus-ink-2)]'
            : 'border-[var(--ascensus-border)] bg-[var(--ascensus-ink-2)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-[var(--ascensus-muted)]">Participant: </span>
            <span className="text-xs text-[var(--ascensus-text)] font-medium">
              {scenario.participantName}
            </span>
          </div>
          <span className="text-xs text-[var(--ascensus-muted)] font-mono">
            {formatTime(scenario.timestamp)}
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 p-4 flex flex-col gap-5 overflow-y-auto">
        {/* Customer message bubble */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-[var(--ascensus-border-strong)] flex items-center justify-center text-[10px] text-[var(--ascensus-text)] font-semibold shrink-0">
              {scenario.participantName.charAt(0)}
            </div>
            <span className="text-xs text-[var(--ascensus-muted)]">
              {scenario.participantName}
            </span>
          </div>
          <div className="bg-[var(--ascensus-panel-2)] border border-[var(--ascensus-border)] rounded-lg rounded-tl-none px-4 py-3 text-sm text-[var(--ascensus-text)] leading-relaxed">
            {scenario.customerMessage}
          </div>
          <div className="text-xs text-[var(--ascensus-muted)] mt-0.5 pl-1">
            {formatTime(scenario.timestamp)}
          </div>
        </div>

        {/* Agent reply — fallback sent automatically, or "generating..." placeholder */}
        <div className="flex flex-col gap-1 items-end">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-[var(--ascensus-muted)]">Agent Assist</span>
            <div className="w-5 h-5 rounded-full bg-[var(--ascensus-teal-soft)] border border-[var(--ascensus-teal-border)] flex items-center justify-center text-[10px] text-[var(--ascensus-teal)] font-bold shrink-0">
              A
            </div>
          </div>

          {isFallback ? (
            <>
              <div className="bg-amber-900/20 border border-amber-700/60 rounded-lg rounded-tr-none px-4 py-3 text-sm text-[var(--ascensus-text)] leading-relaxed max-w-[95%]">
                {scenario.suggestedResponse}
              </div>
              <div className="flex items-center gap-1.5 mt-1 pr-1 flex-wrap justify-end">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
                  </svg>
                  Fallback sent automatically
                </span>
                <span className="text-xs text-[var(--ascensus-muted)]">·</span>
                <span className="text-xs text-[var(--ascensus-muted)]">{formatTime(replyTime)}</span>
              </div>
            </>
          ) : (
            <div className="bg-[var(--ascensus-panel)] border border-[var(--ascensus-teal-border)] rounded-lg rounded-tr-none px-4 py-3 text-sm max-w-[95%]">
              <div className="flex items-center gap-2 text-[var(--ascensus-muted)] italic text-xs">
                <span className="flex gap-0.5 items-center">
                  <span
                    className="w-1.5 h-1.5 bg-[var(--ascensus-teal)] rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></span>
                  <span
                    className="w-1.5 h-1.5 bg-[var(--ascensus-teal)] rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></span>
                  <span
                    className="w-1.5 h-1.5 bg-[var(--ascensus-teal)] rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></span>
                </span>
                Agent Assist is generating a recommendation...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
