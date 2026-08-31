import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import ImagePicker from 'react-native-image-crop-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../hooks/use-supabase-auth';
import { usePosts } from '../hooks/use-posts';
import { MobileFile } from '../lib/storage-service';
import * as FileSystem from 'expo-file-system/legacy';
import { Avatar } from '../components/Avatar';

export default function CreatePostScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { createPost } = usePosts();

  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [posted, setPosted] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<'approved' | 'pending'>('approved');
  const [attachedFiles, setAttachedFiles] = useState<MobileFile[]>([]);
  // Keyed by URI so dims stay correct if the user removes images before posting
  const [imageDimsMap, setImageDimsMap] = useState<Record<string, { w: number; h: number }>>({});
  const [category, setCategory] = useState('General');
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const categories = ['General'];

  const pickMedia = async (type: 'photo' | 'video') => {
    try {
      const isPhoto = type === 'photo';
      const options: any = { mediaType: type };

      if (isPhoto) {
        options.multiple = true;
        options.maxFiles = 10;
        options.compressImageQuality = 1;
        options.compressImageMaxWidth = 4096;
        options.compressImageMaxHeight = 4096;
      } else {
        options.multiple = true;
        options.maxFiles = 3;
      }

      const image = await ImagePicker.openPicker(options);

      if (image) {
        let validFiles: MobileFile[] = [];
        let videoCount = attachedFiles.filter((f) => f.type?.startsWith('video/')).length;

        const assets = Array.isArray(image) ? image : [image];
        for (const asset of assets) {
          const type = asset.mime || (asset.path.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

          if (type.startsWith('video/')) {
            videoCount++;
            if (videoCount > 3) {
              Alert.alert('Limit Reached', 'You can only upload up to 3 videos.');
              continue;
            }
            if (asset.path) {
              const fileInfo = await FileSystem.getInfoAsync(asset.path);
              if (fileInfo.exists && fileInfo.size && fileInfo.size > 40 * 1024 * 1024) {
                Alert.alert('File too large', 'Each video must be under 40MB.');
                continue;
              }
            }
          }

          const file: MobileFile = {
            uri: asset.path,
            name: asset.filename || `media_${Date.now()}`,
            type,
          };
          validFiles.push(file);

          // Capture dimensions for images
          if (type.startsWith('image/') && asset.width && asset.height) {
            setImageDimsMap((prev) => ({
              ...prev,
              [asset.path]: { w: asset.width, h: asset.height },
            }));
          }
        }
        setAttachedFiles((prev) => [...prev, ...validFiles]);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection' && e.message !== 'User cancelled') {
        Alert.alert('Error', e.message || 'Failed to pick media');
      }
    }
  };

  const pickImages = () => {
    Alert.alert('Attach Media', 'Choose the type of media to upload', [
      { text: 'Photo', onPress: () => pickMedia('photo') },
      { text: 'Video', onPress: () => pickMedia('video') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const doPost = async () => {
    if (!text.trim() && attachedFiles.length === 0) return;
    if (!user || !profile) {
      Alert.alert('Authentication required', 'Please sign in to post.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPosting(true);

    try {
      const images = attachedFiles.filter((f) => f.type?.startsWith('image/'));
      const videos = attachedFiles.filter((f) => f.type?.startsWith('video/'));

      // Resolve dims for whichever image will become image_urls[0]
      const firstImageDims = images.length > 0 ? (imageDimsMap[images[0].uri] ?? null) : null;

      const result = await createPost(
        {
          text: text.trim(),
          category: category as any,
          visibility: visibility,
          image_width: firstImageDims?.w ?? undefined,
          image_height: firstImageDims?.h ?? undefined,
        },
        undefined,
        images.length > 0 ? images : undefined,
        videos.length > 0 ? videos : undefined,
        (progress) => setUploadProgress(progress)
      );

      setPosting(false);
      setUploadProgress(0);
      setPosted(true);
      setModerationStatus((result?.moderationStatus as any) || 'approved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setPosting(false);
      setUploadProgress(0);
      Alert.alert('Error', error?.message || 'Failed to create post. Please try again.');
    }
  };

  const hasContent = text.trim().length > 0 || attachedFiles.length > 0;

  if (posted) {
    if (moderationStatus === 'pending') {
      return (
        <View style={[stylesheet.successContainer, { backgroundColor: theme.colors.DARK }]}>
          <View
            style={[
              stylesheet.successIcon,
              {
                backgroundColor: 'rgba(255, 165, 0, 0.12)',
                borderColor: 'rgba(255, 165, 0, 0.25)',
              },
            ]}
          >
            <Feather name="clock" size={34} color="#FFA500" />
          </View>
          <Text style={stylesheet.successTitle}>Sent for Moderation</Text>
          <Text style={stylesheet.successDesc}>
            Your post was flagged and has been sent for admin review. It will appear on the feed
            once approved.
          </Text>
          <TouchableOpacity style={stylesheet.backButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={stylesheet.backButtonText}>Back to Feed</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[stylesheet.successContainer, { backgroundColor: theme.colors.DARK }]}>
        <View style={stylesheet.successIcon}>
          <Feather name="check" size={34} color={theme.colors.G} />
        </View>
        <Text style={stylesheet.successTitle}>Posted!</Text>
        <Text style={stylesheet.successDesc}>Your post is now live in your neighbourhood.</Text>
        <TouchableOpacity style={stylesheet.backButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={stylesheet.backButtonText}>Back to Feed</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={stylesheet.header}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.headerBtn}>
          <Text style={stylesheet.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={stylesheet.headerTitle}>New Post</Text>
        <TouchableOpacity
          onPress={doPost}
          disabled={!hasContent || posting}
          style={[
            stylesheet.postButton,
            { backgroundColor: hasContent ? theme.colors.G : 'rgba(130,219,126,0.25)' },
          ]}
        >
          {posting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ActivityIndicator size="small" color="#000" />
              {uploadProgress > 0 && (
                <Text style={[stylesheet.postButtonText, { color: '#000', fontSize: 12 }]}>
                  {Math.round(uploadProgress * 100)}%
                </Text>
              )}
            </View>
          ) : (
            <Text
              style={[
                stylesheet.postButtonText,
                { color: hasContent ? '#000' : 'rgba(130,219,126,0.5)' },
              ]}
            >
              Post
            </Text>
          )}
        </TouchableOpacity>
      </View>
      {posting && uploadProgress > 0 && (
        <View style={{ height: 3, backgroundColor: 'rgba(130,219,126,0.2)' }}>
          <View
            style={{
              height: 3,
              backgroundColor: theme.colors.G,
              width: `${Math.round(uploadProgress * 100)}%`,
            }}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={stylesheet.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={stylesheet.authorRow}>
          <Avatar
            url={profile?.avatar_url}
            name={profile?.name}
            size={100}
            style={stylesheet.avatarImage as any}
            fallbackStyle={stylesheet.avatar as any}
            fallbackTextStyle={stylesheet.avatarText}
          />
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Text style={stylesheet.authorName}>{profile?.name || 'Neighbour'}</Text>
            <View style={stylesheet.areaPill}>
              <Ionicons name="pricetag-outline" size={12} color={theme.colors.G} />
              <Text style={stylesheet.areaText}>{category}</Text>
            </View>

            <TouchableOpacity
              style={[
                stylesheet.areaPill,
                {
                  backgroundColor:
                    visibility === 'private' ? 'rgba(255, 165, 0, 0.15)' : 'rgba(130,219,126,0.15)',
                },
              ]}
              onPress={() => setVisibility((v) => (v === 'public' ? 'private' : 'public'))}
            >
              <Ionicons
                name={visibility === 'public' ? 'earth' : 'people'}
                size={12}
                color={visibility === 'public' ? theme.colors.G : '#FFA500'}
              />
              <Text
                style={[
                  stylesheet.areaText,
                  { color: visibility === 'public' ? theme.colors.G : '#FFA500' },
                ]}
              >
                {visibility === 'public' ? 'Public' : 'Friends Only'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={stylesheet.input}
          placeholder="What's happening in your neighbourhood?"
          placeholderTextColor={theme.colors.MUTED}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          selectionColor={theme.colors.G}
        />

        {attachedFiles.length > 0 && (
          <View style={stylesheet.photosGrid}>
            {attachedFiles.map((file, i) => {
              return (
                <View key={i} style={stylesheet.photoWrapper}>
                  <Image source={{ uri: file.uri }} style={stylesheet.attachedImage} />
                  {file.type?.startsWith('video/') && !posting && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                      }}
                    >
                      <Ionicons name="play-circle" size={32} color={theme.colors.TEXT_PRIMARY} />
                    </View>
                  )}
                  {posting && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: 8,
                      }}
                    >
                      <ActivityIndicator size="small" color={theme.colors.TEXT_PRIMARY} />
                    </View>
                  )}
                  {!posting && (
                    <TouchableOpacity
                      style={stylesheet.removePhotoBtn}
                      onPress={() => setAttachedFiles((p) => p.filter((_, j) => j !== i))}
                    >
                      <Feather name="x" size={14} color={theme.colors.TEXT_PRIMARY} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[stylesheet.toolbar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={stylesheet.addPhotoBtn} onPress={pickImages}>
          <Ionicons name="image-outline" size={22} color={theme.colors.G} />
          <Text
            style={{
              color: theme.colors.TEXT_PRIMARY,
              fontFamily: 'Inter-Medium',
              fontSize: 13,
              marginLeft: 8,
            }}
          >
            Add Media
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerBtn: { paddingVertical: 8, paddingRight: 16 },
  cancelText: { fontFamily: 'Inter-Medium', fontSize: 15, color: theme.colors.MUTED },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 17, color: theme.colors.TEXT_PRIMARY },
  postButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: { fontFamily: 'Outfit-Bold', fontSize: 14 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.G,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
  authorName: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 2,
  },
  areaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignSelf: 'flex-start',
  },
  areaText: { fontFamily: 'Inter-Medium', fontSize: 12, color: theme.colors.TEXT_PRIMARY },
  categoryMenu: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    overflow: 'hidden',
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  categoryOptionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
  },
  input: {
    paddingHorizontal: 20,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    lineHeight: 24,
    minHeight: 150,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  attachedImage: { width: '100%', height: '100%' },
  removePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
    backgroundColor: theme.colors.DARK,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(130,219,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 24,
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
  },
  successDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    marginTop: 8,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.G,
  },
  backButtonText: { fontFamily: 'Outfit-Bold', fontSize: 15, color: '#000' },
}));
