import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase';
import ImagePicker from 'react-native-image-crop-picker';
import { StorageService } from '../../lib/storage-service';
import { useAuth } from '../../hooks/use-supabase-auth';
const CATS = [
  { name: 'Food', icon: 'fast-food-outline' },
  { name: 'Baked Goods', icon: 'pie-chart-outline' },
  { name: 'Drinks', icon: 'cafe-outline' },
  { name: 'Services', icon: 'briefcase-outline' },
  { name: 'Other', icon: 'apps-outline' },
];

export default function CreateCatalogItemScreen() {
  const { styles: sStylesheet, theme } = useStyles(stylesheet);

  const router = useRouter();
  const { business_id: businessId, id: itemId } = useLocalSearchParams<{
    business_id?: string;
    id?: string;
  }>();
  const { user } = useAuth();

  const isEditMode = !!itemId;

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(CATS[0].name);
  const [inStock, setInStock] = useState(true);
  const [quantity, setQuantity] = useState('1');

  const [imageUris, setImageUris] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(isEditMode);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;
    (async () => {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('id', itemId)
        .maybeSingle();
      if (error || !data) {
        Alert.alert('Error', 'Could not load item.');
        router.back();
        return;
      }
      setTitle(data.title || '');
      setPrice(String(data.price || ''));
      setCategory(data.category || CATS[0].name);
      setInStock(data.in_stock ?? true);
      setQuantity(String(data.inventory_count ?? data.quantity ?? 1));
      let imgs: string[] = [];
      if (Array.isArray(data.images)) imgs = data.images;
      else if (typeof data.images === 'string') {
        try {
          imgs = JSON.parse(data.images);
        } catch (_) {}
      }
      setExistingImageUrls(imgs);
      setInitLoading(false);
    })();
  }, [itemId, isEditMode]);

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
        setImageUris((prev) => [...prev, image.path]);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection') {
        console.error('Pick image error:', e);
      }
    }
  };

  const removeNewImage = (index: number) =>
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  const removeExistingImage = (index: number) =>
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!title.trim() || !price.trim()) {
      return Alert.alert('Error', 'Please enter a title and price.');
    }

    if (!isEditMode && (!businessId || typeof businessId !== 'string')) {
      return Alert.alert('Error', 'Invalid business context.');
    }

    setLoading(true);
    try {
      const fields = {
        title: title.trim(),
        description: '',
        price: parseFloat(price) || 0,
        category,
        in_stock: inStock,
        inventory_count: parseInt(quantity, 10) || 0,
      };

      let targetItemId = itemId;

      if (isEditMode) {
        const { error } = await supabase.from('catalog_items').update(fields).eq('id', itemId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('catalog_items')
          .insert({ business_id: businessId, ...fields })
          .select('id')
          .single();
        if (error) throw error;
        targetItemId = data.id;
      }

      const newUrls: string[] = [];
      if (imageUris.length > 0 && targetItemId) {
        const uploadBizId = businessId || 'catalog';
        for (let i = 0; i < imageUris.length; i++) {
          const { url } = await StorageService.uploadBusinessImage(uploadBizId, {
            uri: imageUris[i],
            name: `catalog_${targetItemId}_${Date.now()}_${i}.jpg`,
            type: 'image/jpeg',
          });
          if (url) newUrls.push(url);
        }
      }

      const finalImages = [...existingImageUrls, ...newUrls];
      if (finalImages.length > 0 || isEditMode) {
        await supabase.from('catalog_items').update({ images: finalImages }).eq('id', targetItemId);
      }

      setAdded(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save item.');
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) {
    return (
      <View style={[sStylesheet.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.G} />
      </View>
    );
  }

  if (added) {
    return (
      <View style={[sStylesheet.root, sStylesheet.addedScreen]}>
        <View style={sStylesheet.addedIconBox}>
          <Ionicons name="checkmark" size={24} color={theme.colors.G} />
        </View>
        <Text style={sStylesheet.addedTitle}>Item {isEditMode ? 'Updated' : 'Added'}!</Text>
        <Text style={sStylesheet.addedSubtitle}>"{title}" is now on your storefront.</Text>
        <TouchableOpacity style={sStylesheet.addedBtn} onPress={() => router.back()}>
          <Text style={sStylesheet.addedBtnTxt}>Back to Storefront</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasData = title.trim().length > 0 && price.trim().length > 0;
  const combinedImages = [
    ...existingImageUrls.map((u) => ({ url: u, isNew: false })),
    ...imageUris.map((u) => ({ url: u, isNew: true })),
  ];

  return (
    <SafeAreaView style={sStylesheet.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={sStylesheet.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={sStylesheet.backBtn}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={sStylesheet.headerTitle}>{isEditMode ? 'Edit Item' : 'Add Item'}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sStylesheet.contentPad}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo Picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sStylesheet.photoScrollContainer}
          >
            {combinedImages.map((img, i) => {
              return (
                <View
                  key={i}
                  style={[
                    sStylesheet.photoBox,
                    { borderColor: i === 0 ? theme.colors.G : 'transparent', borderWidth: 2 },
                  ]}
                >
                  <Image
                    source={{ uri: img.url }}
                    style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={sStylesheet.removePhotoBtn}
                    onPress={() => {
                      if (img.isNew) {
                        const newIdx = imageUris.indexOf(img.url);
                        removeNewImage(newIdx);
                      } else {
                        const oldIdx = existingImageUrls.indexOf(img.url);
                        removeExistingImage(oldIdx);
                      }
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity style={sStylesheet.addPhotoBtn} onPress={pickImage}>
              <Ionicons name="images-outline" size={22} color={theme.colors.LABEL} />
            </TouchableOpacity>
          </ScrollView>

          {/* Title */}
          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Item Title</Text>
            <TextInput
              style={sStylesheet.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Jollof Rice (Full Pot)"
              placeholderTextColor={theme.colors.MUTED}
            />
          </View>

          {/* Price */}
          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Price (₦)</Text>
            <View style={sStylesheet.priceBox}>
              <Text style={sStylesheet.priceSymbol}>₦</Text>
              <TextInput
                style={sStylesheet.priceInput}
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={theme.colors.MUTED}
                keyboardType="numeric"
                selectionColor={theme.colors.G}
              />
            </View>
          </View>

          <View style={sStylesheet.fieldBlock}>
            <Text style={sStylesheet.fieldLabel}>Category</Text>
            <View style={sStylesheet.catWrap}>
              {CATS.map((c) => {
                const active = category === c.name;
                return (
                  <TouchableOpacity
                    key={c.name}
                    onPress={() => setCategory(c.name)}
                    style={[
                      sStylesheet.catBtn,
                      {
                        backgroundColor: active ? theme.colors.G : theme.colors.SURFACE,
                        borderColor: active ? theme.colors.G : theme.colors.GLASS_BORDER,
                      },
                    ]}
                  >
                    <Ionicons
                      name={c.icon as any}
                      size={18}
                      color={active ? '#000' : theme.colors.MUTED}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        sStylesheet.catTxt,
                        {
                          color: active ? '#000' : theme.colors.MUTED,
                          fontFamily: active ? 'Inter-SemiBold' : 'Inter',
                        },
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* In Stock toggle */}
          <View style={sStylesheet.stockRow}>
            <View>
              <Text style={sStylesheet.stockTitle}>In Stock</Text>
              <Text style={sStylesheet.stockDesc}>Visible and available to order</Text>
            </View>
            <Switch
              value={inStock}
              onValueChange={setInStock}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.G }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.1)"
            />
          </View>

          {/* Quantity */}
          {inStock && (
            <View style={sStylesheet.fieldBlock}>
              <Text style={sStylesheet.fieldLabel}>Inventory Count (Quantity)</Text>
              <TextInput
                style={sStylesheet.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0"
                placeholderTextColor={theme.colors.MUTED}
                keyboardType="numeric"
                selectionColor={theme.colors.G}
              />
            </View>
          )}
        </ScrollView>

        <View style={sStylesheet.bottomArea}>
          <TouchableOpacity
            style={[
              sStylesheet.submitBtn,
              { backgroundColor: hasData ? theme.colors.G : 'rgba(130,219,126,0.2)' },
            ]}
            onPress={handleSave}
            disabled={!hasData || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={hasData ? '#000' : 'rgba(130,219,126,0.4)'} />
            ) : (
              <Text
                style={[
                  sStylesheet.submitBtnTxt,
                  { color: hasData ? '#000' : 'rgba(130,219,126,0.4)' },
                ]}
              >
                {isEditMode ? 'Save Changes' : 'Add to Storefront'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },

  contentPad: { paddingHorizontal: 20, paddingVertical: 20, gap: 20 },

  photoScrollContainer: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  photoBox: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: theme.colors.TEXT_PRIMARY,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldBlock: {},
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.LABEL,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter',
    fontSize: 15,
  },

  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    paddingHorizontal: 16,
    gap: 8,
  },
  priceSymbol: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.LABEL },
  priceInput: {
    flex: 1,
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    height: '100%',
  },

  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
  },
  catTxt: { fontSize: 14 },

  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.SURFACE_ALT,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 18,
  },
  stockTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  stockDesc: { fontFamily: 'Inter', fontSize: 12, color: theme.colors.LABEL },

  bottomArea: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 16 },

  addedScreen: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  addedIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(130,219,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedTitle: { fontFamily: 'Outfit-Bold', fontSize: 22, color: theme.colors.TEXT_PRIMARY },
  addedSubtitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
  },
  addedBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.G,
  },
  addedBtnTxt: { fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' },
}));
