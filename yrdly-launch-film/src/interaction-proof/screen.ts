import { staticFile } from 'remotion';
import { interaction, move } from './timeline';

// Offline canvas adaptation of catalog.tsx and events/[id]/index.tsx.
// All displayed records are approved authored campaign examples, not live data.
export const SW = 393;
export const SH = 852;
const G = '#82DB7E';
const LABEL = 'rgba(255,255,255,.38)';
const BORDER = 'rgba(255,255,255,.09)';
type Ctx = CanvasRenderingContext2D;
export type ScreenAssets = { images: Record<string, HTMLImageElement>; glyphs: Record<string, Record<string, number>> };

const paths: Record<string, string> = {
  courtyard: 'campaign/courtyard-sessions.png',
  books: 'campaign/enugu-book-circle.png',
  chair: 'isolated-ui/marketplace-card-campaign.png',
  camera: 'isolated-ui/marketplace2-card-campaign.png',
  home: 'navigation/home.svg', explore: 'navigation/explore.svg',
  messages: 'navigation/messages.svg', profile: 'navigation/profile.svg',
};
export async function loadScreenAssets(): Promise<ScreenAssets> {
  const fonts = [
    ['UIOutfit', 'Outfit_700Bold.ttf', '700'], ['UIOutfit', 'Outfit_800ExtraBold.ttf', '800'],
    ['UIInter', 'Inter_400Regular.ttf', '400'], ['UIInter', 'Inter_500Medium.ttf', '500'],
    ['UIInter', 'Inter_600SemiBold.ttf', '600'], ['UIInter', 'Inter_700Bold.ttf', '700'],
    ['Ionicons', 'Ionicons.ttf', '400'], ['Feather', 'Feather.ttf', '400'],
  ];
  await Promise.all(fonts.map(async ([family, file, weight]) => {
    const face = new FontFace(family, `url(${staticFile(`brand/fonts/${file}`)})`, { weight });
    document.fonts.add(await face.load());
  }));
  const images = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => {
    const img = new Image(); img.src = staticFile(path); await img.decode(); return [key, img];
  })));
  const response = await fetch(staticFile('interaction-proof/glyphs.json'));
  if (!response.ok) throw Error('Could not load original mobile icon map');
  return { images, glyphs: await response.json() };
}

