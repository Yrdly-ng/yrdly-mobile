import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ffprobe } from './media-tools.mjs';
const manifestPath = 'assets/asset-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath));
for (const name of fs.readdirSync('assets/audio').filter((name) => /\.(wav|json)$/.test(name))) {
  const filename = `assets/audio/${name}`;
  const isWave = name.endsWith('.wav');
  const audio = isWave ? JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', filename], { encoding: 'utf8' })) : null;
  manifest.assets = manifest.assets.filter((asset) => asset.filename !== filename);
  manifest.assets.push({ filename, sourceScreen: 'Original campaign composition', captureMethod: 'Deterministic oscillator/noise synthesis and original authored arrangement; no third-party samples', dimensions: null, durationSeconds: audio ? Number(audio.format.duration) : null, channels: audio?.streams[0]?.channels ?? null, sampleRate: audio?.streams[0]?.sample_rate ?? null, intendedUse: name.includes('mix') ? 'Sound-enabled film mix' : name.includes('score') ? 'Editable note and cue sequence' : 'Editable music/effects stem or provenance', assetType: isWave ? 'original audio' : 'audio score/provenance', authenticationPrivacy: 'No recordings, voices, accounts or private data', authenticity: 'authored', marketingStatus: JSON.parse(fs.readFileSync('storyboard/approval.json')).visualAndAudioApproved ? 'Original sound approved by user' : 'Original sound; review pending', sha256: crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') });
}
for (const asset of manifest.assets) {
  if (!fs.existsSync(asset.filename)) throw Error(`Missing ${asset.filename}`);
  if (crypto.createHash('sha256').update(fs.readFileSync(asset.filename)).digest('hex') !== asset.sha256) throw Error(`Hash mismatch ${asset.filename}`);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Verified ${manifest.assets.length} manifest assets, including original score/stems.`);
