import fs from 'node:fs';
import sharp from 'sharp';
const dir = 'previews/stills';
for (const [prefix, cols, w, h] of [
  ['YrdlyMain36', 3, 480, 270],
  ['YrdlySocial15', 4, 270, 480],
]) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
    .sort();
  const gap = 24,
    header = 90,
    cellH = h + 38,
    rows = Math.ceil(files.length / cols),
    width = cols * w + (cols + 1) * gap,
    height = header + rows * (cellH + gap);
  const layers = [
    {
      input: Buffer.from(
        `<svg width="${width}" height="80"><text x="24" y="48" fill="#82DB7E" font-size="26" font-family="Arial">YRDLY / ${prefix === 'YrdlyMain36' ? 'MAIN FILM' : 'SOCIAL EDIT'} / MOTION DRAFT</text></svg>`
      ),
      top: 0,
      left: 0,
    },
  ];
  for (let i = 0; i < files.length; i++) {
    const frame = Number(files[i].split('-').pop().split('.')[0]);
    const left = gap + (i % cols) * (w + gap),
      top = header + Math.floor(i / cols) * (cellH + gap);
    layers.push({ input: await sharp(`${dir}/${files[i]}`).resize(w, h).toBuffer(), top, left });
    layers.push({
      input: Buffer.from(
        `<svg width="${w}" height="32"><text x="0" y="23" fill="#f2f0e7" font-size="16" font-family="Arial">${(frame / 60).toFixed(2)}s / frame ${frame}</text></svg>`
      ),
      left,
      top: top + h + 2,
    });
  }
  await sharp({ create: { width, height, channels: 3, background: '#0b160f' } })
    .composite(layers)
    .png()
    .toFile(`previews/${prefix}-contact-sheet.png`);
  console.log(`${prefix}: ${files.length} frames`);
}
