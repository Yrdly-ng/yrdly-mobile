const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpegPath = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg');

const compositions = [
  { id: 'YrdlyPromo-Vertical', outName: 'YrdlyPromo-Vertical.mp4' },
  { id: 'YrdlyPromo-Landscape', outName: 'YrdlyPromo-Landscape.mp4' },
  { id: 'OnboardingFlow-Vertical', outName: 'OnboardingFlow-Vertical.mp4' },
  { id: 'OnboardingFlow-Landscape', outName: 'OnboardingFlow-Landscape.mp4' },
  { id: 'Scene7-Finale-Vertical', outName: 'Scene7-Finale-Vertical.mp4' },
  { id: 'Scene7-Finale-Landscape', outName: 'Scene7-Finale-Landscape.mp4' },
];

const outDir = path.join(__dirname, 'out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const comp of compositions) {
  console.log(`\n========================================`);
  console.log(`Rendering sequence for: ${comp.id}`);
  console.log(`========================================`);

  const seqDir = path.join(outDir, `${comp.id}-seq`);
  if (fs.existsSync(seqDir)) {
    fs.rmSync(seqDir, { recursive: true, force: true });
  }

  // 1. Render frame sequence
  const renderCmd = `npx remotion render ${comp.id} ${seqDir} --sequence`;
  console.log(`Executing: ${renderCmd}`);
  execSync(renderCmd, { stdio: 'inherit', cwd: __dirname });

  // 2. Stitch with ffmpeg-static (detect digit padding: %03d or %04d)
  const files = fs.readdirSync(seqDir);
  const sampleFile = files.find(f => f.startsWith('element-') && f.endsWith('.png'));
  const numDigits = sampleFile ? sampleFile.replace('element-', '').replace('.png', '').length : 3;
  const pattern = `element-%0${numDigits}d.png`;

  const mp4Path = path.join(outDir, comp.outName);
  const stitchCmd = `"${ffmpegPath}" -framerate 30 -i "${seqDir}/${pattern}" -c:v libx264 -pix_fmt yuv420p -y "${mp4Path}"`;
  console.log(`Stitching: ${stitchCmd}`);
  execSync(stitchCmd, { stdio: 'inherit', cwd: __dirname });

  console.log(`✅ Finished ${comp.outName}`);

  // Clean up sequence directory to save disk space
  fs.rmSync(seqDir, { recursive: true, force: true });
}

console.log('\n🎉 ALL REQUESTED VIDEOS RENDERED SUCCESSFULLY!');
