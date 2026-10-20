const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('../../../../yrdly-app/node_modules/@playwright/test');
const sharp = require('../../../../yrdly-app/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const workspace = path.resolve(root, '../../..');
const film = path.join(workspace, 'YRDLY Launch Film/assets/screenshots');
const fonts = path.join(workspace, 'yrdly-mobile/node_modules/@expo-google-fonts/outfit');
const uri = (p, type) => `data:${type};base64,${fs.readFileSync(p).toString('base64')}`;
const panels = [
 {id:'01-events',screen:'event',eyebrow:'AROUND YOUR CORNER',title:['Good plans.','Great company.'],desc:'Discover events in your neighbourhood.',dark:true},
 {id:'02-marketplace',screen:'marketplace',eyebrow:'THE LOCAL MARKETPLACE',title:['Good finds.','Close to home.'],desc:'Buy and sell in your neighbourhood.',dark:false},
 {id:'03-businesses',screen:'business',eyebrow:'YOUR NEXT LOCAL FAVOURITE',title:['Local places.','More to love.'],desc:'Explore businesses and services nearby.',dark:true},
 {id:'04-communities',screen:'community',eyebrow:'A PLACE TO BELONG',title:['Find your people.','Feel at home.'],desc:'Connect with neighbours and communities.',dark:false},
];
const cssFonts = `@font-face{font-family:Outfit;src:url('${uri(path.join(fonts,'800ExtraBold/Outfit_800ExtraBold.ttf'),'font/ttf')}');font-weight:800}@font-face{font-family:Outfit;src:url('${uri(path.join(fonts,'400Regular/Outfit_400Regular.ttf'),'font/ttf')}');font-weight:400}`;
function html(panel,w,h){
 const apple = h>2000, scale=w/1080;
 const bg=panel.dark?'#050505':'#82DB7E',fg=panel.dark?'#ffffff':'#050505', accent=panel.dark?'#82DB7E':'#050505';
 const screenH=apple?2075:1450, screenW=Math.round(screenH*1179/2556), top=apple?710:415;
 const img=uri(path.join(film,`${panel.screen}-screen-campaign.png`),'image/png');
 return `<!doctype html><html><head><meta charset="utf-8"><style>${cssFonts}*{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg};font-family:Outfit;color:${fg}}.mast{position:absolute;left:${72*scale}px;top:${55*scale}px;font-size:${36*scale}px;font-weight:800;letter-spacing:-1px}.mark{display:inline-block;width:${13*scale}px;height:${13*scale}px;background:${accent};border-radius:50%;margin-right:${13*scale}px}.series{position:absolute;right:${72*scale}px;top:${64*scale}px;font-size:${17*scale}px;letter-spacing:2px;opacity:.65}.copy{position:absolute;left:${72*scale}px;top:${apple?192:140}px;z-index:2}.eyebrow{font-size:${apple?24:17}px;letter-spacing:3px;margin-bottom:${apple?28:16}px;color:${accent}}h1{font-size:${apple?113:79}px;line-height:1.02;letter-spacing:${apple?-5:-3}px;margin:0;font-weight:800}h1 span{color:${accent}}p{font-size:${apple?34:26}px;line-height:1.3;margin:${apple?30:20}px 0 0;opacity:.77}.ring{position:absolute;width:${w*1.5}px;height:${w*1.5}px;left:${-w*.25}px;top:${h*.48}px;border:2px solid ${panel.dark?'#203321':'#64BD60'};border-radius:50%}.ring.two{transform:scale(.81)}.frame{position:absolute;left:${(w-screenW-24)/2}px;top:${top}px;padding:10px;background:#101510;border:2px solid ${panel.dark?'#435245':'#426940'};border-radius:58px;box-shadow:0 35px 85px #0005;line-height:0}.frame img{display:block;width:${screenW}px;height:${screenH}px;border-radius:46px}.footer{position:absolute;bottom:25px;left:${72*scale}px;font-size:14px;letter-spacing:3px;opacity:.45}</style></head><body><div class="ring"></div><div class="ring two"></div><div class="mast"><i class="mark"></i>YRDLY</div><div class="series">NEIGHBOURHOOD, CONNECTED.</div><div class="copy"><div class="eyebrow">${panel.eyebrow}</div><h1>${panel.title[0]}<br><span>${panel.title[1]}</span></h1><p>${panel.desc}</p></div><div class="frame"><img src="${img}"></div></body></html>`;
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const manifest=[];
 try{
  for(const [store,w,h] of [['apple-iphone-draft',1320,2868],['google-play-phone-draft',1080,1920]]){
   fs.mkdirSync(path.join(root,store),{recursive:true});
   const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
   for(const p of panels){
    const document=html(p,w,h);fs.writeFileSync(path.join(root,store,p.id+'.html'),document);
    await page.setContent(document);await page.evaluate(()=>document.fonts.ready);
    const buffer=await page.screenshot();const file=path.join(root,store,p.id+'.png');
    await sharp(buffer).removeAlpha().png().toFile(file);
    const meta=await sharp(file).metadata();
    if(meta.width!==w||meta.height!==h||meta.hasAlpha)throw Error('Invalid output '+file);
    manifest.push({file:path.relative(root,file),width:w,height:h,hasAlpha:meta.hasAlpha,source:p.screen+'-screen-campaign.png',status:'DRAFT: reconstructed campaign screen, replace with native platform capture before submission'});
   }await page.close();
  }
 }finally{await browser.close()}
 const thumbW=264, gap=20, sheetW=4*thumbW+5*gap;
 const composites=[];
 for(let i=0;i<manifest.length;i++){
  const row=Math.floor(i/4),col=i%4;
  const thumbnail=await sharp(path.join(root,manifest[i].file)).resize({width:thumbW}).toBuffer();
  composites.push({input:thumbnail,left:gap+col*(thumbW+gap),top:70+row*650});
 }
 const label=Buffer.from(`<svg width="${sheetW}" height="1250"><style>text{font-family:sans-serif;fill:white;font-size:19px}</style><text x="20" y="34">YRDLY · APPLE IPHONE · DRAFT ARTWORK</text><text x="20" y="685">GOOGLE PLAY PHONE · DRAFT ARTWORK</text><text x="20" y="1230">Campaign previews — native platform screenshots required before store submission.</text></svg>`);
 await sharp({create:{width:sheetW,height:1250,channels:3,background:'#182019'}}).composite([{input:label,left:0,top:0},...composites]).png().toFile(path.join(root,'preview.png'));
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(`Rendered and checked ${manifest.length} RGB PNG files.`);
})();
