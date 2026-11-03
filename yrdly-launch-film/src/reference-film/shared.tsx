import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {move, flow} from '../animations/motion';
export {move, flow};
export const palette={green:'#82DB7E',paper:'#F2F0E7',ink:'#0B160F'};
export type SceneProps={vertical?:boolean; fast?:boolean};
export type Feature='event'|'marketplace'|'business'|'community';
export const Picture=({file,style}:{file:string;style?:React.CSSProperties})=><Img src={staticFile(file)} style={{position:'absolute',display:'block',...style}}/>;
export const Photo=({name,style}:{name:string;style?:React.CSSProperties})=><Picture file={`campaign/${name}.png`} style={{objectFit:'cover',...style}}/>;
export const Card=({name,style}:{name:string;style?:React.CSSProperties})=><Picture file={`isolated-ui/${name}-card-campaign.png`} style={{background:'#050505',borderRadius:28,height:'auto',zIndex:2,...style}}/>;
export const Mark=({style}:{style?:React.CSSProperties})=><Picture file="brand/yrdly-logo-tight.png" style={style}/>;
export const Type=({children,style,body=false}:{children:React.ReactNode;style?:React.CSSProperties;body?:boolean})=><div data-copy style={{position:'absolute',fontFamily:body?'Inter':'Outfit',fontWeight:body?500:700,lineHeight:body?1.4:1.02,letterSpacing:body?'-.025em':'-.045em',...style}}>{children}</div>;
export const Line=({children,style,delay=0,fast=false}:{children:React.ReactNode;style:React.CSSProperties;delay?:number;fast?:boolean})=>{
 const f=useCurrentFrame();
 return <Type style={{...style,overflow:'hidden',paddingBottom:'.08em'}}><div style={{translate:`0 ${move(f,delay,delay+(fast?27:42),105,0)}%`}}>{children}</div></Type>;
};
export const Scene=({children,bg=palette.paper}:{children:React.ReactNode;bg?:string})=><AbsoluteFill style={{background:bg,color:palette.ink,overflow:'hidden'}}>{children}</AbsoluteFill>;
export const Phone=({feature,style}:{feature:Feature;style:React.CSSProperties})=><div style={{position:'absolute',padding:12,background:'linear-gradient(100deg,#778076,#151b16 12%,#30372f 90%,#869280)',border:'2px solid #8d978d',borderRadius:62,boxShadow:'24px 35px 65px #03160935',overflow:'hidden',...style}}><Picture file={`screenshots/${feature}-screen-campaign.png`} style={{position:'relative',width:'100%',height:'100%',objectFit:'contain',borderRadius:48}}/><div style={{position:'absolute',inset:5,border:'1px solid #bdc9bc70',borderRadius:56}}/><div style={{position:'absolute',top:25,left:'50%',translate:'-50% 0',width:114,height:28,borderRadius:25,background:'#000'}}/></div>;