function round(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function text(ctx: Ctx, value: string, x: number, y: number, size = 14, color = '#fff', weight = 400, family = 'UIInter') {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${family}`; ctx.textBaseline = 'top'; ctx.fillText(value, x, y);
}
function icon(ctx: Ctx, assets: ScreenAssets, name: string, x: number, y: number, size = 20, color = '#fff', family = 'Ionicons') {
  const code = assets.glyphs[family][name];
  if (!code) throw Error(`Missing original icon ${family}/${name}`);
  text(ctx, String.fromCodePoint(code), x, y, size, color, 400, family);
}
function cover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = w / s, ih = h / s;
  ctx.drawImage(img, (img.naturalWidth - iw) / 2, (img.naturalHeight - ih) / 2, iw, ih, x, y, w, h);
}
function status(ctx: Ctx) {
  text(ctx, '9:41', 30, 18, 15, '#fff', 600);
  for (let i = 0; i < 4; i++) round(ctx, 301 + i * 4, 28 - i * 2, 3, 4 + i * 2, 1, '#fff');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(329, 31, 3 + i * 4, -2.35, -.79); ctx.stroke(); }
  round(ctx, 346, 20, 23, 11, 3, 'transparent', '#bbb');
  round(ctx, 348, 22, 18, 7, 1, '#fff'); round(ctx, 370, 23, 2, 5, 1, '#aaa');
}
function nav(ctx: Ctx, assets: ScreenAssets) {
  round(ctx, 12, 760, 369, 64, 32, '#111612', '#29332b');
  ['home', 'explore', 'create', 'messages', 'profile'].forEach((name, i) => {
    const x = 48 + i * 74;
    if (name === 'create') { round(ctx, x - 23, 769, 46, 46, 23, G); text(ctx, '+', x - 12, 772, 32, '#050505', 700, 'UIOutfit'); }
    else {
      ctx.save(); ctx.globalAlpha = name === 'explore' ? 1 : .65;
      ctx.filter = 'brightness(0) invert(1)';
      ctx.drawImage(assets.images[name], x - 11, 774, 22, 22); ctx.restore();
      const label = name[0].toUpperCase() + name.slice(1);
      ctx.font = '500 9px UIInter';
      text(ctx, label, x - ctx.measureText(label).width / 2, 801, 9, name === 'explore' ? G : '#aab2aa', 500);
    }
  });
}
function header(ctx: Ctx, assets: ScreenAssets, events: boolean) {
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, SW, 179);
  text(ctx, 'Explore', 20, 66, 24, '#fff', 800, 'UIOutfit');
  icon(ctx, assets, 'location-outline', 20, 99, 13, LABEL);
  text(ctx, 'All neighbourhoods', 37, 99, 13, LABEL, 500);
  icon(ctx, assets, 'chevron-down', 158, 99, 13, LABEL);
  round(ctx, 289, 74, 38, 38, 19, '#141414', BORDER);
  round(ctx, 335, 74, 38, 38, 19, '#141414', BORDER);
  icon(ctx, assets, 'search-outline', 299, 84, 18);
  icon(ctx, assets, 'notifications-outline', 345, 84, 18);
  let x = 20;
  ['Discover', 'Marketplace', 'Events', 'Business'].forEach((label, i) => {
    const selected = i === (events ? 2 : 1);
    ctx.font = '400 13px UIInter'; const width = ctx.measureText(label).width + 36;
    round(ctx, x, 128, width, 36, 18, selected ? G : '#050505', selected ? G : BORDER);
    text(ctx, label, x + 18, 139, 13, selected ? '#000' : LABEL, selected ? 700 : 400); x += width + 8;
  });
}
function eventCard(ctx: Ctx, assets: ScreenAssets, y: number, second = false) {
  const x = 20, w = 353;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, 230, 24); ctx.clip();
  ctx.fillStyle = '#0A0A0A'; ctx.fillRect(x, y, w, 230);
  cover(ctx, assets.images[second ? 'books' : 'courtyard'], x, y, w, 160);
  round(ctx, x + 12, y + 12, 63, 24, 10, 'rgba(15,23,18,.88)', BORDER);
  text(ctx, second ? 'Nov 21' : 'Nov 14', x + 22, y + 18, 12, '#fff', 700, 'UIOutfit');
  round(ctx, x + w - 40, y + 10, 30, 30, 15, 'rgba(15,23,18,.88)');
  icon(ctx, assets, 'bookmark-outline', x + w - 33, y + 17, 16);
  round(ctx, x + w - 63, y + 126, 51, 23, 8, 'rgba(15,23,18,.88)', '#3e6344');
  text(ctx, 'FREE', x + w - 53, y + 132, 11, G, 700);
  text(ctx, second ? 'Books & Good Company' : 'Courtyard Sessions', x + 16, y + 174, 16, '#fff', 700, 'UIOutfit');
  icon(ctx, assets, 'time-outline', x + 16, y + 201, 12, LABEL);
  text(ctx, second ? '11:00' : '16:00', x + 32, y + 201, 12, LABEL);
  icon(ctx, assets, 'location-outline', x + 87, y + 201, 12, LABEL);
  text(ctx, second ? 'Enugu' : 'Wuse II, Abuja', x + 103, y + 201, 12, LABEL);
  icon(ctx, assets, 'people-outline', x + 249, y + 201, 12, LABEL);
  text(ctx, second ? '18 going' : '24 going', x + 265, y + 201, 12, LABEL);
  ctx.restore(); round(ctx, x, y, w, 230, 24, 'transparent', BORDER);
}
function catalog(ctx: Ctx, assets: ScreenAssets, t: number) {
  const state = interaction(t);
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, SW, SH);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 236, SW, 516); ctx.clip();
  if (state.events) {
    eventCard(ctx, assets, 236 - state.listScroll);
    eventCard(ctx, assets, 482 - state.listScroll, true);
  } else {
    for (let i = 0; i < 2; i++) {
      const img = assets.images[i % 2 ? 'camera' : 'chair'];
      const h = 168.5 * img.naturalHeight / img.naturalWidth;
      ctx.drawImage(img, 20 + (i % 2) * 184.5, 236 + Math.floor(i / 2) * (h + 16), 168.5, h);
    }
  }
  ctx.restore();
  header(ctx, assets, state.events);
  round(ctx, 20, 190, state.events ? 105 : 137, 33, 17, '#131313', BORDER);
  text(ctx, state.events ? 'Filter: All' : 'Category: All', 36, 200, 13, '#fff', 500);
  icon(ctx, assets, 'chevron-down', state.events ? 102 : 134, 200, 14, LABEL);
  nav(ctx, assets);
}
function detail(ctx: Ctx, assets: ScreenAssets, t: number) {
  const state = interaction(t);
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, SW, SH);
  ctx.save(); ctx.translate(0, -state.detailScroll);
  ctx.save(); ctx.beginPath(); ctx.roundRect(0, -32, SW, 346, 32); ctx.clip();
  cover(ctx, assets.images.books, 0, 0, SW, 314); ctx.restore();
  text(ctx, 'Books & Good', 16, 332, 26, '#fff', 800, 'UIOutfit');
  text(ctx, 'Company', 16, 364, 26, '#fff', 800, 'UIOutfit');
  round(ctx, 284, 335, 93, 26, 13, '#19301c');
  text(ctx, 'Upcoming', 295, 342, 12, G, 700);
  round(ctx, 16, 416, 361, 342, 24, '#131313', BORDER);
  const rows = [
    ['calendar', 'Date', 'Saturday, November 21'],
    ['clock', 'Time', '11:00 AM'],
    ['map-pin', 'Location', 'Independence Layout, Enugu'],
    ['users', 'Attendees', '18 attending'],
  ];
  rows.forEach(([symbol, label, value], i) => {
    const y = 436 + i * 60;
    round(ctx, 36, y, 44, 44, 12, '#1b281b');
    icon(ctx, assets, symbol, 48, y + 12, 20, G, 'Feather');
    text(ctx, label, 96, y + 2, 13, LABEL);
    if (i === 2) { text(ctx, 'Independence Layout,', 96, y + 20, 14, '#fff', 600); text(ctx, 'Enugu', 96, y + 37, 14, '#fff', 600); }
    else text(ctx, value, 96, y + 22, i === 0 ? 14 : 16, '#fff', 600);
  });
  round(ctx, 36, 698, 321, 40, 16, G);
  icon(ctx, assets, 'navigation', 125, 709, 18, '#000', 'Feather');
  text(ctx, 'Get Directions', 151, 710, 14, '#000', 800, 'UIOutfit');
  round(ctx, 16, 774, 361, 192, 24, '#131313', BORDER);
  text(ctx, 'About this event', 36, 795, 20, '#fff', 700, 'UIOutfit');
  ['Bring a book you love. Leave with a new', 'recommendation and good company.', 'An easy Saturday morning of book swaps', 'and conversations in Enugu.'].forEach((line, i) => text(ctx, line, 36, 832 + i * 23, 14, '#aaa'));
  ctx.restore();
  ctx.save(); ctx.globalAlpha = move(state.detailScroll, 30, 150, 0, 1);
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, SW, 118); ctx.restore();
  for (const x of [16, 281, 337]) round(ctx, x, 66, 40, 40, 20, 'rgba(0,0,0,.5)');
  icon(ctx, assets, 'chevron-back', 22, 72, 28);
  icon(ctx, assets, 'share', 291, 76, 20, '#fff', 'Feather');
  icon(ctx, assets, state.bookmarked ? 'bookmark' : 'bookmark-outline', 347, 76, 20, state.bookmarked ? G : '#fff');
  ctx.fillStyle = '#101310'; ctx.fillRect(0, 758, SW, 94);
  ctx.fillStyle = BORDER; ctx.fillRect(0, 758, SW, 1);
  round(ctx, 20, 774, 353, 48, 24, G); text(ctx, 'View Tickets', 145, 789, 16, '#050505', 700, 'UIOutfit');
}
function touch(ctx: Ctx, t: number, start: number, end: number, x: number, y: number, targetY = y, tap = false) {
  if (t < start || t > end) return;
  const progress = move(t, start + .08, end - .15, 0, 1);
  const opacity = move(t, start, start + .1, 0, 1) * move(t, end - .12, end, 1, 0);
  const yy = y + (targetY - y) * progress;
  ctx.save(); ctx.globalAlpha = opacity;
  ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
  round(ctx, x - 8, yy - 8, 16, 16, 8, 'rgba(255,255,255,.82)', '#fff');
  ctx.shadowBlur = 0;
  const radius = tap ? 14 + progress * 13 : 16;
  ctx.beginPath(); ctx.arc(x, yy, radius, 0, Math.PI * 2); ctx.strokeStyle = `rgba(130,219,126,${tap ? .8 * (1 - progress) : .5})`; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.restore();
}
export function drawScreen(ctx: Ctx, assets: ScreenAssets, t: number, resolution = 3) {
  ctx.save(); ctx.scale(resolution, resolution); ctx.clearRect(0, 0, SW, SH);
  const state = interaction(t);
  ctx.save(); ctx.translate(-state.detail * 112, 0); catalog(ctx, assets, t); ctx.restore();
  if (state.detail > 0) {
    ctx.save(); ctx.translate((1 - state.detail) * SW, 0); detail(ctx, assets, t); ctx.restore();
  }
  touch(ctx, t, 1.48, 1.98, 300, 147, 147, true);
  touch(ctx, t, 3.02, 4.18, 286, 614, 554);
  touch(ctx, t, 4.62, 5.03, 184, 510, 510, true);
  touch(ctx, t, 7.42, 8.65, 325, 637, 379);
  touch(ctx, t, 10.37, 10.92, 357, 86, 86, true);
  touch(ctx, t, 11.22, 12.3, 324, 260, 518);
  // The iOS status bar stays fixed while the application route slides beneath it.
  status(ctx);
  round(ctx, 132, 839, 129, 5, 3, '#f2f2f2');
  ctx.restore();
}
