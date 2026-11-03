import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ffmpeg } from './media-tools.mjs';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill, renderFrames, openBrowser } from '@remotion/renderer';
const root = process.cwd();
const mode = process.argv[2] || 'stills';
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src/index.ts'),
  publicDir: path.join(root, 'assets'),
  outDir: path.join(root, '.cache/remotion-bundle'),
});
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await openBrowser('chrome', { browserExecutable });
const shared = { serveUrl, browserExecutable, puppeteerInstance: browser };
fs.mkdirSync('previews/stills', { recursive: true });
const plans = [
  {
    id: 'YrdlyMain36',
    file: 'yrdly-launch-main-36s-draft-v2.mp4',
    frames: [
      0, 60, 165, 220, 330, 410, 480, 600, 765, 840, 990, 1125, 1220, 1360, 1485, 1570, 1750, 1845,
      1920, 2010, 2159,
    ],
  },
  {
    id: 'YrdlySocial15',
    file: 'yrdly-launch-social-15s-draft-v2.mp4',
    frames: [30, 110, 170, 260, 340, 400, 460, 520, 590, 680, 710, 760, 830, 899],
  },
];
try {
  for (const plan of plans) {
    const composition = await selectComposition({ ...shared, id: plan.id });
    if (mode === 'stills')
      for (const frame of plan.frames) {
        await renderStill({
          ...shared,
          composition,
          frame,
          output: path.join(
            root,
            `previews/stills/${plan.id}-${String(frame).padStart(4, '0')}.png`
          ),
          scale: 2 / 3,
        });
        console.log(`${plan.id} still ${frame}`);
      }
    if (mode === 'video' || mode === 'refine' || mode === plan.id) {
      let last = -1;
      const outputDir = path.join(root, '.cache/frames-v2', plan.id);
      const range =
        mode === 'refine' ? (plan.id === 'YrdlyMain36' ? [752, 1499] : [272, 539]) : undefined;
      const count = range ? range[1] - range[0] + 1 : composition.durationInFrames;
      fs.mkdirSync(outputDir, { recursive: true });
      await renderFrames({
        ...shared,
        composition,
        inputProps: {},
        ...(range ? { frames: Array.from({ length: count }, (_, i) => range[0] + i) } : {}),
        imageFormat: 'png',
        scale: 2 / 3,
        concurrency: 1,
        outputDir,
        imageSequencePattern: 'frame-[frame].[ext]',
        onStart: () => console.log(`${plan.id}: rendering ${count} frames`),
        onFrameUpdate: (n) => {
          const step = Math.floor((n / count) * 20);
          if (step !== last) {
            last = step;
            console.log(`${plan.id}: ${step * 5}%`);
          }
        },
      });
      const files = fs
        .readdirSync(outputDir)
        .filter((f) => f.endsWith('.png'))
        .sort();
      if (files.length !== composition.durationInFrames) throw Error('Frame count mismatch');
      const sample = files[0],
        digits = sample.match(/(\d+)\.png$/)[1].length;
      const input = path.join(outputDir, `frame-%0${digits}d.png`);
      await new Promise((resolve, reject) => {
        const child = spawn(
          ffmpeg,
          [
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-framerate',
            '60',
            '-start_number',
            '0',
            '-i',
            input,
            '-frames:v',
            String(composition.durationInFrames),
            '-c:v',
            'libx264',
            '-preset',
            'medium',
            '-crf',
            '20',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            '-an',
            path.join(root, 'previews', plan.file),
          ],
          { stdio: 'inherit' }
        );
        child.on('error', reject);
        child.on('exit', (code) => (code === 0 ? resolve() : reject(Error(`FFmpeg exit ${code}`))));
      });
      for (const frame of plan.frames) {
        const source = path.join(outputDir, `frame-${String(frame).padStart(digits, '0')}.png`);
        fs.copyFileSync(
          source,
          path.join(root, `previews/stills/${plan.id}-${String(frame).padStart(4, '0')}.png`)
        );
      }
      console.log(`Encoded ${plan.file}`);
    }
  }
} finally {
  await browser.close({ silent: true });
}
