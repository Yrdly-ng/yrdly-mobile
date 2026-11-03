import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { ffmpeg } from './media-tools.mjs';
fs.mkdirSync('previews/encoded-checks', { recursive: true });
for (const [kind, file, times, w, h, cols] of [
  ['main', 'yrdly-launch-main-36s-draft-v2.mp4', [0, 1, 4, 8, 14, 20, 26, 33.5, 35.9], 480, 270, 3],
  ['social', 'yrdly-launch-social-15s-draft-v2.mp4', [0.5, 3, 5.8, 7.5, 10, 13.5, 14.9], 270, 480, 4],
]) {
  const layers = [],
    gap = 24,
    width = cols * (w + gap) + gap,
    height = 60 + Math.ceil(times.length / cols) * (h + 60);
  for (const [i, t] of times.entries()) {
    const target = `previews/encoded-checks/${kind}-${String(i).padStart(2, '0')}.png`;
    execFileSync(ffmpeg, [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(t),
      '-i',
      `previews/${file}`,
      '-frames:v',
      '1',
      target,
    ]);
    const stats = await sharp(target).stats();
    if (stats.channels.every((c) => c.stdev < 1)) throw Error(`Blank encoded frame at ${t}`);
    const left = gap + (i % cols) * (w + gap),
      top = 50 + Math.floor(i / cols) * (h + 60);
    layers.push({ input: await sharp(target).resize(w, h).toBuffer(), left, top });
    layers.push({
      input: Buffer.from(
        `<svg width="${w}" height="32"><text x="0" y="24" font-size="18" font-family="Arial" fill="#f2f0e7">${t}s / decoded MP4</text></svg>`
      ),
      left,
      top: top + h,
    });
  }
  await sharp({ create: { width, height, channels: 3, background: '#0b160f' } })
    .composite(layers)
    .png()
    .toFile(`previews/encoded-${kind}-contact.png`);
  console.log(`${kind}: ${times.length} decoded frames inspected for nonblank pixels`);
}
