import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Scene,Type,Mark,palette,move,SceneProps} from './shared';
export const Endboard:React.FC<SceneProps>=({vertical=false})=>{
 const f=useCurrentFrame();
 return <Scene bg={palette.green}>
  <Mark style={{left:vertical?390:610,top:vertical?435:290,width:vertical?300:210,height:vertical?300:210,scale:move(f,15,65,.85,1)}}/>
  <Type style={{left:vertical?0:875,right:vertical?0:undefined,top:vertical?835:310,textAlign:vertical?'center':undefined,fontSize:185,translate:`0 ${move(f,20,65,45,0)}px`,opacity:move(f,20,50)}}>YRDLY</Type>
  <Type style={{left:vertical?80:0,right:vertical?80:0,top:vertical?1130:595,textAlign:'center',fontSize:vertical?82:88,lineHeight:1.12,translate:`0 ${move(f,40,85,35,0)}px`,opacity:move(f,40,70)}}>Your neighbourhood.{vertical?<br/>:' '}Closer.</Type>
  <Type body style={{left:0,right:0,top:vertical?1510:820,textAlign:'center',fontSize:vertical?52:40,opacity:move(f,55,85)}}>yrdly.ng</Type>
 </Scene>;
};
