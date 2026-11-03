const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {root,mobile,dep} = require('./dependencies.cjs');
const sharp = dep('sharp');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function main() {
  const entries = [];
  async function copy(source, target, type, intendedUse, status='authentic') {
    const src = path.join(mobile, source), dst = path.join(root, 'assets', target);
    fs.mkdirSync(path.dirname(dst), {recursive:true}); fs.copyFileSync(src,dst);
    let dimensions = null;
    if (/\.(png|jpe?g|svg)$/.test(target)) {const m=await sharp(dst).metadata(); dimensions={width:m.width,height:m.height};}
    entries.push({filename:`assets/${target}`, sourceScreen:source, captureMethod:'Original mobile repository asset extraction', dimensions,intendedUse,assetType:type,authenticationPrivacy:'No authentication or user data. Repository artwork; marketing rights must be checked separately.',authenticity:status,marketingStatus:type==='photograph'?'reference-only; clearance required':'brand/source asset',sha256:hash(dst)});
  }
  await copy('assets/images/logo.png','brand/yrdly-logo.png','logo','Original native brand mark');
  const tight=path.join(root,'assets/brand/yrdly-logo-tight.png');
  await sharp(path.join(root,'assets/brand/yrdly-logo.png')).trim().png().toFile(tight);
  const tightMeta=await sharp(tight).metadata();
  entries.push({filename:'assets/brand/yrdly-logo-tight.png',sourceScreen:'assets/images/logo.png',captureMethod:'Original logo; transparent outer padding trimmed only',dimensions:{width:tightMeta.width,height:tightMeta.height},intendedUse:'Precisely aligned brand lockup',assetType:'logo',authenticationPrivacy:'No personal information',authenticity:'authentic-derived',marketingStatus:'brand/source asset',sha256:hash(tight)});
  for (const n of ['home','explore','events','marketplace','business','profile','messages','map','notifications']) await copy(`assets/svgs/${n}.svg`,`navigation/${n}.svg`,'icon','Original mobile navigation icon');
  for (const [family,weights] of [['outfit',['400Regular','600SemiBold','700Bold','800ExtraBold','900Black']],['inter',['400Regular','500Medium','600SemiBold','700Bold']]]) {
    for (const weight of weights) {
      const dir=`node_modules/@expo-google-fonts/${family}/${weight}`;
      const filename=fs.readdirSync(path.join(mobile,dir)).find(f=>f.endsWith('.ttf'));
      await copy(`${dir}/${filename}`,`brand/fonts/${filename}`,'font','Original application typography');
    }
    await copy(`node_modules/@expo-google-fonts/${family}/LICENSE_FONT`,`brand/fonts/${family}-LICENSE.txt`,'license','Font license preservation');
  }
  for (const name of ['Ionicons','Feather']) await copy(`node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${name}.ttf`,`brand/fonts/${name}.ttf`,'font','Exact native icon glyphs');
  const logoSource=fs.readFileSync(path.join(mobile,'src/components/LogoDraw.tsx'),'utf8');
  const d=logoSource.match(/const YRDLY_MARK_D =\s*'([^']+)'/)[1];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="450 395 310 410"><path d="${d}" transform="translate(0,1280) scale(0.1,-0.1)" fill="#F7F17C"/></svg>`;
  fs.writeFileSync(path.join(root,'assets/brand/yrdly-mark.svg'),svg);
  entries.push({filename:'assets/brand/yrdly-mark.svg',sourceScreen:'src/components/LogoDraw.tsx',captureMethod:'Exact original path extracted; viewBox tightened around mark',dimensions:{width:310,height:410},intendedUse:'Editable brand reveal',assetType:'vector logo',authenticationPrivacy:'No personal information',authenticity:'authentic-derived',marketingStatus:'brand/source asset',sha256:hash(path.join(root,'assets/brand/yrdly-mark.svg'))});
  const manifestPath=path.join(root,'assets/asset-manifest.json');
  const old=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath)):{};
  fs.writeFileSync(manifestPath,JSON.stringify({version:1,sourceCommit:'21d040d',nativeCaptureCount:0,notice:'Component renders and temporary content are not native iOS captures. No approved campaign records yet.',assets:[...entries,...(old.assets||[]).filter(a=>!entries.some(b=>a.filename===b.filename))]},null,2));
  console.log(`Extracted ${entries.length} original brand, font and navigation assets.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
