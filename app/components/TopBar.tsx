'use client';
import { Mode, ScenarioId } from '@/types';

interface TopBarProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  activeScenario: ScenarioId;
  setActiveScenario: (s: ScenarioId) => void;
  onGlossaryOpen: () => void;
}

const modes: { id: Mode; label: string }[] = [
  { id: 'demo', label: 'Demo Mode' },
  { id: 'debug', label: 'Debug Mode' },
  { id: 'training', label: 'Training Mode' },
];

export default function TopBar({
  mode,
  setMode,
  activeScenario,
  setActiveScenario,
  onGlossaryOpen,
}: TopBarProps) {
  return (
    <div className="bg-[var(--ascensus-ink-2)] border-b border-[var(--ascensus-border)] px-4 py-2 flex items-center gap-3 flex-wrap shrink-0">
      {/* App name */}
      <div className="flex items-center gap-2 mr-2">
        <img
          src="/brand/ascensus-logo.png"
          alt="Ascensus"
          className="h-5 w-auto"
        />
        <div className="w-2 h-2 rounded-full bg-[var(--ascensus-teal)] shrink-0"></div>
        <span className="text-sm font-semibold text-[var(--ascensus-text)] whitespace-nowrap font-display">Agent Assist</span>
        <span className="text-[var(--ascensus-border-strong)] text-sm">|</span>
        <span className="text-xs text-[var(--ascensus-muted)] whitespace-nowrap">Triage Console</span>
      </div>

      {/* Mode switcher */}
      <div className="flex bg-[var(--ascensus-ink-3)] border border-[var(--ascensus-border)] rounded overflow-hidden">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border-r border-[var(--ascensus-border)] last:border-r-0 ${
              mode === m.id
                ? 'bg-[var(--ascensus-teal-soft)] text-[var(--ascensus-text)]'
                : 'text-[var(--ascensus-muted)] hover:text-[var(--ascensus-text)] hover:bg-[var(--ascensus-panel)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Scenario selector */}
      <select
        value={activeScenario}
        onChange={(e) => setActiveScenario(Number(e.target.value) as ScenarioId)}
        className="bg-[var(--ascensus-ink-3)] border border-[var(--ascensus-border)] text-[var(--ascensus-text)] text-xs px-2 py-1.5 rounded focus:outline-none focus:border-[var(--ascensus-teal)] cursor-pointer"
      >
        <option value={1}>Scenario 1 — Happy Path</option>
        <option value={2}>Scenario 2 — Low Confidence</option>
        <option value={3}>Scenario 3 — Backend Failure</option>
      </select>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-[var(--ascensus-muted)] hidden sm:block font-mono">Ascensus Internal</span>
        <button
          onClick={onGlossaryOpen}
          className="w-6 h-6 rounded-full bg-[var(--ascensus-panel)] border border-[var(--ascensus-border)] text-[var(--ascensus-text)] text-xs font-bold hover:bg-[var(--ascensus-panel-2)] transition-colors flex items-center justify-center shrink-0"
          title="Open glossary"
        >
          ?
        </button>
      </div>
    </div>
  );
}
