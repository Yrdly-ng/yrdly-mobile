import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ffmpeg, ffprobe } from './media-tools.mjs';
const report = {
  checkedAt: new Date().toISOString(),
  status: 'draft',
  audio: 'Silent intentional timing draft; no soundtrack or music license asserted.',
  nativeCaptures: 0,
  content: 'Source-based UI with generated artwork and authored illustrative scenarios. User review pending.',
  files: [],
};
for (const [file, width, height, duration] of [
  ['yrdly-launch-main-36s-draft-v2.mp4', 1280, 720, 36],
  ['yrdly-launch-social-15s-draft-v2.mp4', 720, 1280, 15],
]) {
  const target = path.resolve('previews', file);
  const probe = JSON.parse(
    execFileSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', target], {
      encoding: 'utf8',
    })
  );
  const v = probe.streams.find((s) => s.codec_type === 'video');
  if (
    v.width !== width ||
    v.height !== height ||
    v.avg_frame_rate !== '60/1' ||
    v.codec_name !== 'h264' ||
    Math.abs(Number(probe.format.duration) - duration) > 0.02 ||
    Number(v.nb_frames) !== duration * 60
  )
    throw Error(`Unexpected media properties: ${file}`);
  execFileSync(ffmpeg, ['-v', 'error', '-i', target, '-f', 'null', '-'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const scan = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-i',
      target,
      '-vf',
      'blackdetect=d=0.05:pix_th=0.05',
      '-an',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' }
  );
  if (scan.status !== 0 || scan.stderr.includes('black_start:'))
    throw Error(`Black frame scan failed: ${file}`);
  report.files.push({
    filename: file,
    bytes: fs.statSync(target).size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
    width,
    height,
    duration: Number(probe.format.duration),
    fps: v.avg_frame_rate,
    frames: Number(v.nb_frames),
    codec: v.codec_name,
    pixelFormat: v.pix_fmt,
    audioStreams: probe.streams.filter((s) => s.codec_type === 'audio').length,
    fullDecode: 'passed',
    blackFrameScan: 'passed',
  });
  console.log(
    `${file}: valid H264 ${width}x${height} ${v.avg_frame_rate} ${duration}s; full decode passed`
  );
}
fs.writeFileSync('previews/verification.json', JSON.stringify(report, null, 2) + '\n');
