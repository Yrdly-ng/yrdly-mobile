import React,{useCallback,useState} from 'react';
import {View,Text,TouchableOpacity,ActivityIndicator,FlatList} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useUnistyles} from 'react-native-unistyles';
import {useFocusEffect,useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {api} from '../lib/network/api';

type Prompt={id:string;question:string};
type Response={id:string;author_name:string;text:string;comment_count:number;created_at:string};
export default function DailyPromptResponsesScreen(){
 const {theme}=useUnistyles(),router=useRouter();
 const [prompt,setPrompt]=useState<Prompt|null>(null);
 const [answers,setAnswers]=useState<Response[]>([]);
 const [nextPage,setNextPage]=useState<number|null>(null);
 const [loading,setLoading]=useState(true);
 const [more,setMore]=useState(false);
 const [error,setError]=useState('');
 useFocusEffect(useCallback(()=>{
   let active=true;
   setLoading(true);setError('');
   void api.get<{prompt:Prompt|null}>('/api/daily-prompts').then(async data=>{
     if(!active)return;
     setPrompt(data.prompt);
     if(!data.prompt){setAnswers([]);setNextPage(null);return}
     const result=await api.get<{responses:Response[];nextPage:number|null}>(
       `/api/daily-prompts/responses?promptId=${encodeURIComponent(data.prompt.id)}&page=0`);
     if(active){setAnswers(result.responses);setNextPage(result.nextPage)}
   }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load question')})
     .finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false};
 },[]));
 const loadMore=async()=>{
  if(!prompt||nextPage===null||more)return;setMore(true);
  try{
    const result=await api.get<{responses:Response[];nextPage:number|null}>(
      `/api/daily-prompts/responses?promptId=${encodeURIComponent(prompt.id)}&page=${nextPage}`);
    setAnswers(old=>[...old,...result.responses.filter(item=>!old.some(x=>x.id===item.id))]);
    setNextPage(result.nextPage);
  }catch{setError('Could not load more answers')}finally{setMore(false)}
 };
 return <SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:theme.colors.DARK}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:18,paddingVertical:12}}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.back()}>
        <Feather name="arrow-left" size={22} color={theme.colors.TEXT_PRIMARY}/>
      </TouchableOpacity>
      <Text style={{fontFamily:'Outfit-Bold',fontSize:20,color:theme.colors.TEXT_PRIMARY}}>
        Today's Question
      </Text>
    </View>
    {loading?<ActivityIndicator color={theme.colors.G} style={{marginTop:30}}/>:
    <FlatList
      data={answers}keyExtractor={item=>item.id}
      ListHeaderComponent={<View style={{paddingHorizontal:20,paddingVertical:18,gap:12}}>
        {prompt?<><Text style={{fontFamily:'Outfit-Bold',fontSize:20,lineHeight:28,
          color:theme.colors.TEXT_PRIMARY}}>{prompt.question}</Text>
          <TouchableOpacity accessibilityRole="button"
            onPress={()=>router.push({pathname:'/create-post',params:{dailyPrompt:prompt.id}} as any)}
            style={{backgroundColor:theme.colors.G,borderRadius:20,padding:13,alignSelf:'flex-start'}}>
             <Text style={{fontFamily:'Outfit-Bold',fontSize:14,color:'#000'}}>Share your answer</Text>
          </TouchableOpacity><Text style={{fontFamily:'Outfit-Bold',fontSize:16,
            color:theme.colors.TEXT_PRIMARY}}>Neighbourhood responses</Text></>:
          <Text style={{color:theme.colors.MUTED}}>No question is live yet. Check back tomorrow.</Text>}
        {!!error&&<Text accessibilityRole="alert" style={{color:'#eab308'}}>{error}</Text>}
      </View>}
      renderItem={({item})=><TouchableOpacity accessibilityRole="button"
        onPress={()=>router.push(`/posts/${item.id}` as any)}
        style={{marginHorizontal:20,marginBottom:12,padding:16,borderRadius:18,
          backgroundColor:theme.colors.SURFACE,borderColor:theme.colors.GLASS_BORDER,borderWidth:1}}>
        <Text style={{color:theme.colors.TEXT_PRIMARY,fontFamily:'Inter-SemiBold'}}>{item.author_name}</Text>
        <Text style={{color:theme.colors.TEXT_PRIMARY,marginTop:8,lineHeight:22}}>{item.text}</Text>
        <Text style={{color:theme.colors.MUTED,fontSize:12,marginTop:8}}>
          View discussion · {item.comment_count||0} comments
        </Text>
      </TouchableOpacity>}
      ListEmptyComponent={prompt?<Text style={{textAlign:'center',color:theme.colors.MUTED,padding:28}}>
        No answers nearby yet. Be the first!
      </Text>:null}
      ListFooterComponent={nextPage!==null?<TouchableOpacity
        disabled={more}onPress={()=>void loadMore()}style={{padding:18,alignSelf:'center'}}>
        <Text style={{color:theme.colors.G}}>{more?'Loading…':'Load more responses'}</Text>
      </TouchableOpacity>:null}
    />}
 </SafeAreaView>
}
