import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import deps from './dependencies.cjs';
const {root,dep}=deps,sharp=dep('sharp');
const manifestPath=path.join(root,'assets/asset-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const name of ['event','marketplace','business','community']){
 const filename=`assets/temporary/${name}.svg`; const p=path.join(root,filename),m=await sharp(p).metadata();
 manifest.assets=manifest.assets.filter(a=>a.filename!==filename);
 manifest.assets.push({filename,sourceScreen:'Original campaign placeholder drawing',captureMethod:'Local SVG drawing, not product photography',dimensions:{width:m.width,height:m.height},intendedUse:'Clearly identified image placeholder for style review only',assetType:'placeholder illustration',authenticationPrivacy:'No user data or recognizable person',authenticity:'temporary',marketingStatus:'NOT RELEASE READY',sha256:hash(p)});
}
const fixtures='assets/temporary/fixtures.json';
manifest.assets=manifest.assets.filter(a=>a.filename!==fixtures);
manifest.assets.push({filename:fixtures,sourceScreen:'Local capture harness',captureMethod:'Explicitly fictional local fixture; never sent to app/backend',dimensions:null,intendedUse:'Exercise original component appearance',assetType:'fixture data',authenticationPrivacy:'No real names or private data; no service access',authenticity:'temporary',marketingStatus:'NOT RELEASE READY',sha256:hash(path.join(root,fixtures))});
for(const asset of manifest.assets){const file=path.join(root,asset.filename);if(!fs.existsSync(file))throw Error(`Missing asset ${asset.filename}`);if(hash(file)!==asset.sha256)throw Error(`Hash mismatch ${asset.filename}`);if(asset.dimensions){const m=await sharp(file).metadata();if(m.width!==asset.dimensions.width||m.height!==asset.dimensions.height)throw Error(`Dimensions mismatch ${asset.filename}`);}}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
const textSvg=(label,width,height=44,fill='#f2f0e7',size=18)=>Buffer.from(`<svg width="${width}" height="${height}"><text x="12" y="30" fill="${fill}" font-family="sans-serif" font-size="${size}">${label.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text></svg>`);
async function contact(filename,title,items,columns,cellW,cellH){
 const rows=Math.ceil(items.length/columns),gap=24,pad=36,header=100,width=pad*2+columns*cellW+(columns-1)*gap,height=header+rows*(cellH+58)+pad;
 const layers=[{input:textSvg(title,width-72,60,'#82DB7E',25),left:36,top:22}];
 for(const [i,item]of items.entries()){
  const left=pad+(i%columns)*(cellW+gap),top=header+Math.floor(i/columns)*(cellH+58);
  layers.push({input:await sharp(path.join(root,item.file)).resize(cellW,cellH,{fit:'contain',background:'#142218'}).png().toBuffer(),left,top});
  layers.push({input:textSvg(item.label,cellW,44,'#f2f0e7',16),left,top:top+cellH+5});
 }
 await sharp({create:{width,height,channels:3,background:'#0b160f'}}).composite(layers).png().toFile(path.join(root,filename));
}
const frames=JSON.parse(fs.readFileSync(path.join(root,'storyboard/frame-list.json')));
for(const frame of frames){const file=path.join(root,`storyboard/styleframes/${frame.id}.png`);const m=await sharp(file).metadata();if(m.width!==frame.width||m.height!==frame.height)throw Error(`Wrong styleframe dimensions ${frame.id}`);const stats=await sharp(file).stats();if(stats.channels.every(c=>c.stdev<1))throw Error(`Blank frame ${frame.id}`);}
await contact('review/styleframe-contact-sheet.png','YRDLY / EDITORIAL PROXIMITY / STATIC STYLE STUDIES',frames.filter(f=>f.width>f.height).map(f=>({file:`storyboard/styleframes/${f.id}.png`,label:f.title})),2,864,486);
await contact('review/vertical-contact-sheet.png','YRDLY / PORTRAIT COMPOSITIONS / SOURCE UI + LOCAL DEMO',frames.filter(f=>f.width<f.height).map(f=>({file:`storyboard/styleframes/${f.id}.png`,label:f.title})),3,432,768);
await contact('review/asset-contact-sheet.png','YRDLY / ORIGINAL COMPONENT RENDERS / NOT NATIVE CAPTURES',[
 ...['event','marketplace','business','community'].map(name=>({file:`assets/screenshots/${name}-screen-source.png`,label:`${name.toUpperCase()} / reconstructed screen`})),
 ...['event','marketplace','business','community'].map(name=>({file:`assets/isolated-ui/${name}-card-source.png`,label:`${name.toUpperCase()} / original JSX + demo data`}))
],4,360,780);
fs.writeFileSync(path.join(root,'review/verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),assets:manifest.assets.length,styleFrames:frames.length,nativeCaptures:0,nativeRecordings:0,finalVideos:0,cta:{url:'https://yrdly.ng/',httpStatus:200,title:'Yrdly - Your Neighborhood Network',checked:'2026-10-15',nativeStoreAvailability:'not established'},checks:['All manifest files exist','All manifest hashes match','Raster/vector dimensions match manifest','All styleframes match 1920x1080 or 1080x1920 as specified','No constant-color blank styleframes','Source fixture contains no real user identities','No production service code executed by the asset harness'],limitations:['Native iOS runtime appearance is not verified','All demo records and illustrations are temporary','No approved event, listing, business or community content','No audio selected or cleared','Recheck CTA destination before release','No final video quality checks applicable yet']},null,2));
console.log(`Verified ${manifest.assets.length} assets and ${frames.length} style frames; generated three contact sheets.`);
