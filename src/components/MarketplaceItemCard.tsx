import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Post } from '../types';
import { formatPrice } from '../lib/utils';
import { useAuth } from '../hooks/use-supabase-auth';
import { useAppTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { StorageService } from '../lib/storage-service';
import { Avatar } from './Avatar';
import { VerifiedBadge } from './VerifiedBadge';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface Props {
  item: Post;
  onPress?: () => void;
  onMessageSeller?: (item: Post) => void;
  onBuyNow?: (item: Post) => void;
}

type BadgeType = 'Just Listed' | 'Popular' | 'Price Reduced' | 'Free';

function getBadge(item: Post): BadgeType | null {
  if (item.price === 0) return 'Free';
  const ageHours =
    (Date.now() - new Date(item.timestamp || item.created_at || '').getTime()) / 3600000;
  if (ageHours < 6) return 'Just Listed';
  if ((item as any).view_count > 50) return 'Popular';
  if ((item as any).price_reduced) return 'Price Reduced';
  return null;
}

const BADGE_COLORS: Record<BadgeType, { bg: string; text: string; icon: string }> = {
  'Just Listed': { bg: 'rgba(130,219,126,0.2)', text: '#82DB7E', icon: 'add-circle-outline' },
  Popular: { bg: 'rgba(245,158,11,0.2)', text: '#F59E0B', icon: 'star-outline' },
  'Price Reduced': { bg: 'rgba(139,92,246,0.2)', text: '#8B5CF6', icon: 'trending-down-outline' },
  Free: { bg: 'rgba(34,197,94,0.2)', text: '#22c55e', icon: 'gift-outline' },
};

export function MarketplaceItemCard({ item, onPress, onMessageSeller, onBuyNow }: Props) {
  const { styles: stylesheet, theme } = useStyles(sStylesheet);

  const { user } = useAuth();
  const { isDarkMode } = useAppTheme();
  const router = useRouter();
  const isOwner = user?.id === item.user_id;
  const [saved, setSaved] = useState(user ? (item.liked_by || []).includes(user.id) : false);
  const heartScale = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setSaved(user ? (item.liked_by || []).includes(user.id) : false);
  }, [item.liked_by, user]);

  const parsedUrls = Array.isArray(item.image_urls)
    ? item.image_urls
    : typeof item.image_urls === 'string'
      ? JSON.parse(item.image_urls || '[]')
      : [];
  const imageUrl =
    parsedUrls.length > 0 ? parsedUrls[0] : item.image_url || item.video_thumbnail_url;
  const sellerName = item.user?.name || item.author_name || 'Seller';
  const badge = getBadge(item);

  const toggleSaved = async () => {
    if (!user) return;
    const currentLikedBy = item.liked_by || [];
    const isCurrentlyLiked = currentLikedBy.includes(user.id);
    const newSaved = !isCurrentlyLiked;

    setSaved(newSaved);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 40 }),
      Animated.spring(heartScale, { toValue: 1.0, useNativeDriver: true, speed: 40 }),
    ]).start();

    const newLikedBy = newSaved
      ? [...currentLikedBy, user.id]
      : currentLikedBy.filter((id) => id !== user.id);

    try {
      await supabase.from('posts').update({ liked_by: newLikedBy }).eq('id', item.id);
    } catch (err) {
      console.error('Failed to toggle like', err);
      setSaved(!newSaved);
    }
  };

  const onPressIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale: pressScale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          stylesheet.card,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
      >
        {/* Image */}
        <View style={stylesheet.imgWrap}>
          {imageUrl ? (
            <Image
              source={{ uri: StorageService.getOptimizedImageUrl(imageUrl, 400) || imageUrl }}
              style={stylesheet.img}
              contentFit="cover"
              transition={200}
            />
          ) : item.video_urls && item.video_urls.length > 0 ? (
            <View style={[stylesheet.imgPlaceholder, { backgroundColor: theme.colors.SURFACE }]}>
              <Ionicons name="play-circle-outline" size={32} color={theme.colors.G} />
            </View>
          ) : (
            <View style={[stylesheet.imgPlaceholder, { backgroundColor: theme.colors.SURFACE }]}>
              <Ionicons name="bag-outline" size={28} color={theme.colors.G} />
            </View>
          )}

          {/* Badge */}
          {badge && (
            <View style={[stylesheet.badge, { backgroundColor: BADGE_COLORS[badge].bg }]}>
              <Ionicons
                name={BADGE_COLORS[badge].icon as any}
                size={10}
                color={BADGE_COLORS[badge].text}
                style={{ marginRight: 3 }}
              />
              <Text style={[stylesheet.badgeTxt, { color: BADGE_COLORS[badge].text }]}>
                {badge}
              </Text>
            </View>
          )}

          {/* Heart */}
          <TouchableOpacity
            style={stylesheet.heart}
            onPress={(e) => {
              e.stopPropagation();
              toggleSaved();
            }}
            hitSlop={8}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={20}
                color={saved ? '#ff4d6d' : '#fff'}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={stylesheet.info}>
          <Text style={[stylesheet.title, { color: theme.colors.TEXT_PRIMARY }]} numberOfLines={2}>
            {item.title || item.text || 'Untitled'}
          </Text>

          {item.condition && (
            <Text style={[stylesheet.condition, { color: theme.colors.MUTED }]}>
              {item.condition}
            </Text>
          )}

          <Text style={[stylesheet.price, { color: theme.colors.G }]}>
            {item.price === 0 ? 'FREE' : formatPrice(item.price || 0)}
          </Text>

          {/* Location */}
          {(item.lga || item.state) && (
            <View style={stylesheet.locRow}>
              <Ionicons name="location-outline" size={10} color={theme.colors.MUTED} />
              <Text style={[stylesheet.locTxt, { color: theme.colors.MUTED }]} numberOfLines={1}>
                {[item.lga, item.state].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {/* Seller row */}
          <TouchableOpacity
            style={stylesheet.sellerRow}
            onPress={() => router.push(`/profile/${item.user_id}` as any)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Avatar
              url={item.user?.avatar_url}
              name={sellerName}
              size={100}
              style={[stylesheet.avatar as any, { backgroundColor: theme.colors.G }]}
              fallbackTextStyle={stylesheet.avatarTxt}
            />
            <Text
              style={[stylesheet.sellerName, { color: theme.colors.TEXT_SECONDARY }]}
              numberOfLines={1}
            >
              {sellerName}
            </Text>
            {(item.user as any)?.phone_verified && (
              <View style={{ marginLeft: 2 }}>
                <VerifiedBadge size={12} />
              </View>
            )}
          </TouchableOpacity>

          {/* Actions */}
          {isOwner ? (
            <TouchableOpacity
              style={[stylesheet.editBtn, { borderColor: theme.colors.G }]}
              onPress={() => router.push(`/marketplace/edit/${item.id}` as any)}
            >
              <Feather name="edit-2" size={12} color={theme.colors.G} />
              <Text style={[stylesheet.editTxt, { color: theme.colors.G }]}>Edit Listing</Text>
            </TouchableOpacity>
          ) : (
            <View style={stylesheet.actRow}>
              <TouchableOpacity
                style={[
                  stylesheet.chatBtn,
                  {
                    borderColor: theme.colors.GLASS_BORDER,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
                onPress={() => onMessageSeller?.(item)}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={13}
                  color={theme.colors.TEXT_PRIMARY}
                  style={{ marginRight: 4 }}
                />
                <Text style={[stylesheet.chatTxt, { color: theme.colors.TEXT_PRIMARY }]}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesheet.buyBtn, { backgroundColor: theme.colors.G }]}
                onPress={() => onBuyNow?.(item)}
              >
                <Ionicons
                  name="cart-outline"
                  size={13}
                  color="#0B0D0B"
                  style={{ marginRight: 4 }}
                />
                <Text style={stylesheet.buyTxt}>{item.price === 0 ? 'Claim' : 'Buy Now'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 14,
  },
  imgWrap: { width: '100%', height: 150, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  info: { padding: 10 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 2 },
  condition: { fontSize: 11, marginBottom: 4 },
  price: { fontSize: 17, fontWeight: '900', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  locTxt: { fontSize: 10, flex: 1 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 5,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: theme.colors.TEXT_PRIMARY, fontSize: 9, fontWeight: '800' },
  sellerName: { flex: 1, fontSize: 11, fontWeight: '600' },
  actRow: { flexDirection: 'row', gap: 6 },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  chatTxt: { fontSize: 11, fontWeight: '700' },
  buyBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: 16,
  },
  buyTxt: { color: '#0B0D0B', fontSize: 11, fontWeight: '800' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  editTxt: { fontSize: 11, fontWeight: '700' },
}));
