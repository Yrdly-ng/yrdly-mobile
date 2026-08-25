import { createStyleSheet, useStyles } from "react-native-unistyles";
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView,
  TouchableOpacity, ActivityIndicator, Dimensions,
  Platform, Share, ActionSheetIOS, Alert, AppState
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, 
  interpolate, Extrapolation, withSpring, withSequence 
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';
import { Post, User } from '../../types';
import { formatPrice, timeAgo } from '../../lib/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Avatar } from '../../components/Avatar';
const { width } = Dimensions.get('window');

const MarketVideo = React.memo(({ url, shouldPlay }: { url: string, shouldPlay: boolean }) => {
  const { styles: s } = useStyles(_stylesheet);

  const player = useVideoPlayer(url, player => {
    player.loop = true;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && shouldPlay) {
        player.play();
      } else {
        player.pause();
      }
    });
    return () => subscription.remove();
  }, [shouldPlay, player]);

  useEffect(() => {
    if (shouldPlay && AppState.currentState === 'active') {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, player]);

  return (
    <VideoView
      style={s.mainImage}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
});

function MarketplaceDetailContent() {
    const { styles: stylesheet, theme } = useStyles(_stylesheet);

    const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile, updateProfile } = useAuth();
  const isFocused = useIsFocused();

  const [post, setPost] = useState<Post | null>(null);
  const [postUser, setPostUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Gallery state
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeScrollIndex, setActiveScrollIndex] = useState(0);
  
  // Stats state
  const [itemsSold, setItemsSold] = useState(0);
  const [joinedDate, setJoinedDate] = useState('');
  
  // Description state
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  
  // Favourite state
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const scaleValue = useSharedValue(1);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, user:users!posts_user_id_fkey(*)`)
        .eq('id', id)
        .single();

      if (!error && data) {
        setPost(data);
        if (data.user) {
          setPostUser(data.user as any);
          if (data.user.created_at) {
            const date = new Date(data.user.created_at);
            setJoinedDate(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
          }
        }
        
        // Items sold query
        const { count } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.user_id)
          .eq('category', 'For Sale')
          .eq('is_sold', true);
        
        if (count !== null) setItemsSold(count);
        
        setIsLiked(user ? (data.liked_by || []).includes(user.id) : false);
        setLikeCount(data.liked_by?.length || 0);

        if (user) {
          const { data: bookmarkData } = await supabase
            .from('post_bookmarks')
            .select('id')
            .eq('post_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsBookmarked(!!bookmarkData);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleMessageSeller = async () => {
    if (!post || !user || user.id === post.user_id) return;

    try {
      const { data: convs, error: fetchError } = await supabase
        .from('conversations')
        .select('id, type, participant_ids, item_id')
        .eq('item_id', post.id)
        .order('created_at', { ascending: true });

      if (fetchError) console.error('Error fetching conversations:', fetchError);

      const existing = convs?.find(c => {
        if (c.type === 'marketplace' && c.item_id === post.id && c.participant_ids?.includes(user.id) && c.participant_ids?.includes(post.user_id)) return true;
        return false;
      });

      if (existing?.id) {
        router.push({ pathname: '/chat/[id]', params: { id: existing.id } });
        return;
      }

      const imageUrl = post.image_urls?.[0] || post.image_url || '';
      router.push({
        pathname: '/chat/[id]',
        params: { 
          id: 'new',
          type: 'marketplace',
          participant_id: post.user_id,
          item_id: post.id,
          item_title: post.title || post.text || 'Listing',
          item_image: imageUrl,
          item_price: post.price ?? ''
        }
      });
    } catch (e) {
      console.error('Error starting chat', e);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        message: `Check out ${post.title || 'this item'} for ${post.price === 0 ? 'FREE' : formatPrice(post.price || 0)} on YRDLY!`,
        url: `https://yrdly.ng/marketplace/${post.id}`
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!user || !post) return;
    const newBookmarked = !isBookmarked;
    setIsBookmarked(newBookmarked);
    
    if (newBookmarked) {
      const { error } = await supabase.from('post_bookmarks').insert({ post_id: post.id, user_id: user.id });
      if (error) setIsBookmarked(false);
    } else {
      const { error } = await supabase.from('post_bookmarks').delete().match({ post_id: post.id, user_id: user.id });
      if (error) setIsBookmarked(true);
    }
  };

  const handleMore = () => {
    const isOwner = user?.id === post?.user_id;
    const saveOption = isBookmarked ? 'Unsave Item' : 'Save Item';

    const handleDeleteItem = () => {
      Alert.alert('Delete Item', 'Are you sure you want to delete this listing?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          if (!user || !post) return;
          try {
            await supabase.from('posts').delete().eq('id', post.id);
            Alert.alert('Success', 'Listing deleted.');
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete listing.');
          }
        }}
      ]);
    };

    const handleReport = () => {
      Alert.alert('Report Item', 'Are you sure you want to report this item?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: async () => {
          if (!user || !post) return;
          await supabase.from('reports').insert({ reporter_id: user.id, reported_post_id: post.id, reason: 'Inappropriate content' });
          Alert.alert('Success', 'Item reported to admins.');
        }}
      ]);
    };

    const handleBlock = () => {
      Alert.alert('Block Seller', 'You will no longer see content from this seller.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => {
          if (!user || !post) return;
          const currentBlocks = profile?.blocked_users || [];
          if (!currentBlocks.includes(post.user_id)) {
            await updateProfile({ blocked_users: [...currentBlocks, post.user_id] });
          }
          await supabase.from('user_blocks').insert({ blocker_id: user.id, blocked_id: post.user_id });
          Alert.alert('Success', 'Seller blocked.');
        }}
      ]);
    };



    if (isOwner) {
      const options = ['Copy Link', saveOption, 'Delete Item', 'Cancel'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 3, destructiveButtonIndex: 2 },
          (buttonIndex) => {
            if (buttonIndex === 0) handleShare();
            if (buttonIndex === 1) handleBookmarkToggle();
            if (buttonIndex === 2) handleDeleteItem();
          }
        );
      } else {
        Alert.alert('Listing Options', '', [
          { text: 'Copy Link', onPress: handleShare },
          { text: saveOption, onPress: handleBookmarkToggle },
          { text: 'Delete Item', onPress: handleDeleteItem, style: 'destructive' },
          { text: 'Cancel', style: 'cancel' }
        ]);
      }
    } else {
      const options = ['Report Item', 'Copy Link', saveOption, 'Block Seller', 'Cancel'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 4, destructiveButtonIndex: 3 },
          (buttonIndex) => {
            if (buttonIndex === 0) handleReport();
            if (buttonIndex === 1) handleShare();
            if (buttonIndex === 2) handleBookmarkToggle();
            if (buttonIndex === 3) handleBlock();
          }
        );
      } else {
        Alert.alert('More Options', 'Select an option', [
          { text: 'Report Item', onPress: handleReport },
          { text: 'Copy Link', onPress: handleShare },
          { text: saveOption, onPress: handleBookmarkToggle },
          { text: 'Block Seller', onPress: handleBlock, style: 'destructive' },
          { text: 'Cancel', style: 'cancel' }
        ]);
      }
    }
  };

  const handleToggleLike = async () => {
    if (!post || !user) return;
    
    // Animate heart
    scaleValue.value = withSequence(
      withSpring(1.3, { damping: 5, stiffness: 200 }),
      withSpring(1, { damping: 5, stiffness: 200 })
    );

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikeCount(prev => newLikedState ? prev + 1 : prev - 1);

    const currentLikedBy = post.liked_by || [];
    const newLikedBy = newLikedState
      ? [...new Set([...currentLikedBy, user.id])]
      : currentLikedBy.filter(id => id !== user.id);

    // Optimistic update done, now save to backend
    const { error } = await supabase
      .from('posts')
      .update({ liked_by: newLikedBy })
      .eq('id', post.id);

    if (error) {
      // Rollback
      setIsLiked(!newLikedState);
      setLikeCount(prev => !newLikedState ? prev + 1 : prev - 1);
      console.error('Error toggling like:', error);
    } else {
      setPost(prev => prev ? { ...prev, liked_by: newLikedBy } : null);
    }
  };

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }]
  }));

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(scrollY.value, [-200, 0, 300], [-100, 0, 150], Extrapolation.CLAMP);
    const scale = interpolate(scrollY.value, [-200, 0], [1.5, 1], Extrapolation.CLAMP);
    return { transform: [{ translateY }, { scale }] };
  });

  if (loading) {
    return (
      <View style={[stylesheet.centerContainer, { backgroundColor: theme.colors.DARK }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </View>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={[stylesheet.centerContainer, { backgroundColor: theme.colors.DARK }]}>
        <Text style={[stylesheet.errorText, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' }]}>Item not found</Text>
        <TouchableOpacity style={[stylesheet.backBtnWrapper, { backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER }]} onPress={() => router.back()}>
          <Text style={[stylesheet.backBtnText, { color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' }]}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  const parsedImageUrls = Array.isArray(post.image_urls) 
    ? post.image_urls 
    : (typeof post.image_urls === 'string' ? JSON.parse(post.image_urls || '[]') : []);
  const imageUrls = parsedImageUrls.length > 0 ? parsedImageUrls : post.image_url ? [post.image_url] : [];
  const mediaItems = [];
  if (post.video_urls?.[0]) mediaItems.push({ type: 'video', url: post.video_urls?.[0] });
  imageUrls.forEach((url: string) => mediaItems.push({ type: 'image', url }));

  const isOwner = user?.id === post.user_id;


  return (
    <View style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <Animated.ScrollView 
        style={stylesheet.scrollContent} 
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={{ position: 'relative', height: 320 }}>
          {/* Image Gallery */}
          {mediaItems.length > 0 ? (
            <Animated.View style={[headerAnimatedStyle, stylesheet.galleryContainer]}>
              <ScrollView 
                horizontal 
                pagingEnabled 
                showsHorizontalScrollIndicator={false} 
                style={stylesheet.imageScroll}
                onScroll={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                  setActiveScrollIndex(index);
                }}
                scrollEventThrottle={16}
              >
                {mediaItems.map((media, i) => {
                return (
                                  <View key={i} style={stylesheet.mainImageContainer}>
                                    {media.type === 'video' ? (
                                      <MarketVideo url={media.url} shouldPlay={activeScrollIndex === i && isFocused} />
                                    ) : (
                                      <TouchableOpacity 
                                        activeOpacity={0.9} 
                                        style={{ flex: 1 }}
                                        onPress={() => {
                                          const imageIndex = post.video_urls?.[0] ? i - 1 : i;
                                          setCurrentImageIndex(Math.max(0, imageIndex));
                                          setIsGalleryVisible(true);
                                        }}
                                      >
                                        <Image source={{ uri: media.url }} style={stylesheet.mainImage} contentFit="cover" />
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                );
                })}
              </ScrollView>
              
              {/* Gallery Indicator Row */}
              <View style={stylesheet.galleryControls}>
                <View style={stylesheet.paginationDots}>
                  {mediaItems.map((_, i) => (
                    <View key={i} style={[stylesheet.carouselDot, activeScrollIndex === i ? [stylesheet.activeDot, { backgroundColor: theme.colors.G }] : stylesheet.inactiveDot]} />
                  ))}
                </View>
                {mediaItems.length > 1 && (
                  <View style={stylesheet.counterBadge}>
                    <Text style={stylesheet.counterText}>{activeScrollIndex + 1}/{mediaItems.length}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          ) : (
             <View style={[stylesheet.placeholderImage, { backgroundColor: theme.colors.SURFACE }]}>
               <Ionicons name="image-outline" size={64} color={theme.colors.LABEL} />
             </View>
          )}

          {/* Gradient Overlay bottom of image */}
          <LinearGradient 
            colors={[theme.colors.GLASS_BG, 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}
            pointerEvents="none"
          />
          <LinearGradient 
            colors={['transparent', theme.colors.DARK]}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
            pointerEvents="none"
          />

          {/* SOLD Badge */}
          {post.is_sold && (
            <View style={{ position: 'absolute', top: 20, left: 20, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER }}>
               <Text style={{ fontFamily: 'Outfit-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY }}>SOLD</Text>
            </View>
          )}

          {/* Header Buttons over image */}
          <View style={{ position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
             <TouchableOpacity onPress={() => router.back()} style={stylesheet.iconCircle}>
                <Ionicons name="chevron-back" size={24} color={theme.colors.TEXT_PRIMARY} />
             </TouchableOpacity>
             <View style={{ flexDirection: 'row', gap: 8 }}>
               {!isOwner && (
                 <TouchableOpacity onPress={handleBookmarkToggle} style={stylesheet.iconCircle}>
                   <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={16} color={isBookmarked ? theme.colors.G : theme.colors.TEXT_PRIMARY} />
                 </TouchableOpacity>
               )}
               <TouchableOpacity onPress={handleMore} style={stylesheet.iconCircle}>
                 <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.TEXT_PRIMARY} />
               </TouchableOpacity>
             </View>
          </View>
        </View>

        {/* Content Section */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 16 }}>
           <View>
             <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
               <Text style={{ fontFamily: 'Outfit-Bold', fontWeight: '800', fontSize: 22, color: theme.colors.TEXT_PRIMARY, flex: 1, lineHeight: 26 }}>
                 {post.title || post.text || 'Untitled'}
               </Text>
               {post.condition && (
                 <View style={{ marginLeft: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, flexShrink: 0 }}>
                   <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 12, fontWeight: '600', color: theme.colors.MUTED }}>{post.condition}</Text>
                 </View>
               )}
             </View>
             <Text style={{ fontFamily: 'Outfit-Bold', fontWeight: '800', fontSize: 28, color: post.is_sold ? theme.colors.LABEL : theme.colors.G }}>
               {post.is_sold ? 'SOLD' : (post.price === 0 ? 'FREE' : formatPrice(post.price || 0))}
             </Text>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
               <Ionicons name="location-outline" size={14} color={theme.colors.LABEL} />
               <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.LABEL }}>
                 {post.lga ? `${post.lga}, ` : ''}{post.state || 'Location'}
               </Text>
             </View>
           </View>

           {/* Seller Card */}
           {isOwner ? (
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, borderRadius: 20 }}>
               <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.SURFACE_ALT, alignItems: 'center', justifyContent: 'center' }}>
                 <Ionicons name="bag-check-outline" size={20} color={theme.colors.G} />
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={{ fontFamily: 'Outfit-Bold', fontWeight: '700', fontSize: 13, color: theme.colors.G }}>You are the seller of this listing</Text>
                 <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL, marginTop: 2 }}>Use the buttons below to manage your listing</Text>
               </View>
             </View>
           ) : (
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: theme.colors.SURFACE_ALT, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, borderRadius: 20 }}>
               <TouchableOpacity onPress={() => router.push(`/profile/${post.user_id}` as any)}>
                 <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.colors.SURFACE }}>
                    <Avatar
                      url={postUser?.avatar_url || post.author_image}
                      name={postUser?.name}
                      size={48}
                      style={{ width: '100%', height: '100%' }}
                      fallbackStyle={{ backgroundColor: theme.colors.SURFACE }}
                      fallbackTextStyle={{ color: theme.colors.TEXT_PRIMARY, fontSize: 18, fontFamily: 'Outfit-Bold' }}
                    />
                 </View>
               </TouchableOpacity>
               <View style={{ flex: 1 }}>
                 <TouchableOpacity onPress={() => router.push(`/profile/${post.user_id}` as any)}>
                   <Text style={{ fontFamily: 'Outfit-Bold', fontWeight: '700', fontSize: 14, color: theme.colors.TEXT_PRIMARY }}>{postUser?.name || post.author_name || 'Unknown Seller'}</Text>
                 </TouchableOpacity>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                   {(postUser as any)?.review_count > 0 ? (
                     <>
                       <Ionicons name="star" size={11} color={theme.colors.GOLD || '#FFD700'} />
                       <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 11, color: theme.colors.TEXT_PRIMARY }}>
                         {Number((postUser as any)?.rating || 0).toFixed(1)}
                       </Text>
                       <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL }}>
                         ({(postUser as any)?.review_count} reviews)
                       </Text>
                     </>
                   ) : (
                     <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL }}>
                       No ratings yet
                     </Text>
                   )}
                 </View>
               </View>
               <TouchableOpacity 
                 onPress={() => router.push(`/profile/${post.user_id}` as any)}
                 style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, alignItems: 'center', justifyContent: 'center' }}>
                 <Text style={{ color: theme.colors.MUTED, fontFamily: 'Inter-Medium', fontSize: 12, fontWeight: '500' }}>View Profile</Text>
               </TouchableOpacity>
             </View>
           )}

           <View>
             <Text style={{ fontFamily: 'Inter-Bold', fontSize: 11, fontWeight: '700', color: theme.colors.LABEL, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10 }}>About this item</Text>
             <Text style={{ fontFamily: 'Inter-Regular', fontSize: 15, color: theme.colors.MUTED, lineHeight: 25.5 }}>{post.text}</Text>
           </View>
           
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
             {post.category && (
               <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER }}>
                 <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.MUTED }}>{post.category}</Text>
               </View>
             )}
           </View>
        </View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: theme.colors.DARK, borderTopWidth: 1, borderTopColor: theme.colors.GLASS_BORDER, flexDirection: 'row', gap: 12 }}>
        {isOwner ? (
          <>
            <TouchableOpacity 
              onPress={() => router.push(`/marketplace/edit/${post.id}`)}
              style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="pencil" size={15} color={theme.colors.TEXT_PRIMARY} />
              <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit-Bold', fontWeight: '700', fontSize: 15 }}>Edit Listing</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={async () => {
                const newSold = !post.is_sold;
                const { error } = await supabase.from('posts').update({ is_sold: newSold }).eq('id', post.id);
                if (!error) {
                  setPost(prev => prev ? { ...prev, is_sold: newSold } : null);
                }
              }}
              style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: post.is_sold ? 'rgba(255,92,92,0.1)' : 'rgba(130,219,126,0.1)', borderWidth: 1, borderColor: post.is_sold ? 'rgba(255,92,92,0.3)' : 'rgba(130,219,126,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: post.is_sold ? '#FF5C5C' : theme.colors.G, fontFamily: 'Outfit-Bold', fontWeight: '700', fontSize: 15 }}>
                {post.is_sold ? 'Mark Active' : 'Mark as Sold'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              disabled={post.is_sold}
              onPress={() => router.push({ pathname: '/checkout/[id]', params: { id: post.id, type: 'marketplace' } })}
              style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: post.is_sold ? theme.colors.SURFACE : theme.colors.G, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: post.is_sold ? theme.colors.LABEL : '#000', fontFamily: 'Outfit-Bold', fontWeight: '700', fontSize: 16 }}>{post.is_sold ? 'Item Sold' : 'Buy Now'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleMessageSeller}
              style={{ height: 52, paddingHorizontal: 18, borderRadius: 16, backgroundColor: theme.colors.SURFACE, borderWidth: 1, borderColor: theme.colors.GLASS_BORDER, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: theme.colors.MUTED, fontFamily: 'Inter-Medium', fontSize: 14 }}>Message Seller</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <ImageViewing
        images={imageUrls.map((uri: string) => ({ uri }))}
        imageIndex={currentImageIndex}
        visible={isGalleryVisible}
        onRequestClose={() => setIsGalleryVisible(false)}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
      />
    </View>
  );
}

