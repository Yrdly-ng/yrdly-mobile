// Original deterministic score: all instruments synthesized here; no samples or external tracks.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { ffmpeg } from './media-tools.mjs';
import { campaignPlans } from './campaign-plans.mjs';

const SR = 48000, TAU = Math.PI * 2, beat = .5;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const chords = [[50, 57, 61, 66, 76], [47, 54, 57, 62, 73], [43, 50, 54, 59, 69], [45, 52, 54, 61, 71]];
const directory = 'assets/audio';
fs.mkdirSync(directory, { recursive: true });
const provenance = { title: 'Closer / original campaign score', bpm: 120, sampleRate: SR, authorship: 'Original notes, arrangement, instrument synthesis and effects authored for this campaign. No third-party samples, recordings or melodies intentionally used.', reproduction: 'node scripts/compose-audio.mjs', reviewStatus: fs.existsSync('storyboard/approval.json') && JSON.parse(fs.readFileSync('storyboard/approval.json')).visualAndAudioApproved ? 'Approved by the user with all seven sound-enabled edits' : 'Sound review pending', edits: [] };

function wav(file, channels, gain = 1) {
  const n = channels[0].length;
  const buffer = Buffer.alloc(44 + n * 4);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SR, 24); buffer.writeUInt32LE(SR * 4, 28); buffer.writeUInt16LE(4, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i] * gain)) * 32767), 44 + i * 4 + c * 2);
  fs.writeFileSync(file, buffer);
}

