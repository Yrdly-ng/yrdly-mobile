import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { ffmpeg, ffprobe } from './media-tools.mjs';
import { campaignPlans } from './campaign-plans.mjs';

const final = process.argv.includes('--final');
const directory = final ? 'output' : 'previews/sound-review';
const audioOnly = process.argv.includes('--audio-only');
const report = { checkedAt: new Date().toISOString(), status: final ? 'final export verification' : 'sound review', files: [] };
for (const plan of campaignPlans) {
  const file = audioOnly ? `assets/audio/${plan.audio}-mix.wav` : `${directory}/${plan.stem}${final ? '' : '-sound-review'}.mp4`;
  const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }));
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  if (!audio || audio.channels !== 2 || audio.sample_rate !== '48000' || Math.abs(Number(probe.format.duration) - plan.seconds) > .05) throw Error(`Audio/duration mismatch: ${file}`);
  if (!audioOnly && (!video || video.width !== (plan.vertical ? (final ? 1080 : 720) : (final ? 1920 : 1280)) || video.height !== (plan.vertical ? (final ? 1920 : 1280) : (final ? 1080 : 720)) || video.avg_frame_rate !== '60/1' || Number(video.nb_frames) !== plan.seconds * 60 || video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p' || audio.codec_name !== 'aac')) throw Error(`Video specification mismatch: ${file}`);
  let audioSync = null;
  if (!audioOnly) {
    if (Math.abs(Number(audio.start_time)) > .02 || Math.abs(Number(video.start_time)) > .02 || Math.abs(Number(audio.duration) - plan.seconds) > .05) throw Error(`Audio timeline mismatch: ${file}`);
    const decodeAudio = (source) => {
      const raw = execFileSync(ffmpeg, ['-v', 'error', '-i', source, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], { maxBuffer: 8 * 1024 * 1024 });
      const samples = new Float32Array(raw.length / 4);
      for (let i = 0; i < samples.length; i++) samples[i] = raw.readFloatLE(i * 4);
      return samples;
    };
    const reference = decodeAudio(`assets/audio/${plan.audio}-mix.wav`), encoded = decodeAudio(file);
    let best = { correlation: -1, offsetSamples: 0 };
    for (let offset = -160; offset <= 160; offset++) {
      let dot = 0, a2 = 0, b2 = 0;
      for (let i = 800; i < Math.min(reference.length, encoded.length) - 800; i += 4) {
        const a = reference[i], b = encoded[i + offset];
        dot += a * b; a2 += a * a; b2 += b * b;
      }
      const correlation = dot / Math.sqrt(a2 * b2);
      if (correlation > best.correlation) best = { correlation, offsetSamples: offset };
    }
    audioSync = { correlation: best.correlation, offsetMilliseconds: best.offsetSamples / 8 };
    if (best.correlation < .95 || Math.abs(best.offsetSamples) > 80) throw Error(`Encoded soundtrack differs or is shifted: ${file} ${JSON.stringify(audioSync)}`);
  }
  execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (!audioOnly) {
    const scan = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.05:pix_th=0.05', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
    if (scan.status !== 0 || scan.stderr.includes('black_start:')) throw Error(`Black frame: ${file}`);
  }
  const measurement = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  if (measurement.status !== 0) throw Error(`Loudness measurement failed: ${file}`);
  const loudness = JSON.parse(measurement.stderr.slice(measurement.stderr.lastIndexOf('{')));
  if (!Number.isFinite(Number(loudness.input_i)) || Math.abs(Number(loudness.input_i) + 16) > 1 || Number(loudness.input_tp) > -1) throw Error(`Audio level outside review target: ${file} / ${JSON.stringify(loudness)}`);
  report.files.push({ file, bytes: fs.statSync(file).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), duration: Number(probe.format.duration), width: video?.width, height: video?.height, fps: video?.avg_frame_rate, frames: video?.nb_frames, audioCodec: audio.codec_name, channels: audio.channels, sampleRate: audio.sample_rate, loudnessLUFS: Number(loudness.input_i), truePeakDBTP: Number(loudness.input_tp), audioSync, fullDecode: 'passed', blackFrames: audioOnly ? 'not applicable' : 'none detected' });
  console.log(`${plan.name}: ${plan.seconds}s / ${audioOnly ? 'stereo WAV' : 'H.264 + stereo AAC / 60fps'} / ${loudness.input_i} LUFS / ${loudness.input_tp} dBTP / passed`);
}
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(`${directory}/${audioOnly ? 'audio' : 'media'}-verification.json`, JSON.stringify(report, null, 2) + '\n');
if (!audioOnly) execFileSync(process.execPath, ['scripts/analyze-temporal.mjs', ...report.files.map((file) => file.file)], { stdio: 'inherit', env: { ...process.env, TEMPORAL_REPORT: `${directory}/temporal-analysis.json` } });
