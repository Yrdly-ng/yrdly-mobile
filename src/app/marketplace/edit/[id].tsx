import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect, useCallback } from 'react';
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
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import ImagePicker from 'react-native-image-crop-picker';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { usePosts } from '../../../hooks/use-posts';
import { StorageService } from '../../../lib/storage-service';
import { parseSafePrice } from '../../../lib/utils';
import { Post } from '../../../types';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useCategories } from '../../../hooks/use-categories';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

export default function EditMarketplaceItemScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { deletePost } = usePosts();
  const { categories, loading: categoriesLoading } = useCategories('marketplace');

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form State
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [address, setAddress] = useState('');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);

  const fetchPost = useCallback(async () => {
    if (!id || user === undefined) return;
    const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();

    if (!error && data) {
      if (user !== null && data.user_id !== user.id) {
        Alert.alert('Unauthorized', 'You can only edit your own listings.');
        router.back();
        return;
      }
      setPost(data);
      setTitle(data.title || '');
      setText(data.text || '');
      setPrice(data.price?.toString() || '');
      setCategory(data.category || '');
      setCondition(data.condition || CONDITIONS[0]);
      setAddress(data.location?.address || '');

      let imgs: string[] = [];
      if (Array.isArray(data.image_urls)) {
        imgs = data.image_urls;
      } else if (typeof data.image_urls === 'string') {
        try {
          imgs = JSON.parse(data.image_urls);
        } catch (_) {}
      }
      setExistingImages(imgs);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const pickImage = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 1,
        compressImageMaxWidth: 4096,
        compressImageMaxHeight: 4096,
      });
      if (image) {
        setNewImages((prev) => [...prev, image.path]);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection') {
        console.error('Pick image error:', e);
      }
    }
  };

  const removeExistingImage = (idx: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeNewImage = (idx: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdate = async () => {
    if (!title.trim() || !price.trim()) {
      Alert.alert('Missing Details', 'Please provide a title and price.');
      return;
    }
    if (existingImages.length === 0 && newImages.length === 0) {
      Alert.alert('Missing Image', 'Please provide at least one image for your listing.');
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const parsedPrice = parseSafePrice(price);

      const uploadedUrls: string[] = [];
      for (let i = 0; i < newImages.length; i++) {
        const { url } = await StorageService.uploadPostImage(
          user!.id,
          {
            uri: newImages[i],
            type: 'image/jpeg',
            name: `edit_${id}_${Date.now()}_${i}.jpg`,
          },
          (p) => setUploadProgress((i + p) / newImages.length)
        );
        if (url) uploadedUrls.push(url);
      }

      const finalImages = [...existingImages, ...uploadedUrls];

      const updateData = {
        title: title.trim(),
        text: text.trim(),
        price: parsedPrice,
        category,
        condition,
        image_urls: finalImages,
        // location: address.trim() ? { address: address.trim() } : (post as any)?.location,
      };

      const { error } = await supabase.from('posts').update(updateData).eq('id', id);

      if (error) throw error;

      Alert.alert('Updated! 🎉', 'Your listing has been successfully updated.', [
        { text: 'View Listing', onPress: () => router.replace(`/marketplace/${id}` as any) },
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error('Post update error:', e);
      Alert.alert('Error', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await deletePost(id);
              DeviceEventEmitter.emit('post_deleted', id);
              router.replace('/');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[stylesheet.centerContainer, { backgroundColor: theme.colors.DARK }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={[stylesheet.centerContainer, { backgroundColor: theme.colors.DARK }]}>
        <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Outfit' }}>
          Listing not found
        </Text>
      </SafeAreaView>
    );
  }

  const combinedImages = [
    ...existingImages.map((u) => ({ url: u, isNew: false })),
    ...newImages.map((u) => ({ url: u, isNew: true })),
  ];

  const isReady =
    title.trim() && price.trim() && (existingImages.length > 0 || newImages.length > 0);

  return (
    <SafeAreaView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={stylesheet.header}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={stylesheet.headerTitle}>Edit Listing</Text>
          <Text style={stylesheet.headerSub}>{post.title}</Text>
        </View>
        <TouchableOpacity
          onPress={handleUpdate}
          disabled={isSubmitting || !isReady}
          style={[stylesheet.saveBtn, (!isReady || isSubmitting) && { opacity: 0.5 }]}
        >
          {isSubmitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ActivityIndicator size="small" color="#000" />
              {uploadProgress > 0 && (
                <Text style={[stylesheet.saveBtnTxt, { fontSize: 11 }]}>
                  {Math.round(uploadProgress * 100)}%
                </Text>
              )}
            </View>
          ) : (
            <Text style={stylesheet.saveBtnTxt}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
      {isSubmitting && uploadProgress > 0 && (
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={stylesheet.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Photos Section ── */}
          <View style={stylesheet.sectionHeader}>
            <MaterialIcons name="photo-library" size={18} color={theme.colors.G} />
            <Text style={stylesheet.sectionTitle}>Photos</Text>
            <Text style={stylesheet.sectionHint}>{combinedImages.length}/10</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
          >
            {combinedImages.map((img, i) => {
              return (
                <View key={i} style={stylesheet.photoBox}>
                  <Image
                    source={{ uri: img.url }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    contentFit="cover"
                  />
                  {i === 0 && (
                    <View style={stylesheet.coverBadge}>
                      <Text style={stylesheet.coverBadgeTxt}>Cover</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={stylesheet.removePhotoBtn}
                    onPress={() => {
                      if (img.isNew) {
                        const newIdx = newImages.indexOf(img.url);
                        removeNewImage(newIdx);
                      } else {
                        const oldIdx = existingImages.indexOf(img.url);
                        removeExistingImage(oldIdx);
                      }
                    }}
                  >
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            })}

            {combinedImages.length < 10 && (
              <TouchableOpacity style={stylesheet.addPhotoBtn} onPress={pickImage}>
                <Ionicons name="add" size={28} color={theme.colors.LABEL} />
                <Text
                  style={{
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: theme.colors.LABEL,
                    marginTop: 4,
                  }}
                >
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* ── Details Section ── */}
          <View style={[stylesheet.sectionHeader, { marginTop: 24 }]}>
            <Feather name="tag" size={16} color={theme.colors.G} />
            <Text style={stylesheet.sectionTitle}>Details</Text>
          </View>

          <View style={stylesheet.card}>
            {/* Title */}
            <View style={stylesheet.fieldBlock}>
              <Text style={stylesheet.fieldLabel}>TITLE</Text>
              <TextInput
                style={stylesheet.input}
                placeholder="What are you selling?"
                placeholderTextColor={theme.colors.MUTED}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={stylesheet.divider} />

            {/* Price */}
            <View style={stylesheet.fieldBlock}>
              <Text style={stylesheet.fieldLabel}>PRICE (₦)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: 'Outfit-Bold',
                    fontSize: 22,
                    color: theme.colors.G,
                    marginRight: 8,
                  }}
                >
                  ₦
                </Text>
                <TextInput
                  style={[
                    stylesheet.input,
                    {
                      flex: 1,
                      fontFamily: 'Outfit-Bold',
                      fontSize: 18,
                      color: theme.colors.G,
                      borderColor: 'rgba(130,219,126,0.2)',
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor={theme.colors.MUTED}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* ── Category ── */}
          <View style={[stylesheet.sectionHeader, { marginTop: 20 }]}>
            <Ionicons name="grid-outline" size={16} color={theme.colors.G} />
            <Text style={stylesheet.sectionTitle}>Category</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {categoriesLoading ? (
              <ActivityIndicator color={theme.colors.GOLD} />
            ) : (
              categories.map((c) => {
                const active = category === c.name;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCategory(c.name)}
                    style={[
                      stylesheet.chipBtn,
                      {
                        backgroundColor: active ? 'rgba(130,219,126,0.15)' : theme.colors.SURFACE,
                        borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        stylesheet.chipTxt,
                        { color: active ? theme.colors.G : theme.colors.MUTED },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* ── Condition ── */}
          <View style={[stylesheet.sectionHeader, { marginTop: 20 }]}>
            <Feather name="activity" size={16} color={theme.colors.G} />
            <Text style={stylesheet.sectionTitle}>Condition</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CONDITIONS.map((c) => {
              const active = condition === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCondition(c)}
                  style={[
                    stylesheet.chipBtn,
                    {
                      backgroundColor: active ? 'rgba(130,219,126,0.15)' : theme.colors.SURFACE,
                      borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                    },
                  ]}
                >
                  <Text
                    style={[
                      stylesheet.chipTxt,
                      { color: active ? theme.colors.G : theme.colors.MUTED },
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Description ── */}
          <View style={[stylesheet.sectionHeader, { marginTop: 20 }]}>
            <Feather name="align-left" size={16} color={theme.colors.G} />
            <Text style={stylesheet.sectionTitle}>Description</Text>
          </View>
          <View style={stylesheet.card}>
            <TextInput
              style={[
                stylesheet.input,
                stylesheet.textarea,
                { borderWidth: 0, backgroundColor: 'transparent', padding: 0 },
              ]}
              placeholder="Describe your item in detail — include brand, specs, defects, etc."
              placeholderTextColor={theme.colors.MUTED}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── Location ── */}
          <View style={[stylesheet.sectionHeader, { marginTop: 20 }]}>
            <Ionicons name="location-outline" size={16} color={theme.colors.G} />
            <Text style={stylesheet.sectionTitle}>Location</Text>
          </View>
          <View style={[stylesheet.card, { padding: 0, overflow: 'hidden', zIndex: 10 }]}>
            <GooglePlacesAutocomplete
              placeholder={address || 'Search for a location in Nigeria...'}
              onPress={(data) => {
                setAddress(data.description);
              }}
              query={{
                key: GOOGLE_MAPS_KEY,
                language: 'en',
                components: 'country:ng',
              }}
              styles={{
                textInputContainer: {
                  backgroundColor: 'transparent',
                  borderBottomWidth: 0,
                },
                textInput: {
                  height: 50,
                  backgroundColor: 'transparent',
                  color: theme.colors.TEXT_PRIMARY,
                  fontSize: 15,
                  fontFamily: 'Inter',
                  paddingHorizontal: 16,
                },
                listView: {
                  backgroundColor: theme.colors.SURFACE_ALT,
                  borderWidth: 1,
                  borderColor: theme.colors.GLASS_BORDER,
                  borderRadius: 14,
                  marginHorizontal: 8,
                  marginBottom: 8,
                },
                row: {
                  backgroundColor: 'transparent',
                  padding: 13,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.GLASS_BORDER,
                },
                description: {
                  color: theme.colors.TEXT_PRIMARY,
                  fontFamily: 'Inter',
                  fontSize: 14,
                },
                poweredContainer: { display: 'none' },
              }}
              fetchDetails={false}
              enablePoweredByContainer={false}
              textInputProps={{
                placeholderTextColor: address ? theme.colors.TEXT_PRIMARY : theme.colors.MUTED,
                selectionColor: theme.colors.G,
              }}
            />
          </View>
          {address ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 6,
                paddingHorizontal: 2,
              }}
            >
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.G} />
              <Text
                style={{ fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED }}
                numberOfLines={1}
              >
                {address}
              </Text>
            </View>
          ) : null}

          {/* ── Delete ── */}
          <TouchableOpacity
            style={stylesheet.deleteButton}
            onPress={handleDelete}
            disabled={isSubmitting}
          >
            <Feather name="trash-2" size={16} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={stylesheet.deleteButtonText}>Delete Listing</Text>
          </TouchableOpacity>

          {/* ── Save (bottom) ── */}
          <TouchableOpacity
            style={[stylesheet.saveBottomBtn, (!isReady || isSubmitting) && { opacity: 0.5 }]}
            onPress={handleUpdate}
            disabled={isSubmitting || !isReady}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Feather name="check" size={18} color="#000" />
                <Text style={stylesheet.saveBottomTxt}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 17, color: theme.colors.TEXT_PRIMARY },
  headerSub: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.MUTED, marginTop: 1 },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: theme.colors.G,
  },
  saveBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' },

  scrollContent: { padding: 20, paddingBottom: 60, zIndex: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
    color: theme.colors.TEXT_PRIMARY,
    flex: 1,
  },
  sectionHint: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },

  card: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    padding: 16,
    marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER, marginVertical: 14 },

  photoBox: {
    width: 120,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.SURFACE,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 11,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coverBadgeTxt: { color: theme.colors.TEXT_PRIMARY, fontSize: 10, fontFamily: 'Inter-Bold' },
  addPhotoBtn: {
    width: 120,
    height: 120,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1.5,
    borderColor: theme.colors.GLASS_BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldBlock: { marginBottom: 4 },
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.LABEL,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter',
    fontSize: 15,
  },
  textarea: { height: 110, textAlignVertical: 'top' },

  chipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipTxt: { fontFamily: 'Inter-SemiBold', fontSize: 13 },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.05)',
    marginTop: 24,
    marginBottom: 12,
  },
  deleteButtonText: { color: '#EF4444', fontFamily: 'Outfit-Bold', fontSize: 15 },

  saveBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.G,
    borderRadius: 18,
    paddingVertical: 16,
    marginBottom: 8,
  },
  saveBottomTxt: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
}));
