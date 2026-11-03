import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Scene,Type,Photo,Phone,Card,palette,move,flow,SceneProps} from './shared';
export const Opening:React.FC<SceneProps>=({vertical=false})=>{
 const f=useCurrentFrame();
 if(vertical)return <Scene><Type body style={{left:95,top:170,fontSize:28,letterSpacing:3}}>YRDLY</Type><Type style={{left:90,top:260,fontSize:146,translate:`0 ${move(f,0,34,35,0)}px`}}>More<br/>around you.</Type><div style={{position:'absolute',left:825,top:285,width:90,height:90,borderRadius:'50%',background:palette.green,scale:move(f,0,30,.65,1)}}/><Phone feature="event" style={{left:320,top:770+move(f,0,72,210,0),width:545,height:1182,transform:`rotate(${move(f,0,65,9,5)}deg)`}}/><Card name="event" style={{left:80+move(f,12,65,-100,0),top:950,width:750,transform:`rotate(${move(f,12,65,-8,-4)}deg)`,boxShadow:'0 30px 70px #07180d38'}}/></Scene>;
 const pull=flow(f,130,180);
 return <Scene bg={palette.ink}>
 <Photo name="courtyard-sessions" style={{left:1295+pull*100,top:65+pull*250,width:405,height:240,borderRadius:24,transform:`rotate(${move(f,0,75,13,7)-pull*7}deg)`,scale:1-pull*.45}}/>
 <Photo name="walnut-lounge-chair" style={{left:1480-pull*80,top:680-pull*130,width:255,height:255,borderRadius:24,rotate:`${move(f,0,75,-14,-8)+pull*8}deg`,scale:1-pull*.3}}/>
 <Photo name="enugu-book-circle" style={{left:110+pull*700,top:785-pull*170,width:310,height:210,borderRadius:24,rotate:`${move(f,0,75,-10,-6)}deg`,opacity:1-pull}}/>
 <Type style={{left:195,top:315,fontSize:194,color:palette.paper,translate:`${-pull*100}px ${move(f,0,38,20,0)}px`,opacity:1-pull*.8}}>There’s more<br/>around you.</Type>
 <div style={{position:'absolute',left:1405,top:515,width:162,height:162,borderRadius:'50%',background:palette.green,scale:move(f,0,35,.7,1)+pull*.35}}/>
 </Scene>;
};
