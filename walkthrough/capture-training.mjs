// Re-capture just the three Training Mode screenshots after the layout fix.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, 'shots');
const BASE = process.env.WALKTHROUGH_URL ?? 'http://localhost:3000';

const TARGETS = [
  { id: 1, label: 'Happy Path',       filename: '03-01-happy-path-c-training.png' },
  { id: 2, label: 'Low Confidence',   filename: '06-02-low-confidence-c-training.png' },
  { id: 3, label: 'Backend Failure',  filename: '09-03-backend-failure-c-training.png' },
];

async function waitForReady(page) {
  await page.getByText('Suggested Response').first().waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

async function main() {
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1050 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitForReady(page);

  // Click into Training mode once.
  await page.getByRole('button', { name: 'Training Mode' }).click();
  await waitForReady(page);

  for (const t of TARGETS) {
    await page.locator('select').first().selectOption(String(t.id));
    await waitForReady(page);

    const out = join(SHOTS, t.filename);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`  ${t.filename}  (Scenario ${t.id}: ${t.label})`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
