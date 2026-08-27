import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
const { width } = Dimensions.get('window');
const IMG_W = (width - 32 - 24) / 3;

export interface GeneralPostImage {
  uri: string;
  width: number;
  height: number;
  type?: 'image' | 'video';
  thumbnailUri?: string;
}

export interface GeneralPostFormValues {
  text: string;
  title: string;
  images: GeneralPostImage[];
  visibility: 'public' | 'private';
}

interface Props {
  values: GeneralPostFormValues;
  onChange: (p: Partial<GeneralPostFormValues>) => void;
  onAddPhoto: () => void;
  onRemovePhoto: (i: number) => void;
  profile?: any;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCategoryChange: () => void; // open category menu
  showCategoryMenu: boolean;
  categories: string[];
  onSelectCategory: (cat: string) => void;
}

export function GeneralPostForm({
  values,
  onChange,
  onAddPhoto,
  onRemovePhoto,
  profile,
  isSubmitting,
  onSubmit,
  onCategoryChange,
  showCategoryMenu,
  categories,
  onSelectCategory,
}: Props) {
  const { styles: stylesheet, theme } = useStyles(sStylesheet);

  const pressScale = useRef(new Animated.Value(1)).current;
  const [menuScale] = useState(new Animated.Value(showCategoryMenu ? 1 : 0));

  const locLabel =
    profile?.home_lga || profile?.home_ward
      ? [profile.home_ward, profile.home_lga].filter(Boolean).join(', ')
      : profile?.location
        ? [profile.location.ward, profile.location.lga].filter(Boolean).join(', ')
        : '';

  const canPost = values.text.trim().length > 0 && !isSubmitting;

  const onBtnIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onBtnOut = () =>
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <>
      {/* ── Profile row ── */}
      <View style={stylesheet.profileRow}>
        <View>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={stylesheet.avatar}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                stylesheet.avatar,
                { backgroundColor: theme.colors.G, justifyContent: 'center', alignItems: 'center' },
              ]}
            >
              <Text style={{ color: theme.colors.TEXT_PRIMARY, fontWeight: '800', fontSize: 18 }}>
                {(profile?.name || '?').charAt(0)}
              </Text>
            </View>
          )}
          <View style={[stylesheet.cameraBtn, { backgroundColor: theme.colors.G }]}>
            <Ionicons name="camera" size={8} color="#0B0D0B" />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[stylesheet.name, { color: theme.colors.TEXT_PRIMARY }]}>
              {profile?.name || 'You'}
            </Text>
            {/* Category pill */}
            <View style={{ position: 'relative', zIndex: 50 }}>
              <TouchableOpacity
                style={[
                  stylesheet.pill,
                  { backgroundColor: theme.colors.G + '20', borderColor: theme.colors.G + '60' },
                ]}
                onPress={onCategoryChange}
              >
                <Text style={[stylesheet.pillTxt, { color: theme.colors.G }]}>General</Text>
                <Ionicons name="chevron-down" size={11} color={theme.colors.G} />
              </TouchableOpacity>
              {showCategoryMenu && (
                <View
                  style={[
                    stylesheet.menu,
                    {
                      backgroundColor: theme.colors.SURFACE,
                      borderColor: theme.colors.GLASS_BORDER,
                    },
                  ]}
                >
                  {categories.map((cat) => {
                    const { styles: s } = useStyles(sStylesheet);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={stylesheet.menuItem}
                        onPress={() => onSelectCategory(cat)}
                      >
                        <Text style={{ color: theme.colors.TEXT_PRIMARY, fontSize: 14 }}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            {!!locLabel && (
              <Text style={[stylesheet.sub, { color: theme.colors.MUTED }]}>{locLabel}</Text>
            )}
            {!!locLabel && <Text style={[stylesheet.sub, { color: theme.colors.MUTED }]}>·</Text>}
            <Ionicons
              name={values.visibility === 'private' ? 'lock-closed-outline' : 'globe-outline'}
              size={11}
              color={theme.colors.G}
            />
            <Text style={[stylesheet.sub, { color: theme.colors.G }]}>
              {values.visibility === 'private' ? 'Private' : 'Public'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Composer card ── */}
      <View
        style={[
          stylesheet.composerCard,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <TextInput
          style={[stylesheet.composerInput, { color: theme.colors.TEXT_PRIMARY }]}
          placeholder="What's happening nearby?"
          placeholderTextColor={theme.colors.MUTED}
          value={values.text}
          onChangeText={(t) => onChange({ text: t.slice(0, 2000) })}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />
        <View style={[stylesheet.composerFooter, { borderTopColor: theme.colors.GLASS_BORDER }]}>
          <Text
            style={[
              stylesheet.charCount,
              { color: theme.colors.MUTED, flex: 1, textAlign: 'right' },
            ]}
          >
            {values.text.length}/2000
          </Text>
        </View>
      </View>

      {/* ── Media toolbar ── */}
      <View
        style={[
          stylesheet.toolbarCard,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
      >
        {([['image-outline', 'Photo']] as [string, string][]).map(([icon, label]) => {
          return (
            <TouchableOpacity
              key={label}
              style={stylesheet.toolBtn}
              onPress={label === 'Photo' ? onAddPhoto : undefined}
            >
              <View
                style={[
                  stylesheet.toolIcon,
                  {
                    borderColor: label === 'Photo' ? theme.colors.G : theme.colors.GLASS_BORDER,
                    backgroundColor: label === 'Photo' ? theme.colors.G + '15' : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={icon as any}
                  size={22}
                  color={label === 'Photo' ? theme.colors.G : theme.colors.MUTED}
                />
              </View>
              <Text
                style={[
                  stylesheet.toolLabel,
                  { color: label === 'Photo' ? theme.colors.G : theme.colors.MUTED },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Image preview ── */}
      {values.images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {values.images.map((img, i) => {
            return (
              <View key={i} style={stylesheet.imgWrap}>
                <Image
                  source={{ uri: img.thumbnailUri || img.uri }}
                  style={stylesheet.img}
                  contentFit="cover"
                  transition={200}
                />
                <TouchableOpacity style={stylesheet.imgRemove} onPress={() => onRemovePhoto(i)}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
            );
          })}
          {/* "Add more" slot */}
          <TouchableOpacity
            onPress={onAddPhoto}
            style={[stylesheet.addMore, { borderColor: theme.colors.GLASS_BORDER }]}
          >
            <Ionicons name="add" size={24} color={theme.colors.MUTED} />
            <Text style={[stylesheet.addMoreTxt, { color: theme.colors.MUTED }]}>Add more</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Visibility row ── */}
      <TouchableOpacity
        style={[
          stylesheet.rowCard,
          { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
        ]}
        onPress={() =>
          onChange({ visibility: values.visibility === 'private' ? 'public' : 'private' })
        }
      >
        <View style={[stylesheet.visIcon, { borderColor: theme.colors.G }]}>
          <Ionicons
            name={values.visibility === 'private' ? 'lock-closed-outline' : 'globe-outline'}
            size={18}
            color={theme.colors.G}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[stylesheet.rowTitle, { color: theme.colors.TEXT_PRIMARY }]}>
            Who can see this?
          </Text>
          <Text style={[stylesheet.rowSub, { color: theme.colors.MUTED }]}>
            {values.visibility === 'private' ? 'Only your friends' : 'Anyone on Yrdly'}
          </Text>
        </View>
        <View style={[stylesheet.visPill, { borderColor: theme.colors.G }]}>
          <Text style={[stylesheet.visPillTxt, { color: theme.colors.G }]}>
            {values.visibility === 'private' ? 'Private' : 'Public'}
          </Text>
          <Ionicons name="swap-vertical" size={12} color={theme.colors.G} />
        </View>
      </TouchableOpacity>

      {/* ── Post button ── */}
      <Animated.View style={[{ transform: [{ scale: pressScale }] }, stylesheet.submitWrap]}>
        <TouchableOpacity
          style={[
            stylesheet.submitBtn,
            {
              backgroundColor: canPost ? theme.colors.G : theme.colors.G + '50',
              shadowColor: theme.colors.G,
            },
          ]}
          disabled={!canPost}
          onPress={onSubmit}
          onPressIn={onBtnIn}
          onPressOut={onBtnOut}
          activeOpacity={1}
        >
          <Ionicons name="send-outline" size={18} color="#0B0D0B" style={{ marginRight: 10 }} />
          <Text style={stylesheet.submitTxt}>{isSubmitting ? 'Posting…' : 'Post to Yrdly'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  pillTxt: { fontSize: 12, fontWeight: '800' },
  menu: {
    position: 'absolute',
    top: 30,
    left: 0,
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 100,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  menuItem: { paddingVertical: 10, paddingHorizontal: 16 },
  composerCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  composerInput: { fontSize: 18, minHeight: 140, lineHeight: 26, textAlignVertical: 'top' },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 10,
  },
  pollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pollTxt: { fontSize: 12, fontWeight: '700' },
  charCount: { fontSize: 12 },
  toolbarCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  toolBtn: { flex: 1, alignItems: 'center', gap: 8 },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolLabel: { fontSize: 12, fontWeight: '600' },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 1 },
  visIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  visPillTxt: { fontSize: 13, fontWeight: '700' },
  imgGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  imgWrap: {
    width: IMG_W,
    height: IMG_W,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  imgRemove: { position: 'absolute', top: 4, right: 4 },
  addMore: {
    width: IMG_W,
    height: IMG_W,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addMoreTxt: { fontSize: 11, fontWeight: '600' },
  submitWrap: { marginTop: 8, marginBottom: 32 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    paddingVertical: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  submitTxt: { color: '#0B0D0B', fontSize: 17, fontWeight: '900' },
}));
