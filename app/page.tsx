'use client';
import { useState } from 'react';
import TopBar from '@/app/components/TopBar';
import InteractionPanel from '@/app/components/InteractionPanel';
import AssistPanel from '@/app/components/AssistPanel';
import ExplainabilityPanel from '@/app/components/ExplainabilityPanel';
import DebugPanel from '@/app/components/DebugPanel';
import GlossaryModal from '@/app/components/GlossaryModal';
import TrainingOverlay from '@/app/components/TrainingOverlay';
import scenario1 from '@/data/scenario1.json';
import scenario2 from '@/data/scenario2.json';
import scenario3 from '@/data/scenario3.json';
import { ScenarioData, Mode, ScenarioId } from '@/types';

const scenarios: Record<ScenarioId, ScenarioData> = {
  1: scenario1 as unknown as ScenarioData,
  2: scenario2 as unknown as ScenarioData,
  3: scenario3 as unknown as ScenarioData,
};

// Column span classes per mode:
// demo:     3 equal cols — no debug panel (clean associate view)
// debug:    Interaction(narrow) | Assist(narrower) | Explain(medium) | Debug(wide)
// training: 4 equal cols
const gridClass: Record<Mode, string> = {
  demo:     'lg:grid-cols-3',
  debug:    'lg:grid-cols-[1fr_0.85fr_1fr_1.8fr]',
  training: 'lg:grid-cols-4',
};

export default function Home() {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>(1);
  const [mode, setMode] = useState<Mode>('demo');
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

  const scenario = scenarios[activeScenario];

  const handleFeedback = (type: 'helpful' | 'not-helpful' | 'escalate') => {
    setFeedbackMap((prev) => ({ ...prev, [scenario.caseId]: type }));
  };

  // Debug mode: slightly higher-contrast root background
  const rootBg = mode === 'debug' ? 'bg-[var(--ascensus-ink-2)]' : 'bg-[var(--ascensus-ink)]';

  return (
    <div className={`min-h-screen ${rootBg} text-[var(--ascensus-text)] flex flex-col transition-colors duration-200`}>
      <TopBar
        mode={mode}
        setMode={setMode}
        activeScenario={activeScenario}
        setActiveScenario={setActiveScenario}
        onGlossaryOpen={() => setGlossaryOpen(true)}
      />

      {/* Debug mode banner */}
      {mode === 'debug' && (
        <div className="bg-[#1a1200] border-b border-amber-700/50 px-4 py-1.5 text-amber-400 text-xs font-mono flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0 animate-pulse"></span>
          <span className="font-semibold">ENGINEERING VIEW</span>
          <span className="text-amber-600 mx-1">—</span>
          Full pipeline trace active · Raw logs open · Error detail expanded
        </div>
      )}

      {/* Training mode banner */}
      {mode === 'training' && (
        <div className="bg-[var(--ascensus-teal-soft)] border-b border-[var(--ascensus-teal-border)] px-4 py-1.5 text-[var(--ascensus-teal)] text-xs flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ascensus-teal)] inline-block shrink-0"></span>
          <span className="font-semibold">TRAINING MODE</span>
          <span className="opacity-50 mx-1">—</span>
          Panel annotations are coach&apos;s notes for new associates · Not visible in Demo or Debug
        </div>
      )}

      {/* Panel grid */}
      <div
        className={`flex-1 grid grid-cols-1 ${gridClass[mode]} overflow-hidden`}
        style={{ minHeight: 0 }}
      >
        <InteractionPanel scenario={scenario} mode={mode} />
        <AssistPanel
          scenario={scenario}
          mode={mode}
          onFeedback={handleFeedback}
          feedbackState={feedbackMap[scenario.caseId]}
        />
        <ExplainabilityPanel
          key={`explain-${activeScenario}`}
          scenario={scenario}
          mode={mode}
        />
        {/* Debug panel hidden entirely in Demo mode */}
        {mode !== 'demo' && (
          <DebugPanel scenario={scenario} mode={mode} />
        )}
      </div>

      {/* Training overlay — pinned to bottom */}
      {mode === 'training' && <TrainingOverlay scenario={scenario} />}

      {/* Glossary modal */}
      {glossaryOpen && <GlossaryModal onClose={() => setGlossaryOpen(false)} />}
    </div>
  );
}
