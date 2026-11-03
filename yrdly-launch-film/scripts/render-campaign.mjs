import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { openBrowser, selectComposition, renderFrames, renderStill } from '@remotion/renderer';
import { ffmpeg } from './media-tools.mjs';
import { campaignPlans } from './campaign-plans.mjs';

const mode = process.argv[2] || 'stills';
if (!['stills', 'video', 'final'].includes(mode)) throw Error('Use stills, video or final.');
const final = mode === 'final';
const selected = process.argv.slice(3);
const plans = campaignPlans.filter((plan) => !selected.length || selected.includes(plan.id));
if (!plans.length) throw Error('No matching composition.');
const root = process.cwd(), out = path.join(root, final ? 'output' : 'previews/sound-review');
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'assets'), outDir: path.join(root, '.cache/campaign-bundle') });
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await openBrowser('chrome', { browserExecutable });
const shared = { serveUrl, browserExecutable, puppeteerInstance: browser, inputProps: { withAudio: false } };
try {
  for (const plan of plans) {
    const composition = await selectComposition({ ...shared, id: plan.id });
    if (composition.durationInFrames !== plan.seconds * 60 || composition.fps !== 60) throw Error('Timeline mismatch');
    if (mode === 'stills') {
      for (const frame of plan.stills) {
        await renderStill({ ...shared, composition, frame, scale: 2 / 3, output: path.join(out, 'stills', `${plan.id}-${String(frame).padStart(4, '0')}.png`) });
      }
      console.log(`${plan.id}: ${plan.stills.length} clean review frames`);
      continue;
    }
    const framesDir = path.join(root, final ? '.cache/frames-final' : '.cache/frames-clean', plan.id);
    fs.mkdirSync(framesDir, { recursive: true });
    let last = -1;
    await renderFrames({
      ...shared, composition, imageFormat: 'png', scale: final ? 1 : 2 / 3, concurrency: 1,
      outputDir: framesDir, imageSequencePattern: 'frame-[frame].[ext]',
      onStart: () => console.log(`${plan.id}: ${composition.durationInFrames} frames / sequential capture`),
      onFrameUpdate: (n) => { const step = Math.floor(n / composition.durationInFrames * 20); if (step !== last) { last = step; console.log(`${plan.id}: ${step * 5}%`); } },
    });
    const frames = fs.readdirSync(framesDir).filter((name) => /^frame-\d+\.png$/.test(name)).sort();
    const digits = String(composition.durationInFrames - 1).length;
    if (frames.length !== composition.durationInFrames || frames.some((file, i) => file !== `frame-${String(i).padStart(digits, '0')}.png`)) throw Error('Missing or unexpected captured frame');
    const file = path.join(out, `${plan.stem}${final ? '' : '-sound-review'}.mp4`);
    await new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, ['-y', '-v', 'error', '-framerate', '60', '-start_number', '0', '-i', path.join(framesDir, `frame-%0${digits}d.png`), '-i', path.join(root, `assets/audio/${plan.audio}-mix.wav`), '-map', '0:v:0', '-map', '1:a:0', '-frames:v', String(composition.durationInFrames), '-t', String(plan.seconds), '-c:v', 'libx264', '-preset', final ? 'slow' : 'medium', '-crf', final ? '17' : '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', file], { stdio: 'inherit' });
      child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(Error(`Encoding failed ${code}`)));
    });
    for (const frame of plan.stills) fs.copyFileSync(path.join(framesDir, `frame-${String(frame).padStart(digits, '0')}.png`), path.join(out, 'stills', `${plan.id}-${String(frame).padStart(4, '0')}.png`));
    console.log(`Encoded ${file}`);
  }
} finally { await browser.close({ silent: true }); }