for (const [index, plan] of campaignPlans.entries()) {
  const n = Math.round(plan.seconds * SR);
  const music = [new Float64Array(n), new Float64Array(n)];
  const effects = [new Float64Array(n), new Float64Array(n)];
  let seed = 314159 + index * 7919;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
  const score = [];
  function add(bus, at, duration, amplitude, pan, voice, label) {
    const first = Math.round(at * SR), count = Math.round(duration * SR);
    const left = Math.cos((pan + 1) * Math.PI / 4), right = Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < count; i++) {
      const p = first + i;
      if (p < 0 || p >= n) continue;
      const release = Math.min(1, (count - 1 - i) / (SR * .025));
      const sample = voice(i / SR, i) * amplitude * release;
      bus[0][p] += sample * left; bus[1][p] += sample * right;
    }
    score.push({ instrument: label, time: Number(at.toFixed(4)), duration, amplitude, pan });
  }
  function keys(at, note, amp = .11, pan = 0, length = 1.5) {
    const frequency = hz(note);
    add(music, at, length, amp, pan, (t) => {
      const attack = 1 - Math.exp(-t / .004);
      const fundamental = Math.sin(TAU * frequency * t + .85 * Math.sin(TAU * frequency * 2 * t) * Math.exp(-t * 9));
      return attack * (fundamental * Math.exp(-t / .52) + .16 * Math.sin(TAU * frequency * 3 * t) * Math.exp(-t / .13));
    }, `felt keys / MIDI ${note}`);
  }
  function pad(at, notes, duration, amp = .022) {
    notes.forEach((note, i) => {
      const frequency = hz(note);
      add(music, at, duration, amp, (i - 2) * .27, (t) => {
        const env = Math.min(1, t / .18) * Math.min(1, (duration - t) / .6);
        return env * (Math.sin(TAU * frequency * t) + .26 * Math.sin(TAU * frequency * 1.003 * t) + .10 * Math.sin(TAU * frequency * 2 * t));
      }, `warm pad / MIDI ${note}`);
    });
  }
  function bass(at, note, duration = .38, amp = .19) {
    const frequency = hz(note);
    add(music, at, duration, amp, 0, (t) => (1 - Math.exp(-t / .008)) * Math.exp(-t / .22) * (Math.sin(TAU * frequency * t) + .20 * Math.sin(TAU * frequency * 2 * t) + .07 * Math.sin(TAU * frequency * 3 * t)), `rounded bass / MIDI ${note}`);
  }
  function kick(at, amp = .25) {
    add(music, at, .4, amp, 0, (t) => Math.sin(TAU * (47 * t + 4.8 * (1 - Math.exp(-t * 24)))) * Math.exp(-t * 12) * Math.min(1, t / .002), 'soft kick');
  }
  function snap(at, amp = .055) {
    let low = 0;
    add(music, at, .14, amp, .12, (t) => { const noise = random(); low += .16 * (noise - low); return (noise - low) * Math.exp(-t * 39) + .35 * Math.sin(TAU * 1850 * t) * Math.exp(-t * 110); }, 'brushed snap');
  }
  function hat(at, amp = .025, pan = -.25) {
    let low = 0;
    add(music, at, .075, amp, pan, (t) => { const noise = random(); low += .25 * (noise - low); return (noise - low) * Math.exp(-t * 85) * Math.min(1, t / .001); }, 'soft tick');
  }
  function tactile(at, pan = 0) {
    add(effects, at, .11, .045, pan, (t) => (Math.sin(TAU * 720 * t) + .4 * Math.sin(TAU * 1160 * t)) * Math.exp(-t * 72) * Math.min(1, t / .002), 'interface tap');
  }
  function sweep(at, pan = 0) {
    let filtered = 0;
    add(effects, at - .18, .35, .022, pan, (t) => {
      filtered += .09 * (random() - filtered);
      return filtered * Math.sin(Math.PI * t / .35) ** 2;
    }, 'air transition');
  }

  const harmonyOffset = plan.seconds === 6 ? index % 4 : 0;
  for (let bar = 0; bar * 2 < plan.brand - .3; bar++) {
    const start = bar * 2, chord = chords[(Math.floor(bar / 2) + harmonyOffset) % chords.length];
    const available = plan.brand - start;
    if (bar % 2 === 0) pad(start, chord, Math.min(4.4, available + .5));
    // Short motifs leave room for the interface and signature; no continuous arpeggio bed.
    const motif = [[0, chord[3] + 12], [.75, chord[4]], [1.5, chord[2] + 12], [3, chord[1] + 12]];
    for (const [position, note] of motif) {
      const at = start + position * beat;
      if (at < plan.brand - .35 && (bar % 2 === 0 || position < 1)) keys(at, note, .09, position % 2 ? .25 : -.25, 1.3);
    }
    const body = plan.audio !== 'main' || start >= 2;
    if (body) {
      for (const position of [0, 1.5, 2, 3.25]) {
        const at = start + position * beat;
        if (at < plan.brand - .35) { kick(at, position === 0 ? .24 : .17); bass(at + .035, chord[0] - 12 + (position === 3.25 ? 7 : 0), .40, .17); }
      }
      for (const position of [1, 3]) if (start + position * beat < plan.brand - .35) snap(start + position * beat, .055);
      for (const position of [.5, 1.5, 2.5, 3.5]) if (start + position * beat < plan.brand - .35) hat(start + position * beat + .012, .022, position < 2 ? -.35 : .35);
    }
  }

  tactile(.05, -.12);
  plan.cues.forEach((time, i) => { tactile(time, i % 2 ? .18 : -.18); if (i % 2 === 0) sweep(time); });
  // D–E–A ascending signature, with a warm major-nine resolution and room for the CTA.
  pad(plan.brand, chords[0], plan.seconds - plan.brand, .029);
  [74, 76, 81].forEach((note, i) => keys(plan.brand + i * .18, note, .15 - i * .008, (i - 1) * .2, Math.min(2.6, plan.seconds - plan.brand - i * .18)));
  bass(plan.brand + .015, 38, .85, .12);

  // Restrained stereo room: high-pass the send to keep the kick/bass focused.
  const dry = music.map((channel) => channel.slice());
  for (let c = 0; c < 2; c++) {
    let hp = 0, previous = 0;
    const filtered = new Float64Array(n);
    for (let i = 0; i < n; i++) { hp = .97 * (hp + dry[c][i] - previous); previous = dry[c][i]; filtered[i] = hp; }
    for (const [seconds, gain] of [[.093, .12], [.1875, .09], [.281, .055], [.375, .03]]) {
      const delay = Math.round(seconds * SR);
      for (let i = delay; i < n; i++) music[1 - c][i] += filtered[i - delay] * gain;
    }
  }
  const mix = [new Float64Array(n), new Float64Array(n)];
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / (SR * .004), (n - 1 - i) / (SR * .3));
    for (let c = 0; c < 2; c++) { music[c][i] *= fade; effects[c][i] *= fade; mix[c][i] = music[c][i] + effects[c][i]; peak = Math.max(peak, Math.abs(mix[c][i])); }
  }
  const gain = Math.min(1, .82 / peak);
  wav(`${directory}/${plan.audio}-music.wav`, music, gain);
  wav(`${directory}/${plan.audio}-sfx.wav`, effects, gain);
  const raw = `${directory}/${plan.audio}-premaster.wav`, target = `${directory}/${plan.audio}-mix.wav`;
  wav(raw, mix, gain);
  // FFmpeg writes loudness measurements to stderr, so capture that stream explicitly.
  const measurement = spawnSync(ffmpeg, ['-hide_banner', '-i', raw, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  if (measurement.status !== 0) throw Error(measurement.stderr);
  const stats = JSON.parse(measurement.stderr.slice(measurement.stderr.lastIndexOf('{')));
  const filter = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
  execFileSync(ffmpeg, ['-y', '-v', 'error', '-i', raw, '-af', filter, '-ar', String(SR), '-c:a', 'pcm_s16le', target]);
  fs.writeFileSync(`${directory}/${plan.audio}-score.json`, JSON.stringify({ ...plan, bpm: 120, seed: 314159 + index * 7919, masterFilter: filter, rawGain: gain, events: score }, null, 2));
  provenance.edits.push({ name: plan.name, file: target, seconds: plan.seconds, sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'), measuredPremaster: stats });
  console.log(`${plan.audio}: original stereo score and effects / ${plan.seconds}s / mastered to -16 LUFS target`);
}
fs.writeFileSync(`${directory}/PROVENANCE.json`, JSON.stringify(provenance, null, 2) + '\n');
