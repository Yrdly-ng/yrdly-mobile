import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { ffmpeg } from './media-tools.mjs';
import { campaignPlans } from './campaign-plans.mjs';

const final = process.argv.includes('--final');
const encoded = final || process.argv.includes('--encoded');
const directory = final ? 'output' : 'previews/sound-review';
const suffix = final ? '' : '-sound-review';
const assetsPath = final ? '../assets' : '../../assets';
fs.mkdirSync(`${directory}/encoded-frames`, { recursive: true });
const label = (text, width, size = 18) => Buffer.from(`<svg width="${width}" height="60"><text x="0" y="32" font-family="Arial" font-size="${size}" fill="#f2f0e7">${text}</text></svg>`);
for (const plan of campaignPlans) {
  const w = plan.vertical ? 270 : 480, h = plan.vertical ? 480 : 270;
  const cols = plan.vertical ? Math.min(4, plan.stills.length) : 3;
  const width = cols * (w + 24) + 24, height = 90 + Math.ceil(plan.stills.length / cols) * (h + 65);
  const layers = [{ input: label(`YRDLY / ${plan.name.toUpperCase()} / ${encoded ? 'DECODED MP4' : 'COMPOSITION FRAMES'}`, width - 48, 24), left: 24, top: 15 }];
  for (const [i, frame] of plan.stills.entries()) {
    const name = `${plan.id}-${String(frame).padStart(4, '0')}.png`;
    const target = path.join(directory, encoded ? 'encoded-frames' : 'stills', name);
    if (encoded) execFileSync(ffmpeg, ['-y', '-v', 'error', '-ss', String(frame / 60), '-i', `${directory}/${plan.stem}${suffix}.mp4`, '-frames:v', '1', target]);
    const stats = await sharp(target).stats();
    if (stats.channels.every((channel) => channel.stdev < 1)) throw Error(`Blank frame ${target}`);
    const left = 24 + (i % cols) * (w + 24), top = 85 + Math.floor(i / cols) * (h + 65);
    layers.push({ input: await sharp(target).resize(w, h).png().toBuffer(), left, top });
    layers.push({ input: label(`${(frame / 60).toFixed(2)}s`, w), left, top: top + h });
  }
  await sharp({ create: { width, height, channels: 3, background: '#0b160f' } }).composite(layers).png().toFile(`${directory}/${plan.id}-contact.png`);
  console.log(`${plan.id}: ${plan.stills.length} ${encoded ? 'encoded' : 'composition'} frames checked`);
}
const sections = campaignPlans.map((plan, i) => `<section id="${plan.audio}"><div class="section-title"><span>0${i + 1}</span><h2>${plan.name}</h2><small>${plan.seconds} SECONDS / ${plan.vertical ? 'PORTRAIT' : 'LANDSCAPE'}</small></div><video class="${plan.vertical ? 'portrait' : 'landscape'}" data-edit="${plan.audio}" controls playsinline preload="metadata" poster="stills/${plan.id}-${String(plan.stills[0]).padStart(4, '0')}.png"><source src="${plan.stem}${suffix}.mp4" type="video/mp4"></video><div class="links"><a href="${plan.stem}${suffix}.mp4">Open video ↗</a><a href="${plan.id}-contact.png">View frames ↗</a><a href="${assetsPath}/audio/${plan.audio}-mix.wav">Listen to score ↗</a></div></section>`).join('');
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>YRDLY / Campaign sound review</title><style>*{box-sizing:border-box}body{margin:0;background:#0b160f;color:#f2f0e7;font-family:Arial,sans-serif;padding:48px 6vw}header{max-width:1020px}header>small{color:#82db7e;letter-spacing:3px}h1{font-size:clamp(48px,7vw,100px);line-height:.98;letter-spacing:-4px;font-weight:750;margin:35px 0}p{max-width:850px;line-height:1.65;color:#bac8bd}nav,.links{display:flex;flex-wrap:wrap;gap:20px}a{color:#82db7e;text-underline-offset:5px}nav{padding:22px 0 30px;border-bottom:1px solid #294331}section{margin:48px 0 80px}.section-title{display:flex;flex-wrap:wrap;align-items:baseline;gap:20px}.section-title>span{color:#82db7e;font-size:14px}.section-title>small{color:#bac8bd;letter-spacing:1px}h2{font-size:30px;letter-spacing:-1px}video{display:block;width:100%;border-radius:12px;background:#142218}.landscape{max-width:1280px}.portrait{max-width:450px}.links{margin:20px 0;font-size:14px}details{max-width:900px;border-top:1px solid #294331;padding:25px 0}summary{cursor:pointer;color:#bac8bd}footer{color:#bac8bd;font-size:14px;margin:40px 0}@media(max-width:600px){body{padding:30px 22px}h1{letter-spacing:-2px}.section-title{gap:10px}h2{font-size:25px}}</style></head><body><header><small>YRDLY / SEVEN EDITS / SOUND REVIEW</small><h1>Your neighbourhood.<br>Closer.</h1><p>The approved campaign, now with original music and sound. The 8-second edit and four feature teasers are ready for their first motion review. All videos use clean pictures without the review labels.</p><p>Listen with sound on, then check the pacing and readability with sound off. These are 720p, 60 FPS review copies; full-resolution exports follow this review.</p></header><nav>${campaignPlans.map((p) => `<a href="#${p.audio}">${p.name}</a>`).join('')}</nav>${sections}<details><summary>Production and asset notes</summary><p>Interfaces are reconstructed from the YRDLY mobile source, not native iOS recordings. Artwork is AI-generated, and campaign names, prices, ratings and activity figures are authored illustrative scenarios. The user approved the visual treatment and removal of the on-screen labels. No listings or activity were created in production.</p><p>The original score and effects were synthesized specifically for this campaign without third-party samples. Sound and the new short edits await review. <a href="${assetsPath}/campaign/PROVENANCE.md">Content provenance</a> · <a href="${assetsPath}/audio/PROVENANCE.json">Audio provenance</a></p></details><footer>Local review only. No campaign files have been published or deployed.</footer></body></html>`;
if (final) html = html
  .replace('Campaign sound review', 'Final campaign films')
  .replace('YRDLY / SEVEN EDITS / SOUND REVIEW', 'YRDLY / FINAL CAMPAIGN / 60 FPS')
  .replace('The approved campaign, now with original music and sound. The 8-second edit and four feature teasers are ready for their first motion review. All videos use clean pictures without the review labels.', 'Seven approved films with original music and sound. Clean exports without review labels.')
  .replace('Listen with sound on, then check the pacing and readability with sound off. These are 720p, 60 FPS review copies; full-resolution exports follow this review.', 'Main film: 1920 × 1080. Vertical films: 1080 × 1920. All exports are H.264 MP4 at 60 FPS, with stereo AAC audio.')
  .replace('Sound and the new short edits await review.', 'The user approved all seven sound-enabled edits before these full-resolution renders.')
  .replace('Local review only. No campaign files have been published or deployed.', 'Delivered locally. No campaign files have been published or deployed.');
fs.writeFileSync(`${directory}/index.html`, html);
