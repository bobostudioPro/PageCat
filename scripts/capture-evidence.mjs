import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const out = 'docs/screenshots';
await mkdir(out, { recursive: true });
const env = { ...process.env, FONTCONFIG_FILE: '/tmp/fonts.conf', FONTCONFIG_PATH: '/tmp' };
const base = process.env.CAPTURE_URL || 'http://127.0.0.1:4173/';

const browser = await chromium.launch({ env });

// Library, desktop
const p = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(base, { waitUntil: 'networkidle' });
await p.waitForTimeout(1400);
await p.screenshot({ path: `${out}/after-library.png`, fullPage: true });

// Hover state (tooltip)
await p.locator('.book-spine').first().hover();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/after-library-hover.png` });

// Opening transition
await p.locator('.book-spine').first().click();
await p.waitForTimeout(760);
await p.screenshot({ path: `${out}/after-opening.png` });
await p.waitForTimeout(1200);

// Reader at a seeded highlight
await p.goto(`${base}#/read/sample-gatsby`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);
await p.locator('.highlight-card').first().click();
await p.waitForTimeout(1400);
await p.screenshot({ path: `${out}/after-reader.png` });

// Text selection toolbar
await p.evaluate(() => {
  const page = document.querySelector('.pdf-page[data-page="2"]');
  const spans = [...page.querySelectorAll('.textLayer span')].filter((s) => (s.textContent || '').length > 60);
  const span = spans[2] || spans[0];
  const text = span.firstChild;
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, Math.min(52, text.textContent.length));
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
});
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/after-selection.png` });

// Annotation popover
await p.mouse.click(220, 700);
await p.waitForTimeout(300);
const hl = await p.locator('.hl').first().boundingBox();
if (hl) {
  await p.mouse.click(hl.x + hl.width / 2, hl.y + hl.height / 2);
  await p.waitForTimeout(500);
}
await p.screenshot({ path: `${out}/after-annotation.png` });
await p.keyboard.press('Escape');

// AI panel with a local summary
await p.locator('.sidebar-tab.ai-tab').click();
await p.waitForTimeout(500);
await p.getByRole('button', { name: '总结这一页' }).click();
await p.waitForTimeout(1600);
await p.screenshot({ path: `${out}/after-ai.png` });

// Settings
await p.locator('.rt-icon[aria-label="设置"]').click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/after-settings.png` });
await p.keyboard.press('Escape');

// Upload dialog
await p.goto(base, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.getByRole('button', { name: /放入新书/ }).first().click();
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/after-upload.png` });
await p.keyboard.press('Escape');

// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.goto(base, { waitUntil: 'networkidle' });
await m.waitForTimeout(1400);
await m.screenshot({ path: `${out}/after-mobile-library.png`, fullPage: true });
await m.goto(`${base}#/read/sample-gatsby`, { waitUntil: 'networkidle' });
await m.waitForTimeout(2000);
await m.screenshot({ path: `${out}/after-mobile-reader.png` });

await browser.close();
console.log('captured evidence to', out);
