import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Scene,Type,Mark,move} from './shared';
export const Introduction=()=>{
 const f=useCurrentFrame();
 return <Scene><Type style={{left:430,top:425,fontSize:150,translate:`${move(f,15,65,-90,0)}px 0`,opacity:move(f,15,45)}}>Meet</Type><Mark style={{left:795,top:402,width:190,height:190,scale:move(f,8,65,.8,1)}}/><Type style={{left:1020,top:425,fontSize:150,translate:`${move(f,15,65,90,0)}px 0`,opacity:move(f,15,45)}}>YRDLY</Type><Type body style={{left:0,right:0,top:665,textAlign:'center',fontSize:38,translate:`0 ${move(f,35,78,30,0)}px`,opacity:move(f,35,65)}}>Your neighbourhood. In one place.</Type></Scene>;
};
