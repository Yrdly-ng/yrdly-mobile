import React, { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase';
import type { Post } from '@/types';
export function MarketplaceFavorite({ item }: { item: Post }) {
  const {user}=useAuth();
  const [liked,setLiked]=useState(!!user&&!!item.liked_by?.includes(user.id));
  const busy=useRef(false);
  useEffect(()=>{setLiked(!!user&&!!item.liked_by?.includes(user.id));},[item.id,item.liked_by,user?.id]);
  async function toggle(){
    if(!user||busy.current)return;
    busy.current=true;const previous=liked;setLiked(!previous);
    try{
      const {data,error}=await supabase.rpc('toggle_post_like',{p_post_id:item.id,p_user_id:user.id});
      if(error||!data)throw error;
      setLiked(data.is_liked);
      DeviceEventEmitter.emit('post_updated',{postId:item.id,updates:{liked_by:data.liked_by}});
    }catch{setLiked(previous);}finally{busy.current=false;}
  }
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={liked?'Unlike listing':'Like listing'} accessibilityState={{selected:liked}} hitSlop={8}
    onPress={event=>{event.stopPropagation();void toggle();}}
    style={{position:'absolute',top:8,right:8,width:36,height:36,borderRadius:18,backgroundColor:'rgba(15,23,18,0.88)',alignItems:'center',justifyContent:'center'}}>
    <Ionicons name={liked?'heart':'heart-outline'} size={20} color={liked?'#FF6785':'#FFFFFF'}/>
  </TouchableOpacity>;
}
