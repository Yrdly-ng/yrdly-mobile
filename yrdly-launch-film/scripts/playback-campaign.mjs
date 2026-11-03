import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { campaignPlans } from './campaign-plans.mjs';

const directory = path.resolve(process.argv.includes('--final') ? 'output' : 'previews/sound-review');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`file://${directory}/index.html`);
  for (const plan of campaignPlans) {
    const video = page.locator(`video[data-edit="${plan.audio}"]`);
    await video.scrollIntoViewIfNeeded();
    // Muted browser playback verifies decoded pictures and audio presence without playing through laptop speakers.
    await video.evaluate(async (element) => { element.muted = true; await element.play(); });
    await page.waitForFunction((key) => document.querySelector(`video[data-edit="${key}"]`).ended, plan.audio, { timeout: 60000 });
    const result = await video.evaluate((element) => {
      const quality = element.getVideoPlaybackQuality();
      return { duration: element.duration, width: element.videoWidth, height: element.videoHeight, error: element.error?.message || null, totalFrames: quality.totalVideoFrames, droppedFrames: quality.droppedVideoFrames, corruptedFrames: quality.corruptedVideoFrames, decodedAudioBytes: element.webkitAudioDecodedByteCount || 0 };
    });
    if (result.error || result.corruptedFrames || Math.abs(result.duration - plan.seconds) > .05 || result.decodedAudioBytes === 0) throw Error(`Playback failed: ${plan.id} ${JSON.stringify(result)}`);
    await video.evaluate((element) => { element.currentTime = element.duration - .15; });
    await page.waitForFunction((key) => !document.querySelector(`video[data-edit="${key}"]`).seeking, plan.audio);
    await video.screenshot({ path: `${directory}/${plan.id}-playback-end.png` });
    checks.push({ id: plan.id, ...result, completePlayback: 'passed', endSeek: 'passed' });
    console.log(`${plan.id}: complete playback and audio decode passed`);
  }
  if (errors.length) throw Error(errors.join('\n'));
  fs.writeFileSync(`${directory}/playback-verification.json`, JSON.stringify({ checkedAt: new Date().toISOString(), checks, errors }, null, 2));
} finally { await browser.close(); }
