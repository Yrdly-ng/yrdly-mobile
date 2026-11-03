import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const manifestPath = 'assets/asset-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const photos = [
  'courtyard-sessions',
  'walnut-lounge-chair',
  'compact-camera',
  'daybreak-bakehouse',
  'enugu-book-circle',
];
for (const name of photos) {
  const filename = `assets/campaign/${name}.png`,
    m = await sharp(filename).metadata();
  manifest.assets = manifest.assets.filter((a) => a.filename !== filename);
  manifest.assets.push({
    filename,
    sourceScreen: 'Original campaign artwork; not an app or device capture',
    captureMethod:
      'Generated with the built-in image-generation tool under user authorization to create original campaign content',
    dimensions: { width: m.width, height: m.height },
    intendedUse: 'Photographic artwork within source-derived app cards',
    assetType: 'campaign photograph-style artwork',
    authenticationPrivacy:
      'Fictional people and scenes; no production data or real individual identity asserted',
    authenticity: 'generated',
    marketingStatus: 'Approved in revised main/social previews; illustrative content, not evidence of live activity',
    sha256: crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),
  });
}
for (const name of ['content.json', 'PROVENANCE.md']) {
  const filename = `assets/campaign/${name}`;
  manifest.assets = manifest.assets.filter((a) => a.filename !== filename);
  manifest.assets.push({
    filename,
    sourceScreen: 'Campaign creative development',
    captureMethod: 'Original authored campaign scenarios',
    dimensions: null,
    intendedUse: 'Editable names, copy, illustrative prices, ratings, counts and provenance',
    assetType: name.endsWith('.json') ? 'campaign content' : 'provenance',
    authenticationPrivacy: 'Fictional; never sent to a backend',
    authenticity: 'authored',
    marketingStatus: 'Approved illustrative campaign content; provenance retained outside films at user request',
    sha256: crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),
  });
}
for (const asset of manifest.assets.filter((a) => a.filename.endsWith('-campaign.png'))) {
  asset.authenticationPrivacy =
    'No account, backend or private data; original generated images and fictional authored campaign records';
  asset.intendedUse = 'Reconstructed source UI with authored campaign content';
  asset.marketingStatus = 'Approved source reconstruction and authored content; clean version without review banner';
}
manifest.notice =
  'Native captures remain zero. Original source assets, reconstructed UI, legacy placeholders and generated campaign imagery are individually classified.';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const text = (label, w) =>
  Buffer.from(
    `<svg width="${w}" height="42"><text x="0" y="29" font-family="Arial" font-size="20" fill="#f2f0e7">${label.replaceAll('&', '&amp;')}</text></svg>`
  );
const layers = [],
  w = 480,
  h = 320,
  gap = 28,
  cols = 3,
  width = cols * (w + gap) + gap,
  height = 2 * (h + 70) + 90;
layers.push({
  input: text('YRDLY / ORIGINAL CAMPAIGN ARTWORK / AI-GENERATED', width - 56),
  left: 28,
  top: 15,
});
for (let i = 0; i < photos.length; i++) {
  const x = gap + (i % cols) * (w + gap),
    y = 80 + Math.floor(i / cols) * (h + 70);
  layers.push({
    input: await sharp(`assets/campaign/${photos[i]}.png`)
      .resize(w, h, { fit: 'contain', background: '#183023' })
      .toBuffer(),
    left: x,
    top: y,
  });
  layers.push({ input: text(photos[i].replaceAll('-', ' '), w), left: x, top: y + h + 3 });
}
await sharp({ create: { width, height, channels: 3, background: '#0b160f' } })
  .composite(layers)
  .png()
  .toFile('review/campaign-artwork-contact-sheet.png');
const items = ['event', 'marketplace', 'business', 'community'];
const ui = [];
const uiW = 1312,
  uiH = 1330;
for (let i = 0; i < 4; i++) {
  const left = 24 + i * 322;
  ui.push({
    input: await sharp(`assets/screenshots/${items[i]}-screen-campaign.png`)
      .resize(298, 646)
      .toBuffer(),
    left,
    top: 70,
  });
  for (let j = 0; j < 2; j++) {
    ui.push({
      input: await sharp(`assets/isolated-ui/${items[i]}${j ? '2' : ''}-card-campaign.png`)
        .resize(298, 260, { fit: 'contain', background: '#142218' })
        .toBuffer(),
      left,
      top: 750 + j * 280,
    });
  }
}
ui.push({
  input: text('YRDLY / SOURCE COMPONENTS + ILLUSTRATIVE CAMPAIGN CONTENT', 1250),
  left: 24,
  top: 15,
});
await sharp({ create: { width: uiW, height: uiH, channels: 3, background: '#0b160f' } })
  .composite(ui)
  .png()
  .toFile('review/campaign-ui-contact-sheet.png');
console.log(
  `Manifest: ${manifest.assets.length} assets; campaign artwork and UI contact sheets saved.`
);
