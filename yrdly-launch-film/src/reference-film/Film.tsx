import React from 'react';
import {AbsoluteFill,Audio,Sequence,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {Opening} from './Opening';
import {Introduction} from './Introduction';
import {FeatureScene} from './FeatureScene';
import {Carousel} from './Carousel';
import {Endboard} from './Endboard';
import {flow,SceneProps} from './shared';

const Reveal:React.FC<{children:React.ReactNode;first:boolean;circle:boolean;overlap:number}>=({children,first,circle,overlap})=>{
 const f=useCurrentFrame(),{width,height}=useVideoConfig();
 const p=flow(f,0,overlap);
 const radius=width<height?Math.hypot(width*.77,height*.55):Math.hypot(width,height);
 return <AbsoluteFill style={{clipPath:first?undefined:circle?`circle(${p*radius}px at 77% 55%)`:`inset(0 0 0 ${(1-p)*100}%)`}}>{children}</AbsoluteFill>;
};
export const ReferenceFilm:React.FC<SceneProps & {withAudio?:boolean}>=({vertical=false,withAudio=true})=>{
 const overlap=vertical?24:42;
 const sections=vertical?[
  {at:0,seconds:2,node:<Opening vertical/>,circle:false},
  {at:2,seconds:2.5,node:<FeatureScene feature="event" vertical fast/>,circle:false},
  {at:4.5,seconds:2.25,node:<FeatureScene feature="marketplace" vertical fast/>,circle:false},
  {at:6.75,seconds:2.25,node:<FeatureScene feature="business" vertical fast/>,circle:false},
  {at:9,seconds:3,node:<FeatureScene feature="community" vertical fast/>,circle:false},
  {at:12,seconds:3,node:<Endboard vertical/>,circle:true},
 ]:[
  {at:0,seconds:3,node:<Opening/>,circle:false},
  {at:3,seconds:3,node:<Introduction/>,circle:true},
  {at:6,seconds:5,node:<FeatureScene feature="event"/>,circle:false},
  {at:11,seconds:5,node:<FeatureScene feature="marketplace"/>,circle:false},
  {at:16,seconds:5,node:<FeatureScene feature="business"/>,circle:false},
  {at:21,seconds:5,node:<FeatureScene feature="community"/>,circle:false},
  {at:26,seconds:5,node:<Carousel/>,circle:false},
  {at:31,seconds:5,node:<Endboard/>,circle:true},
 ];
 return <AbsoluteFill>{sections.map((s,i)=><Sequence key={s.at} name={`Reference / ${s.at}s`} from={s.at*60} durationInFrames={s.seconds*60+(i===sections.length-1?0:vertical&&sections[i+1]?.circle?42:overlap)}><Reveal first={i===0} circle={s.circle} overlap={vertical&&s.circle?42:overlap}>{s.node}</Reveal></Sequence>)}{withAudio&&<Audio src={staticFile(`audio/reference/${vertical?'social':'main'}-mix.wav`)}/>}</AbsoluteFill>;
};
