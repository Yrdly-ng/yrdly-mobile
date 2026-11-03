import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ffmpeg } from './media-tools.mjs';
const paths = process.argv.slice(2);
const files = paths.length
  ? paths
  : [
      'previews/yrdly-launch-main-36s-draft-v2.mp4',
      'previews/yrdly-launch-social-15s-draft-v2.mp4',
    ];
const W = 160,
  H = 90,
  S = W * H;
const reports = [];
for (const file of files) {
  const raw = execFileSync(
    ffmpeg,
    [
      '-v',
      'error',
      '-i',
      file,
      '-vf',
      `scale=${W}:${H}:flags=area,format=gray`,
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 100 * 1024 * 1024 }
  );
  const count = raw.length / S,
    diffs = [0],
    affected = [0];
  const distance = (a, b) => {
    let sum = 0,
      big = 0;
    for (let p = 0; p < S; p++) {
      const d = Math.abs(raw[a * S + p] - raw[b * S + p]);
      sum += d;
      if (d > 35) big++;
    }
    return { mean: sum / S, affected: big / S };
  };
  for (let i = 1; i < count; i++) {
    const d = distance(i, i - 1);
    diffs.push(d.mean);
    affected.push(d.affected);
  }
  const spikes = [];
  const jumps = [];
  for (let i = 2; i < count - 2; i++) {
    const outer = distance(i - 1, i + 1).mean;
    if (Math.min(diffs[i], diffs[i + 1]) > 6 && outer < Math.min(diffs[i], diffs[i + 1]) * 0.35)
      spikes.push({ frame: i, time: i / 60, before: diffs[i], after: diffs[i + 1], outer });
    const local = diffs
      .slice(Math.max(1, i - 5), i)
      .concat(diffs.slice(i + 1, i + 6))
      .sort((a, b) => a - b);
    const baseline = local[Math.floor(local.length / 2)];
    if (diffs[i] > 10 && diffs[i] > Math.max(1, baseline) * 4 && affected[i] > 0.12)
      jumps.push({ frame: i, time: i / 60, delta: diffs[i], baseline, affected: affected[i] });
  }
  const largest = diffs
    .map((d, i) => ({ frame: i, time: i / 60, delta: d, affected: affected[i] }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 12);
  reports.push({ file, frames: count, spikes, jumps, largest });
  console.log(
    JSON.stringify(
      {
        file,
        frames: count,
        spikeCount: spikes.length,
        jumpCount: jumps.length,
        spikes: spikes.slice(0, 4),
        jumps: jumps.slice(0, 4),
      },
      null,
      2
    )
  );
}
fs.mkdirSync('previews/diagnostics', { recursive: true });
fs.writeFileSync(process.env.TEMPORAL_REPORT || 'previews/diagnostics/temporal-analysis.json', JSON.stringify(reports, null, 2));
if (reports.some((r) => r.spikes.length || r.jumps.length)) process.exitCode = 1;
