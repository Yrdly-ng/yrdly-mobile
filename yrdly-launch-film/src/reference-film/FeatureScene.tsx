import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Scene,Type,Line,Phone,Card,Photo,move,flow,palette,SceneProps,Feature} from './shared';

export const FeatureScene:React.FC<SceneProps & {feature:Feature}>=({feature,vertical=false,fast=false})=>{
 const f=useCurrentFrame(), settle=fast?42:65;
 const lines={event:['Find your','plans.'],marketplace:['Find your','next thing.'],business:['Find your','spots.'],community:['Find your','people.']}[feature];
 const caption={event:'A reason to step out.',marketplace:'Good finds. Nearby.',business:'Make somewhere your regular.',community:'Shared interests. Local connections.'}[feature];
 const isCommunity=feature==='community';
 const headline=<>{lines.map((line,i)=><Line key={line} fast={fast} delay={12+i*6} style={{left:vertical?90:isCommunity?1170:145,top:(vertical?290:isCommunity?295:feature==='marketplace'?315:365)+i*(vertical?148:isCommunity?135:155),fontSize:vertical?140:isCommunity?132:148}}>{line}</Line>)}</>;
 const sub=<Type body style={{left:vertical?95:isCommunity?1180:152,top:vertical?665:isCommunity?625:735,width:vertical?850:isCommunity?650:700,fontSize:vertical?44:34,opacity:move(f,32,fast?60:85)}}>{caption}</Type>;
 const p=move(f,12,settle), lift=move(f,35,fast?78:120);
 if(vertical){
  return <Scene bg={feature==='business'?palette.green:palette.paper}>
   {isCommunity&&<Photo name="enugu-book-circle" style={{left:0,top:780,width:1080,height:1140,objectPosition:'48% 50%',borderRadius:'120px 120px 0 0',clipPath:`inset(${(1-p)*100}% 0 0 0)`}}/>}
   {headline}{sub}
   {feature==='event'&&<><Phone feature={feature} style={{left:320,top:840+(1-p)*200,width:545,height:1182,transform:`rotate(${7-p*2}deg)`}}/><Card name="event" style={{left:80+(1-lift)*100,top:1050-lift*70,width:750,transform:`rotate(${-4*lift}deg)`,boxShadow:'0 30px 70px #07180d38'}}/></>}
   {feature==='marketplace'&&<><Card name="marketplace" style={{left:100+(1-p)*160,top:850+(1-p)*110,width:440,transform:`rotate(${-6*p}deg)`,boxShadow:'0 25px 60px #07180d25'}}/><Card name="marketplace2" style={{left:570+(1-lift)*230,top:1090,width:400,transform:`rotate(${6*lift}deg)`,boxShadow:'0 25px 60px #07180d25'}}/></>}
   {feature==='business'&&<><Phone feature={feature} style={{left:280,top:840+(1-p)*220,width:670,height:1453,transform:`perspective(2000px) rotateY(${-8*p}deg) rotateZ(${-5*p}deg)`}}/><Card name="business" style={{left:80,top:1275+(1-lift)*160,width:900,boxShadow:'0 25px 55px #07180d35'}}/></>}
   {isCommunity&&<Card name="community" style={{left:80,top:1450+(1-lift)*200,width:920,boxShadow:'0 25px 55px #07180d35'}}/>}
  </Scene>;
 }
 return <Scene bg={feature==='business'?palette.green:palette.paper}>
  {isCommunity&&<Photo name="enugu-book-circle" style={{left:0,top:0,width:1100,height:1080,objectPosition:'46% 50%',borderRadius:'0 160px 160px 0',clipPath:`inset(0 ${(1-p)*100}% 0 0)`,scale:move(f,0,160,1.035,1)}}/>}
  {headline}{sub}
  {feature==='event'&&<><Phone feature="event" style={{left:1190+(1-p)*180,top:90,width:492,height:1067,transform:`perspective(1800px) rotateY(${-10*p}deg) rotateZ(${3*p}deg)`}}/><Card name="event" style={{left:1198-lift*268,top:350,width:move(f,35,120,475,650),transform:`rotate(${-3*lift}deg)`,boxShadow:`0 ${30*lift}px ${70*lift}px #07180d40`}}/></>}
  {feature==='marketplace'&&<><Card name="marketplace" style={{left:965+(1-p)*300,top:195+(1-p)*80,width:380,transform:`rotate(${-7*p}deg)`,boxShadow:'0 25px 60px #07180d25'}}/><Card name="marketplace2" style={{left:1415+(1-lift)*400,top:360,width:350,transform:`rotate(${6*lift}deg)`,boxShadow:'0 25px 60px #07180d25'}}/></>}
  {feature==='business'&&<><Phone feature="business" style={{left:1190+(1-p)*180,top:150+(1-p)*200,width:650,height:1410,transform:`perspective(2000px) rotateY(${move(f,0,100,-28,-15)}deg) rotateZ(${move(f,0,100,-12,-7)}deg)`}}/><Card name="business" style={{left:840+(1-lift)*300,top:745,width:820,boxShadow:'0 25px 55px #0b160f35'}}/></>}
  {isCommunity&&<Card name="community" style={{left:700+(1-lift)*300,top:770,width:1080,boxShadow:'0 24px 50px #07180d38'}}/>}
 </Scene>;
};