const _stylesheet = createStyleSheet(theme => ({
      container: { flex: 1 },
      centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
      errorText: { fontSize: 18, marginBottom: 20 },
      backBtnWrapper: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
      backBtnText: { fontWeight: 'bold' },
      iconCircle: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: theme.colors.GLASS_BG,
        borderWidth: 1, borderColor: theme.colors.GLASS_BORDER,
        justifyContent: 'center', alignItems: 'center',
      },
      scrollContent: { flex: 1 },
      galleryContainer: {
        width: '100%', height: '100%',
      },
      imageScroll: { flex: 1 },
      mainImageContainer: { width: width, height: 320 },
      mainImage: { width: width, height: '100%' },
      galleryControls: {
        position: 'absolute', bottom: 20, left: 20, right: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
      },
      paginationDots: { flexDirection: 'row', alignItems: 'center' },
      carouselDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 3 },
      activeDot: { width: 8, height: 8, borderRadius: 4 },
      inactiveDot: { backgroundColor: theme.colors.MUTED },
      counterBadge: {
        backgroundColor: theme.colors.GLASS_BG, paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 16,
      },
      counterText: { color: theme.colors.TEXT_PRIMARY, fontSize: 12, fontWeight: 'bold' },
      placeholderImage: { 
        width: width, height: 320, 
        justifyContent: 'center', alignItems: 'center',
      },
    }));

export default function MarketplaceDetailScreen() {
    const { styles: stylesheet, theme } = useStyles(_stylesheet);

  return (
    <ErrorBoundary screenName="MarketplaceDetail">
      <MarketplaceDetailContent />
    </ErrorBoundary>
  );
}
