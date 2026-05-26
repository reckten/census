'use client';
import { ScenarioData } from '@/types';

interface Props {
  scenario: ScenarioData;
}

type Level = 'info' | 'warning' | 'danger';

const trainingContent: Record<number, { message: string; level: Level }> = {
  1: {
    message:
      'A clean run end-to-end: one strong document match (0.94), no fallback, no failed tool calls. When you see this shape, the model’s output is well-grounded — but high confidence isn’t a free pass, it just means there’s nothing in the trace pushing back on the answer.',
    level: 'info',
  },
  2: {
    message:
      'Confidence dropped because retrieval returned two partial matches that don’t fully resolve the question. The model knows it’s under-informed and asked a clarifying question instead of guessing — that’s the guardrail working as designed. The "fallback" here is a feature, not an error.',
    level: 'warning',
  },
  3: {
    message:
      'The model itself was confident (89%), but the Salesforce CRM tool call failed (3s timeout). The system fell back to a safe, generic response rather than risk acting on stale data. This is a tool-layer failure, not a model failure — and the recurring pattern is exactly what to flag back to engineering.',
    level: 'danger',
  },
};

const escalationRules = [
  {
    trigger: 'Confidence %',
    action: 'Model’s self-rated certainty — calibration signal, not accuracy',
  },
  {
    trigger: 'Match score',
    action: 'How well a knowledge-base doc matched — < 0.65 = weak retrieval',
  },
  {
    trigger: 'FALLBACK_TRIGGERED',
    action: 'Guardrail fired — model output replaced by safe template',
  },
  {
    trigger: 'TOOL_CALL_FAILED',
    action: 'Backend/tool issue, not the LLM — worth a ticket to AI team',
  },
  {
    trigger: 'Recurring pattern',
    action: 'Same failure 3+ times this week → escalate as systemic',
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
            What Agent Assist Did Here — Scenario {scenario.id}
          </div>
          <p className="text-xs leading-relaxed">{content.message}</p>
        </div>
      </div>

      {/* When to escalate quick-reference */}
      <div className="lg:w-96 bg-[var(--ascensus-ink-2)] border border-[var(--ascensus-border)] rounded p-3 shrink-0">
        <div className="text-xs font-semibold text-[var(--ascensus-text)] uppercase tracking-wider mb-2.5">
          Reading the AI — Signal Glossary
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
