'use client';
import { ScenarioData } from '@/types';

interface Props {
  scenario: ScenarioData;
}

type Level = 'info' | 'warning' | 'danger';

const trainingContent: Record<number, { message: string; level: Level }> = {
  1: {
    message:
      'This is a high-confidence response. The system retrieved a clear policy match. Associates should still confirm the participant has portal access before closing.',
    level: 'info',
  },
  2: {
    message:
      'Confidence is below threshold. Never send a suggested response under 70% without verifying missing context. The system flagged two conflicting documents — this is a signal to gather more info.',
    level: 'warning',
  },
  3: {
    message:
      'A backend failure triggered a safe fallback. The associate should NOT attempt the update online. Escalate using the manual workflow. Notice the Known Issue Pattern tag — this should be escalated to engineering.',
    level: 'danger',
  },
};

const escalationRules = [
  {
    trigger: 'Confidence < 70%',
    action: 'Gather missing context before responding',
  },
  {
    trigger: 'TOOL_CALL_FAILED',
    action: 'Do not proceed online — use manual workflow',
  },
  {
    trigger: 'FALLBACK_TRIGGERED',
    action: 'Review fallback reason before sending',
  },
  {
    trigger: 'Known Issue Pattern',
    action: 'Escalate to engineering, not just ops',
  },
  {
    trigger: 'RETRIEVAL_AMBIGUOUS',
    action: 'Verify with participant before confirming',
  },
];

const colorMap: Record<Level, { wrapper: string; icon: string; label: string }> = {
  info: {
    wrapper: 'bg-[var(--ascensus-teal-soft)] border-[var(--ascensus-teal-border)] text-[var(--ascensus-teal)]',
    icon: 'text-[var(--ascensus-teal)]',
    label: 'ℹ',
  },
  warning: {
    wrapper: 'bg-amber-900/30 border-amber-700/50 text-amber-300',
    icon: 'text-amber-400',
    label: '⚠',
  },
  danger: {
    wrapper: 'bg-red-900/30 border-red-700/50 text-red-300',
    icon: 'text-red-400',
    label: '⛔',
  },
};

export default function TrainingOverlay({ scenario }: Props) {
  const content = trainingContent[scenario.id];
  if (!content) return null;

  const colors = colorMap[content.level];

  return (
    <div className="bg-[var(--ascensus-ink-2)] border-t border-[var(--ascensus-border)] px-4 py-3 flex flex-col lg:flex-row gap-3 shrink-0">
      {/* Training guidance */}
      <div
        className={`flex-1 rounded border p-3 flex gap-3 ${colors.wrapper}`}
      >
        <span className={`text-lg shrink-0 leading-none mt-0.5 ${colors.icon}`}>
          {colors.label}
        </span>
        <div>
          <div className="text-xs font-semibold mb-1 uppercase tracking-wider">
            Training Guidance — Scenario {scenario.id}
          </div>
          <p className="text-xs leading-relaxed">{content.message}</p>
        </div>
      </div>

      {/* When to escalate quick-reference */}
      <div className="lg:w-96 bg-[var(--ascensus-ink-2)] border border-[var(--ascensus-border)] rounded p-3 shrink-0">
        <div className="text-xs font-semibold text-[var(--ascensus-text)] uppercase tracking-wider mb-2.5">
          When to Escalate — Quick Reference
        </div>
        <div className="space-y-2">
          {escalationRules.map((rule) => (
            <div key={rule.trigger} className="flex gap-2 items-start text-xs">
              <span className="font-mono text-[var(--ascensus-muted)] bg-[var(--ascensus-panel)] px-1.5 py-0.5 rounded shrink-0 text-[10px]">
                {rule.trigger}
              </span>
              <span className="text-[var(--ascensus-muted)] leading-snug">
                → {rule.action}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
