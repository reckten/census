// Interview prep walk-through capture.
// Scenario-first: for each of the 3 scenarios, capture Demo -> Debug -> Training.
// Produces 9 screenshots in walkthrough/shots/.
//
// Run with the dev server already on :3000:
//   node walkthrough/capture.mjs
//
// Uses the globally-installed Playwright from C:\Users\reckt\AppData\Local\ms-playwright.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, 'shots');
const BASE = process.env.WALKTHROUGH_URL ?? 'http://localhost:3000';

const SCENARIOS = [
  { id: 1, slug: '01-happy-path',       label: 'Happy Path' },
  { id: 2, slug: '02-low-confidence',   label: 'Low Confidence' },
  { id: 3, slug: '03-backend-failure',  label: 'Backend Failure' },
];

const MODES = [
  { id: 'demo',     slug: 'a-demo',     label: 'Demo Mode' },
  { id: 'debug',    slug: 'b-debug',    label: 'Debug Mode' },
  { id: 'training', slug: 'c-training', label: 'Training Mode' },
];

async function selectScenario(page, id) {
  await page.locator('select').first().selectOption(String(id));
}

async function selectMode(page, modeId) {
  const labelMap = { demo: 'Demo Mode', debug: 'Debug Mode', training: 'Training Mode' };
  await page.getByRole('button', { name: labelMap[modeId] }).click();
}

async function waitForReady(page) {
  // Wait for the Suggested Response section to render with content.
  await page.getByText('Suggested Response').first().waitFor({ state: 'visible' });
  // Let the /api/explain call resolve (or fall back) — animation stops, source line appears in debug.
  await page.waitForLoadState('networkidle').catch(() => {});
  // Tiny settle for any final font/layout shift.
  await page.waitForTimeout(300);
}

async function main() {
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1050 },
    deviceScaleFactor: 2, // crisper screenshots for the deck
  });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE}`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitForReady(page);

  let step = 1;
  for (const scenario of SCENARIOS) {
    await selectScenario(page, scenario.id);
    await waitForReady(page);

    for (const mode of MODES) {
      await selectMode(page, mode.id);
      await waitForReady(page);

      const name = `${String(step).padStart(2, '0')}-${scenario.slug}-${mode.slug}.png`;
      const out = join(SHOTS, name);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`  ${name}  (Scenario ${scenario.id}: ${scenario.label} / ${mode.label})`);
      step += 1;
    }
  }

  await browser.close();
  console.log(`\nDone. ${SCENARIOS.length * MODES.length} screenshots in walkthrough/shots/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
