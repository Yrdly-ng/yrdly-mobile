import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '../../lib/network/api';

type Prompt = { id: string; question: string; category: string; prompt_date: string };

export default function DailyPromptCard() {
  const {theme}=useUnistyles();
  const router=useRouter();
  const [prompt,setPrompt]=useState<Prompt|null>(null);
  useFocusEffect(useCallback(()=>{
    let active=true;
    void api.get<{prompt:Prompt|null}>('/api/daily-prompts')
      .then(data=>{if(active)setPrompt(data.prompt??null)})
      .catch(()=>{if(active)setPrompt(null)});
    return ()=>{active=false};
  },[]));
  if(!prompt)return null;
  return (
    <View style={{ marginHorizontal:20,marginTop:4,marginBottom:16,padding:18,
      backgroundColor:theme.colors.SURFACE,borderWidth:1,
      borderColor:'rgba(130,219,126,0.35)',borderRadius:22 }}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10}}>
        <Feather name="message-circle" size={17} color={theme.colors.G}/>
        <Text style={{fontFamily:'Inter-SemiBold',color:theme.colors.G,fontSize:11,letterSpacing:0.7}}>
          TODAY'S NEIGHBOURHOOD QUESTION
        </Text>
      </View>
      <Text style={{fontFamily:'Outfit-Bold',fontSize:18,lineHeight:26,color:theme.colors.TEXT_PRIMARY}}>
        {prompt.question}
      </Text>
      <Text style={{fontFamily:'Inter',fontSize:12,color:theme.colors.MUTED,marginTop:7}}>
        Share your thoughts and discover what your neighbours think.
      </Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:16}}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Answer today's neighbourhood question"
          onPress={()=>router.push({pathname:'/create-post',params:{dailyPrompt:prompt.id}} as any)}
          style={{backgroundColor:theme.colors.G,paddingVertical:11,paddingHorizontal:17,borderRadius:20}}>
          <Text style={{fontFamily:'Outfit-Bold',fontSize:13,color:'#000'}}>Answer prompt</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="See neighbours' answers"
          onPress={()=>router.push('/daily-prompts' as any)}
          style={{paddingVertical:11,paddingHorizontal:12,borderRadius:20,
            borderWidth:1,borderColor:theme.colors.GLASS_BORDER}}>
          <Text style={{fontFamily:'Inter-SemiBold',fontSize:13,color:theme.colors.TEXT_PRIMARY}}>
            View responses
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
