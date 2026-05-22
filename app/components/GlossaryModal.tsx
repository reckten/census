'use client';
import { useState, useEffect, useCallback } from 'react';

const glossaryTerms = [
  {
    term: 'RMD',
    definition:
      'Required Minimum Distribution: The minimum amount a retirement account holder must withdraw annually once they reach their applicable age (73 for most people born 1951–1959, per SECURE 2.0).',
  },
  {
    term: 'SECURE 2.0',
    definition:
      'Setting Every Community Up for Retirement Enhancement Act 2.0: 2022 legislation that changed RMD ages, catch-up contribution rules, and other retirement plan requirements.',
  },
  {
    term: 'Distribution',
    definition:
      'Any withdrawal of funds from a retirement account, including rollovers to other institutions.',
  },
  {
    term: 'Deferral',
    definition:
      'Employee salary contributions to a 401(k) or similar plan, either pre-tax or Roth (after-tax).',
  },
  {
    term: 'Plan Sponsor',
    definition:
      'The employer that establishes and maintains the retirement plan for its employees.',
  },
  {
    term: 'Participant',
    definition:
      'An individual enrolled in an employer-sponsored retirement plan.',
  },
  {
    term: 'TPA',
    definition:
      'Third-Party Administrator: A firm that manages the day-to-day operations of a retirement plan on behalf of the plan sponsor.',
  },
  {
    term: '3(16) Fiduciary',
    definition:
      "A named fiduciary under ERISA that takes on administrative responsibilities for a plan, reducing the sponsor's liability.",
  },
  {
    term: 'ERISA',
    definition:
      'Employee Retirement Income Security Act: Federal law that sets minimum standards for retirement plans in private industry.',
  },
  {
    term: 'Rollover',
    definition:
      'Moving funds from one retirement account to another without triggering a taxable event, if done within IRS rules.',
  },
  {
    term: 'Hardship Withdrawal',
    definition:
      'An early withdrawal from a retirement account for an immediate and heavy financial need, subject to plan rules and potential penalties.',
  },
  {
    term: 'Beneficiary',
    definition:
      "The person(s) designated to receive retirement account funds upon the account holder's death.",
  },
  {
    term: 'RAG',
    definition:
      'Retrieval-Augmented Generation: The AI technique where a system searches a knowledge base for relevant documents before generating a response, grounding the answer in verified sources.',
  },
  {
    term: 'MCP',
    definition:
      'Model Context Protocol: A standard that lets AI systems connect to and call external tools and data sources (like a CRM) during a workflow.',
  },
  {
    term: 'LLM',
    definition:
      'Large Language Model: The AI model (e.g. GPT-4, Claude) that generates natural language responses based on a prompt and context.',
  },
  {
    term: 'Langfuse',
    definition:
      'An open-source LLM observability platform used to trace, monitor, and evaluate AI pipeline steps including retrieval, generation, and tool calls.',
  },
  {
    term: 'Intent Classification',
    definition:
      'The step where the AI system determines what the user is asking (e.g. DISTRIBUTION_STATUS_CHECK) before retrieving relevant documents.',
  },
  {
    term: 'Confidence Score',
    definition:
      'A 0–100% measure of how certain the system is about its intent classification and retrieved knowledge match.',
  },
  {
    term: 'Fallback Response',
    definition:
      'A safe, pre-approved message the system shows when confidence is low or a tool call fails, preventing the associate from sending incorrect information.',
  },
  {
    term: 'Known Issue Pattern',
    definition:
      'A tag applied when the same failure type has occurred multiple times, signaling that it should be escalated to engineering for a systemic fix rather than handled case-by-case.',
  },
];

interface Props {
  onClose: () => void;
}

export default function GlossaryModal({ onClose }: Props) {
  const [search, setSearch] = useState('');

  const filtered = glossaryTerms.filter(
    (t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.definition.toLowerCase().includes(search.toLowerCase())
  );

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--ascensus-ink-2)] border border-[var(--ascensus-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--ascensus-border)] flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ascensus-text)] font-display">Glossary</h2>
            <p className="text-xs text-[var(--ascensus-muted)] mt-0.5">
              Ascensus & AI Pipeline Terminology
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ascensus-muted)] hover:text-[var(--ascensus-text)] transition-colors w-6 h-6 flex items-center justify-center text-lg ml-4"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[var(--ascensus-border)] shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms..."
            autoFocus
            className="w-full bg-[var(--ascensus-ink-3)] border border-[var(--ascensus-border)] rounded px-3 py-2 text-sm text-[var(--ascensus-text)] placeholder-[var(--ascensus-muted)] focus:outline-none focus:border-[var(--ascensus-teal)]"
          />
          <div className="text-xs text-[var(--ascensus-muted)] mt-1.5">
            {filtered.length} of {glossaryTerms.length} terms
          </div>
        </div>

        {/* Term list */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {filtered.length === 0 ? (
            <div className="text-sm text-[var(--ascensus-muted)] py-6 text-center">
              No terms match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <dl className="space-y-4">
              {filtered.map((item) => (
                <div
                  key={item.term}
                  className="border-b border-[var(--ascensus-border)] pb-4 last:border-0 last:pb-0"
                >
                  <dt className="text-sm font-semibold text-[var(--ascensus-teal)] mb-1">
                    {item.term}
                  </dt>
                  <dd className="text-xs text-[var(--ascensus-muted)] leading-relaxed">
                    {item.definition}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--ascensus-border)] shrink-0">
          <button
            onClick={onClose}
            className="text-xs text-[var(--ascensus-muted)] hover:text-[var(--ascensus-text)] transition-colors"
          >
            Press Esc or click outside to close
          </button>
        </div>
      </div>
    </div>
  );
}
