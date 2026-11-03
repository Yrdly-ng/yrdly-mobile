import { staticFile } from 'remotion';
import { drawScreen, loadScreenAssets, SW, SH, type ScreenAssets } from '../interaction-proof/screen';
import { move } from '../interaction-proof/timeline';

// Offline, source-derived iOS presentation. All records are authored campaign content.
// No network request to an application API and no actual membership/order is created.
const G = '#82DB7E';
const LABEL = 'rgba(255,255,255,.38)';
const BORDER = 'rgba(255,255,255,.09)';
type Ctx = CanvasRenderingContext2D;

export async function loadMainScreenAssets(): Promise<ScreenAssets> {
  const assets = await loadScreenAssets();
  const extra = {
    chairPhoto: 'campaign/walnut-lounge-chair.png',
    cameraPhoto: 'campaign/compact-camera.png',
    bakery: 'campaign/daybreak-bakehouse.png',
    businessCard: 'isolated-ui/business-card-campaign.png',
    businessCard2: 'isolated-ui/business2-card-campaign.png',
  };
  await Promise.all(Object.entries(extra).map(async ([key, path]) => {
    const img = new Image(); img.src = staticFile(path); await img.decode(); assets.images[key] = img;
  }));
  return assets;
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

function photo(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, r = 0) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip(); cover(ctx, img, x, y, w, h); ctx.restore();
}
function line(ctx: Ctx, y: number, x = 16, width = 361) { ctx.fillStyle = BORDER; ctx.fillRect(x, y, width, 1); }
function center(ctx: Ctx, value: string, x: number, y: number, width: number, size = 14, color = '#fff', weight = 600) {
  ctx.font = `${weight} ${size}px UIInter`;
  text(ctx, value, x + (width - ctx.measureText(value).width) / 2, y, size, color, weight);
}
function background(ctx: Ctx) { ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, SW, SH); }
function exploreHeader(ctx: Ctx, assets: ScreenAssets, business: boolean) {
  text(ctx, 'Explore', 20, 66, 24, '#fff', 800, 'UIOutfit');
  icon(ctx, assets, 'location-outline', 20, 99, 13, LABEL);
  text(ctx, 'All neighbourhoods', 37, 99, 13, LABEL, 500);
  icon(ctx, assets, 'chevron-down', 158, 99, 13, LABEL);
  [289, 335].forEach(x => round(ctx, x, 74, 38, 38, 19, '#141414', BORDER));
  icon(ctx, assets, 'search-outline', 299, 84, 18);
  icon(ctx, assets, 'notifications-outline', 345, 84, 18);
  // The real pill strip scrolls horizontally to bring Business fully into view.
  ctx.save(); ctx.beginPath(); ctx.rect(0, 126, SW, 42); ctx.clip();
  let x = business ? -80 : 20;
  ['Discover', 'Marketplace', 'Events', 'Business'].forEach((label, i) => {
    const selected = i === (business ? 3 : 1);
    ctx.font = '400 13px UIInter'; const w = ctx.measureText(label).width + 36;
    round(ctx, x, 128, w, 36, 18, selected ? G : '#050505', selected ? G : BORDER);
    text(ctx, label, x + 18, 139, 13, selected ? '#000' : LABEL, selected ? 700 : 400); x += w + 8;
  }); ctx.restore();
  round(ctx, 20, 190, 137, 33, 17, '#131313', BORDER);
  text(ctx, 'Category: All', 36, 200, 13, '#fff', 500);
  icon(ctx, assets, 'chevron-down', 134, 200, 14, LABEL);
}
function directory(ctx: Ctx, assets: ScreenAssets, business = false) {
  background(ctx); exploreHeader(ctx, assets, business);
  ['chair', 'camera'].forEach((key, i) => {
    const img = assets.images[business ? (i ? 'businessCard2' : 'businessCard') : key];
    const w = business ? 353 : 168.5, h = w * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(img, business ? 20 : 20 + i * 184.5, business ? 236 + i * (h + 16) : 236, w, h);
  }); nav(ctx, assets);
}
function marketplace(ctx: Ctx, assets: ScreenAssets, t: number) {
  background(ctx);
  const scroll = move(t, 4.4, 5.8, 0, 220) - move(t, 8.4, 9.6, 0, 220);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 44, SW, 714); ctx.clip(); ctx.translate(0, -scroll);
  photo(ctx, assets.images.chairPhoto, 0, 0, SW, 320);
  const shade = ctx.createLinearGradient(0, 205, 0, 320); shade.addColorStop(0, 'transparent'); shade.addColorStop(1, '#050505');
  ctx.fillStyle = shade; ctx.fillRect(0, 205, SW, 115);
  [20, 285, 333].forEach(x => round(ctx, x, 52, 40, 40, 20, 'rgba(0,0,0,.50)'));
  icon(ctx, assets, 'chevron-back', 28, 60, 24);
  icon(ctx, assets, t >= 9.9 ? 'bookmark' : 'bookmark-outline', 297, 64, 16, t >= 9.9 ? G : '#fff');
  icon(ctx, assets, 'ellipsis-horizontal', 345, 64, 16);
  text(ctx, 'Walnut lounge', 20, 340, 22, '#fff', 800, 'UIOutfit');
  text(ctx, 'chair', 20, 366, 22, '#fff', 800, 'UIOutfit');
  round(ctx, 287, 342, 86, 26, 8, '#131313', BORDER); text(ctx, 'Like new', 298, 348, 12, '#aaa', 600);
  text(ctx, '₦85,000', 20, 402, 28, G, 800, 'UIOutfit');
  icon(ctx, assets, 'location-outline', 20, 440, 14, LABEL); text(ctx, 'Gwarinpa, Abuja', 40, 440, 13, LABEL);
  round(ctx, 20, 478, 353, 80, 20, '#0A0A0A', BORDER);
  round(ctx, 36, 494, 48, 48, 24, '#20251d'); center(ctx, 'T', 36, 508, 48, 18, '#fff', 700);
  text(ctx, 'Tomi', 96, 496, 14, '#fff', 700, 'UIOutfit'); text(ctx, 'No ratings yet', 96, 518, 11, LABEL);
  round(ctx, 256, 502, 101, 32, 16, '#161616', BORDER); center(ctx, 'View Profile', 256, 512, 101, 12, '#aaa', 500);
  text(ctx, 'ABOUT THIS ITEM', 20, 590, 11, LABEL, 700);
  ['A warm walnut finish and an easy,', 'comfortable seat. A favourite reading', 'corner, ready for its next home.', '', 'Well cared for, with a solid wooden frame.', 'Collection in Gwarinpa, Abuja.'].forEach((s, i) => text(ctx, s, 20, 620 + i * 25.5, 15, '#b0b0b0'));
  ctx.restore();
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 758, SW, 94); line(ctx, 758, 0, SW);
  round(ctx, 20, 775, 169, 48, 24, G); center(ctx, 'Buy Now', 20, 791, 169, 14, '#050505', 700);
  round(ctx, 201, 775, 172, 48, 24, '#111', BORDER); center(ctx, 'Message Seller', 201, 791, 172, 13, '#fff', 600);
}
// Two product crops from the approved bakery photograph, not new stock imagery.
function bakeryCrop(ctx: Ctx, assets: ScreenAssets, x: number, y: number, w: number, h: number, pastry = false) {
  const img = assets.images.bakery;
  const rect = pastry ? [.0, .52, .31, .27] : [.31, .66, .48, .28];
  const regionW = rect[2] * img.naturalWidth, regionH = rect[3] * img.naturalHeight;
  const scale = Math.max(w / regionW, h / regionH);
  const cropW = w / scale, cropH = h / scale;
  ctx.drawImage(img, rect[0] * img.naturalWidth + (regionW - cropW) / 2, rect[1] * img.naturalHeight + (regionH - cropH) / 2, cropW, cropH, x, y, w, h);
}
function businessProfile(ctx: Ctx, assets: ScreenAssets, t: number) {
  background(ctx);
  const scroll = move(t, 4, 5, 0, 145);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 44, SW, 784); ctx.clip(); ctx.translate(0, -scroll);
  photo(ctx, assets.images.bakery, 0, 0, SW, 155);
  const shade = ctx.createLinearGradient(0, 0, 0, 155); shade.addColorStop(0, 'rgba(5,5,5,.1)'); shade.addColorStop(1, 'rgba(5,5,5,.72)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, SW, 155);
  icon(ctx, assets, 'chevron-back', 24, 64, 24);
  round(ctx, 17, 124, 70, 70, 21, '#050505'); photo(ctx, assets.images.bakery, 20, 127, 64, 64, 18);
  text(ctx, 'Daybreak Bakehouse', 20, 207, 24, '#fff', 700, 'UIOutfit');
  text(ctx, 'Bakery · Bodija, Ibadan', 20, 239, 14, LABEL);
  [['128', 'Followers', 20], ['2', 'Items', 110], ['4.8 ★', 'Rating', 174]].forEach(([value, label, x]) => {
    text(ctx, String(value), Number(x), 275, 16, '#fff', 700, 'UIOutfit'); text(ctx, String(label), Number(x), 299, 13, LABEL);
  });
  round(ctx, 20, 338, 171, 44, 12, '#142114'); icon(ctx, assets, 'chatbubbles', 56, 351, 18, G); text(ctx, 'Message', 82, 353, 14, G, 700, 'UIOutfit');
  round(ctx, 201, 338, 172, 44, 12, '#131313'); icon(ctx, assets, 'share-social', 247, 352, 16, '#aaa'); text(ctx, 'Share', 270, 353, 14);
  text(ctx, 'Catalog', 20, 407, 14, '#fff', 700, 'UIOutfit'); text(ctx, 'Reviews', 86, 407, 14, LABEL); text(ctx, 'Analytics', 155, 407, 14, LABEL);
  line(ctx, 435, 20, 353); round(ctx, 20, 434, 50, 2, 1, G);
  [false, true].forEach((pastry, i) => {
    const x = 20 + 184 * i;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, 452, 169, 164, 18); ctx.clip();
    round(ctx, x, 452, 169, 164, 18, '#0A0A0A'); bakeryCrop(ctx, assets, x, 452, 169, 100, pastry);
    text(ctx, pastry ? 'Butter croissants' : 'Sourdough loaf', x + 12, 564, 13, '#fff', 600);
    text(ctx, pastry ? '₦3,500' : '₦5,500', x + 12, 586, 14, G, 700, 'UIOutfit'); ctx.restore(); round(ctx, x, 452, 169, 164, 18, 'transparent', BORDER);
  }); ctx.restore();
  const sheet = move(t, 6.2, 6.9, 0, 1);
  if (sheet > 0) {
    ctx.save(); ctx.globalAlpha = sheet * .6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); ctx.restore();
    ctx.save(); ctx.translate(0, (1 - sheet) * 450);
    round(ctx, 0, 402, SW, 480, 28, '#050505', BORDER); round(ctx, 178, 416, 36, 4, 2, '#343434');
    ctx.save(); ctx.beginPath(); ctx.roundRect(20, 438, 52, 52, 14); ctx.clip(); bakeryCrop(ctx, assets, 20, 438, 52, 52); ctx.restore();
    text(ctx, 'Sourdough loaf', 84, 437, 15, '#fff', 700, 'UIOutfit'); text(ctx, '₦5,500', 84, 457, 14, G, 700, 'UIOutfit'); text(ctx, 'View details & photos →', 84, 477, 12, G); line(ctx, 510, 20, 353);
    const options = [['eye-outline', 'View Item Details'], ['bag-handle-outline', 'Order / Buy Now'], ['chatbubbles-outline', 'Inquire via Chat'], ['share-social-outline', 'Share']];
    options.forEach(([symbol, label], i) => {
      const y = 532 + i * 68, green = i === 1 || i === 2;
      round(ctx, 20, y, 36, 36, 12, green ? '#162817' : '#171717'); icon(ctx, assets, symbol, 30, y + 10, 16, green ? G : '#aaa');
      text(ctx, label, 72, y + 10, 15, green ? G : '#fff', i === 1 ? 600 : 400); if (i < 3) line(ctx, y + 52, 20, 353);
    }); ctx.restore();
  }
}
function communitiesDirectory(ctx: Ctx, assets: ScreenAssets) {
  background(ctx); text(ctx, 'Communities', 16, 66, 26, '#fff', 700, 'UIOutfit');
  round(ctx, 295, 62, 82, 36, 20, G); text(ctx, '+', 306, 71, 16, '#000', 600); text(ctx, 'Create', 324, 74, 12, '#000', 600);
  round(ctx, 16, 116, 361, 46, 12, '#131313', BORDER); icon(ctx, assets, 'search-outline', 29, 130, 18, LABEL);
  center(ctx, 'My Communities', 0, 185, 196.5, 14, LABEL, 400); center(ctx, 'Discover', 196.5, 185, 196.5, 14, G, 600);
  line(ctx, 215, 0, SW); ctx.fillStyle = G; ctx.fillRect(196.5, 214, 196.5, 2);
  [['Enugu Book Circle', '86 members · Group', 'Good books. Better conversations.', 'books'], ['Abuja Weekend People', '34 members · Group', 'Find your next shared plan.', 'courtyard']].forEach(([name, meta, desc, img], i) => {
    const y = 242 + i * 89;
    photo(ctx, assets.images[img], 30, y + 5, 46, 46, 23); text(ctx, name, 88, y, 15, '#fff', 600);
    text(ctx, meta, 88, y + 22, 12, LABEL); text(ctx, desc, 88, y + 40, 11.4, '#aaa');
    icon(ctx, assets, 'arrow-forward', 352, y + 16, 18, LABEL); line(ctx, y + 72);
  });
}
function communityDetail(ctx: Ctx, assets: ScreenAssets, t: number) {
  background(ctx); const joined = t >= 5.1, busy = t >= 4.5 && !joined;
  icon(ctx, assets, 'arrow-back', 14, 74, 24); photo(ctx, assets.images.books, 50, 65, 38, 38, 19);
  text(ctx, 'Enugu Book Circle', 100, 65, 17, '#fff', 700); text(ctx, `${joined ? 87 : 86} members`, 100, 91, 13, LABEL);
  if (joined) icon(ctx, assets, 'notifications-outline', 329, 77, 20, LABEL);
  icon(ctx, assets, 'ellipsis-horizontal', 361, 75, 24); line(ctx, 119, 0, SW);
  photo(ctx, assets.images.books, 16, 135, 361, 140, 14);
  text(ctx, 'Good books. Better conversations.', 16, 289, 14);
  ctx.save(); ctx.globalAlpha = busy ? .5 : 1; round(ctx, 16, 322, 361, 44, 12, '#131313');
  center(ctx, joined ? 'Write a post' : 'Join community', 16, 337, 361, 14, G, 600); ctx.restore();
  if (busy) {
    ctx.save(); ctx.translate(196.5, 792); ctx.rotate(t * 9); ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 1.5); ctx.strokeStyle = G; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  if (joined) {
    // Authored public post shown only after membership, matching actual route behavior.
    round(ctx, 16, 384, 361, 388, 14, '#131313');
    photo(ctx, assets.images.courtyard, 30, 398, 38, 38, 19);
    text(ctx, 'Amara', 76, 399, 14, '#fff', 600); text(ctx, '2 hours ago', 76, 421, 12, LABEL);
    icon(ctx, assets, 'ellipsis-horizontal', 337, 408, 24, LABEL);
    ['What are you reading this weekend?', 'Bring your current favourite along.', 'There’s always room for one more.'].forEach((s, i) => text(ctx, s, 30, 453 + i * 22, 15));
    photo(ctx, assets.images.books, 30, 533, 333, 179, 12);
    icon(ctx, assets, 'heart-outline', 30, 734, 21, LABEL); text(ctx, '12', 57, 737, 13, LABEL);
    icon(ctx, assets, 'chatbubble-outline', 108, 734, 21, LABEL); text(ctx, '4 replies', 135, 737, 13, LABEL);
  }
}
export function drawMainScreen(ctx: Ctx, assets: ScreenAssets, t: number, resolution = 3) {
  // Preserve the approved proof verbatim, including the final state through the first turn.
  if (t < 18) { drawScreen(ctx, assets, Math.max(0, Math.min(14, t - 3)), resolution); return; }
  const kind = t < 31 ? 'marketplace' : t < 44 ? 'business' : 'community';
  const local = Math.max(0, t - (kind === 'marketplace' ? 19 : kind === 'business' ? 32 : 45));
  const start = kind === 'community' ? 1.3 : 1.5;
  const push = move(local, start, start + .7, 0, 1);
  ctx.save(); ctx.scale(resolution, resolution); ctx.clearRect(0, 0, SW, SH);
  ctx.save(); ctx.translate(-push * 112, 0);
  if (kind === 'community') communitiesDirectory(ctx, assets); else directory(ctx, assets, kind === 'business'); ctx.restore();
  if (push > 0) {
    ctx.save(); ctx.translate((1 - push) * SW, 0);
    if (kind === 'marketplace') marketplace(ctx, assets, local);
    else if (kind === 'business') businessProfile(ctx, assets, local);
    else communityDetail(ctx, assets, local); ctx.restore();
  }
  if (kind === 'marketplace') {
    touch(ctx, local, 1.28, 1.78, 105, 335, 335, true);
    touch(ctx, local, 4.37, 5.8, 322, 644, 424);
    touch(ctx, local, 8.37, 9.6, 322, 295, 515);
    touch(ctx, local, 9.67, 10.2, 305, 72, 72, true);
  } else if (kind === 'business') {
    touch(ctx, local, 1.28, 1.78, 182, 280, 280, true);
    touch(ctx, local, 3.97, 5, 322, 622, 477);
    touch(ctx, local, 5.97, 6.5, 105, 367, 367, true);
  } else {
    touch(ctx, local, 1.08, 1.58, 187, 270, 270, true);
    touch(ctx, local, 4.27, 4.8, 196, 344, 344, true);
  }
  // Status and home indicator are fixed once, independent of route pushes/sheets.
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, SW, 44); status(ctx);
  round(ctx, 132, 839, 129, 5, 3, '#f2f2f2'); ctx.restore();
}
