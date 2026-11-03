import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import deps from './dependencies.cjs';
const {root,dep}=deps;
const {chromium}=dep('@playwright/test');
const sharp=dep('sharp');
const mode=process.argv[2]||'components';
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try{
 const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function visit(url){await page.goto(`http://127.0.0.1:4388/${url}`);await page.evaluate(()=>document.fonts.ready);const failed=await page.evaluate(()=>[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src));if(failed.length)throw Error(`Missing images: ${failed}`);}
 const manifestPath=path.join(root,'assets/asset-manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(mode==='playback'){
  await page.close();
  const videoPage=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  videoPage.on('pageerror',e=>errors.push(e.message));
  await videoPage.goto(`file://${path.join(root,'previews/index.html')}`);
  for(let i=0;i<2;i++){
   const video=videoPage.locator('video').nth(i);
   await video.scrollIntoViewIfNeeded();
   await video.evaluate(async el=>{el.muted=true;await el.play();});
   await videoPage.waitForFunction(index=>document.querySelectorAll('video')[index].currentTime>.8,i);
   const result=await video.evaluate(el=>({duration:el.duration,width:el.videoWidth,height:el.videoHeight,time:el.currentTime,error:el.error?.message||null,readyState:el.readyState}));
   await videoPage.waitForFunction(index=>document.querySelectorAll('video')[index].ended,i,{timeout:60000});
   const quality=await video.evaluate(el=>{const q=el.getVideoPlaybackQuality();return {totalFrames:q.totalVideoFrames,droppedFrames:q.droppedVideoFrames,corruptedFrames:q.corruptedVideoFrames}});
   if(quality.corruptedFrames>0)throw Error(`Corrupted decoded playback frames ${i}`);
   await video.evaluate(el=>{el.pause();el.currentTime=el.duration-.5});
   await videoPage.waitForFunction(index=>{const el=document.querySelectorAll('video')[index];return !el.seeking&&el.currentTime>=el.duration-.6},i);
   await video.screenshot({path:path.join(root,`previews/playback-${i===0?'main':'social'}-end.png`)});
   if(result.error||result.readyState<2)throw Error(`Playback failed ${i}`);
   checks.push({file:i===0?'yrdly-launch-main-36s-draft-v2.mp4':'yrdly-launch-social-15s-draft-v2.mp4',...result,quality,playback:'full duration passed',endSeek:'passed'});
  }
 }else if(mode==='components'||mode==='campaign'){
  const campaign=mode==='campaign';
  for(const name of (campaign?['event','event2','marketplace','marketplace2','business','business2','community','community2']:['event','marketplace','business','community'])){
   for(const type of (name.endsWith('2')?['card']:['card','screen'])){
    await visit(`review/${campaign?'components-campaign':'components'}/${name}-${type}.html`);
    const relative=`assets/${type==='card'?'isolated-ui':'screenshots'}/${name}-${type}-${campaign?'campaign':'source'}.png`,filename=path.join(root,relative);
    await page.locator(type==='card'?'#asset':'#screen').screenshot({path:filename,omitBackground:true});
    const m=await sharp(filename).metadata();
    const entry={filename:relative,sourceScreen:name==='community'?'src/components/communities/CommunitiesContent.tsx':'src/app/(tabs)/catalog.tsx',captureMethod:'Static original React component rendered with React Native Web; local authored content. Screen wrapper reconstructed.',dimensions:{width:m.width,height:m.height},intendedUse:campaign?'Campaign composition with original generated imagery and fictional authored scenarios':'Temporary composition reference',assetType:type==='card'?'isolated UI':'component screen',authenticationPrivacy:'No account, backend connection, or personal data; local demo fixture only',authenticity:'reconstructed',marketingStatus:campaign?'Illustrative campaign content; user review pending':'temporary; NOT RELEASE READY',sha256:crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')};
    manifest.assets=manifest.assets.filter(a=>a.filename!==relative);manifest.assets.push(entry);checks.push({file:relative,width:m.width,height:m.height});
   }
  }
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
 }else{
  const frames=JSON.parse(fs.readFileSync(path.join(root,'storyboard/frame-list.json')));
  await page.close();
  const framePage=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  framePage.on('pageerror',e=>errors.push(e.message));
  for(const frame of frames){await framePage.setViewportSize({width:frame.width,height:frame.height});await framePage.goto(`http://127.0.0.1:4388/storyboard/styleframes/${frame.id}.html`);await framePage.evaluate(()=>document.fonts.ready);const failed=await framePage.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));if(failed.length)throw Error('Broken style frame images '+failed.join(','));const typography=await framePage.evaluate(()=>[...document.querySelectorAll('.display,.label')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};}));if(typography.some(t=>!t.inside))throw Error(`Text outside frame ${frame.id}: ${JSON.stringify(typography.filter(t=>!t.inside))}`);await framePage.screenshot({path:path.join(root,`storyboard/styleframes/${frame.id}.png`)});checks.push({file:`storyboard/styleframes/${frame.id}.png`,width:frame.width,height:frame.height,typographyInsideFrame:true});}
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(root,`review/${mode}-render-checks.json`),JSON.stringify({checks,errors},null,2));
 console.log(`Verified ${checks.length} ${mode} outputs.`);
}finally{await browser.close();}
