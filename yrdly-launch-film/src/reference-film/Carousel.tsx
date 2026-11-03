import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Scene,Line,Photo,Phone,move,flow,Feature} from './shared';
export const Carousel=()=>{
 const f=useCurrentFrame();
 const names=['courtyard-sessions','walnut-lounge-chair','daybreak-bakehouse','enugu-book-circle'];
 const features:Feature[]=['event','marketplace','business','community'];
 const current=Math.min(3,Math.max(0,Math.floor((f-30)/55)));
 return <Scene>
  <Line delay={8} style={{left:0,right:0,top:105,textAlign:'center',fontSize:92}}>Plans. Finds. Places. People.</Line>
  <div style={{position:'absolute',left:735,top:320+move(f,5,60,120,0),width:450,height:975}}>
   {features.map((feature,i)=><div key={feature} style={{position:'absolute',inset:0,opacity:i===0?1:flow(f,30+i*55,48+i*55)}}><Phone feature={feature} style={{left:0,top:0,width:450,height:975}}/></div>)}
  </div>
  {names.map((name,i)=>{
   const entrance=move(f,18+i*12,65+i*12);
   const focus=flow(f,30+i*55,55+i*55)*(1-flow(f,75+i*55,100+i*55));
   return <Photo key={name} name={name} style={{left:180+i*410+move(f,20,250,120,-65),top:530-focus*45+(1-entrance)*280,width:345,height:345,borderRadius:30,scale:.94+focus*.1,rotate:`${[-5,-2,2,5][i]*(1-focus)}deg`,opacity:entrance,boxShadow:'0 25px 50px #07180d28'}}/>;
  })}
 </Scene>;
};
