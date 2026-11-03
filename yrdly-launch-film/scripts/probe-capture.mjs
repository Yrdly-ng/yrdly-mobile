import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderFrames, openBrowser } from '@remotion/renderer';
const mode = process.argv[2] || 'baseline';
if (mode === 'viewport') process.env.DISABLE_FROM_SURFACE = '1';
const scale = mode === 'native' ? 1 : 2 / 3;
const concurrency = ['serial', 'regression'].includes(mode) ? 1 : 2;
const chromiumOptions = mode === 'software' ? { gl: 'swiftshader' } : {};
const holdRanges = [
  [96, 151],
  [340, 390],
  [500, 540],
  [700, 740],
  [980, 1040],
  [1380, 1440],
  [1730, 1790],
  [2010, 2159],
];
const selectedFrames =
  mode === 'regression'
    ? holdRanges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))
    : undefined;
const root = process.cwd();
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src/index.ts'),
  publicDir: path.join(root, 'assets'),
  outDir: path.join(root, '.cache/probe-bundle'),
});
const browserExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });
const shared = { serveUrl, browserExecutable, puppeteerInstance: browser, chromiumOptions };
const outputDir = path.join(root, `.cache/probe-${mode}`);
fs.mkdirSync(outputDir, { recursive: true });
try {
  const composition = await selectComposition({ ...shared, id: 'YrdlyMain36' });
  await renderFrames({
    ...shared,
    composition,
    inputProps: {},
    imageFormat: 'png',
    scale,
    concurrency,
    outputDir,
    ...(selectedFrames ? { frames: selectedFrames } : { frameRange: [96, 151] }),
    imageSequencePattern: 'frame-[frame].[ext]',
    onStart: () =>
      console.log(
        `Probe ${mode}: ${selectedFrames?.length || 56} settled frames, scale ${scale}, concurrency ${concurrency}`
      ),
    onFrameUpdate: () => {},
  });
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith('.png'))
    .sort();
  const pixels = await Promise.all(
    files.map((f) => sharp(path.join(outputDir, f)).resize(160, 90).removeAlpha().raw().toBuffer())
  );
  const distances = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
  };
  const comparisons = pixels.map((p, i) => ({
    file: files[i],
    meanDifference:
      i &&
      Number(files[i].match(/(\d+)\.png/)[1]) === Number(files[i - 1].match(/(\d+)\.png/)[1]) + 1
        ? distances(p, pixels[i - 1])
        : 0,
  }));
  const bad = comparisons.filter((x) => x.meanDifference > 3);
  const report = {
    mode,
    scale,
    concurrency,
    frames: files.length,
    badFrames: bad.length,
    largest: comparisons.sort((a, b) => b.meanDifference - a.meanDifference).slice(0, 6),
  };
  fs.writeFileSync(`previews/diagnostics/probe-${mode}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (bad.length) process.exitCode = 1;
} finally {
  await browser.close({ silent: true });
}
