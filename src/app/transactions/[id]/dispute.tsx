import { createStyleSheet, useStyles } from 'react-native-unistyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import ImagePicker from 'react-native-image-crop-picker';
import { Image } from 'expo-image';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/use-supabase-auth';
import { DisputeService } from '../../../lib/dispute-service';

const DISPUTE_REASONS = [
  { value: 'item_not_received', label: 'Item Not Received' },
  { value: 'item_not_as_described', label: 'Item Not as Described' },
  { value: 'counterfeit_item', label: 'Counterfeit / Fake Item' },
  { value: 'damaged_item', label: 'Item Arrived Damaged' },
  { value: 'seller_unresponsive', label: 'Seller is Unresponsive' },
  { value: 'other', label: 'Other' },
];

export default function DisputeScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickPhotos = async () => {
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
        uploadPhotos([image.path]);
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection') {
        console.log('ImagePicker error:', e);
        Alert.alert('Error', 'Could not access the selected photo. Please try another one.');
      }
    }
  };

  const uploadPhotos = async (uris: string[]) => {
    if (!user) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const uri of uris) {
        const ext = uri.split('.').pop()?.split('?')[0] || 'jpeg';
        const fileName = `dispute_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = `disputes/${fileName}`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error } = await supabase.storage
          .from('image')
          .upload(filePath, blob, { contentType: `image/${ext}`, upsert: true });
        if (!error) {
          const { data } = supabase.storage.from('image').getPublicUrl(filePath);
          if (data.publicUrl) uploaded.push(data.publicUrl);
        }
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (e) {
      Alert.alert('Upload Failed', 'Some photos could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user || !id) return;
    if (!selectedReason) {
      Alert.alert('Missing Reason', 'Please select a reason for the dispute.');
      return;
    }
    if (description.trim().length < 20) {
      Alert.alert('More Detail Needed', 'Please describe the issue in at least 20 characters.');
      return;
    }

    Alert.alert(
      'Open Dispute?',
      'This will pause the transaction while our team reviews your case. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Dispute',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await DisputeService.openDispute(id, user.id, selectedReason, {
                description: description.trim(),
                photos,
              });
              Alert.alert(
                'Dispute Opened',
                'Our team will review your case and get back to you within 24 hours.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.back();
                      router.back();
                    },
                  },
                ]
              );
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not open dispute. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}>
      <View
        style={[
          stylesheet.header,
          { backgroundColor: theme.colors.SURFACE, borderBottomColor: theme.colors.GLASS_BORDER },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={[stylesheet.headerTitle, { color: theme.colors.TEXT_PRIMARY }]}>
          Open Dispute
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={stylesheet.scroll} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={[stylesheet.infoBanner, { backgroundColor: theme.colors.SURFACE }]}>
          <Feather name="shield" size={20} color="#1565C0" />
          <Text style={[stylesheet.infoText, { color: theme.colors.LABEL }]}>
            Disputes are reviewed by our team within 24 hours. The transaction will be paused until
            resolved.
          </Text>
        </View>

        {/* Reason Picker */}
        <View style={stylesheet.section}>
          <Text style={[stylesheet.sectionLabel, { color: theme.colors.MUTED }]}>
            REASON FOR DISPUTE
          </Text>
          {DISPUTE_REASONS.map((r) => {
            return (
              <TouchableOpacity
                key={r.value}
                style={[
                  stylesheet.reasonRow,
                  { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
                  selectedReason === r.value && {
                    borderColor: theme.colors.G,
                    backgroundColor: theme.colors.SURFACE,
                  },
                ]}
                onPress={() => setSelectedReason(r.value)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    stylesheet.radio,
                    { borderColor: theme.colors.MUTED },
                    selectedReason === r.value && { borderColor: theme.colors.G },
                  ]}
                >
                  {selectedReason === r.value && (
                    <View style={[stylesheet.radioDot, { backgroundColor: theme.colors.G }]} />
                  )}
                </View>
                <Text
                  style={[
                    stylesheet.reasonLabel,
                    { color: theme.colors.TEXT_PRIMARY },
                    selectedReason === r.value && { fontWeight: '700' },
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <View style={stylesheet.section}>
          <Text style={[stylesheet.sectionLabel, { color: theme.colors.MUTED }]}>
            DESCRIBE THE ISSUE
          </Text>
          <TextInput
            style={[
              stylesheet.textArea,
              {
                backgroundColor: theme.colors.SURFACE,
                borderColor: theme.colors.GLASS_BORDER,
                color: theme.colors.TEXT_PRIMARY,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell us what happened in as much detail as possible..."
            placeholderTextColor={theme.colors.MUTED}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={[stylesheet.charCount, { color: theme.colors.MUTED }]}>
            {description.length}/2000
          </Text>
        </View>

        {/* Photo Evidence */}
        <View style={stylesheet.section}>
          <Text style={[stylesheet.sectionLabel, { color: theme.colors.MUTED }]}>
            PHOTO EVIDENCE (OPTIONAL)
          </Text>
          <Text style={[stylesheet.sectionSub, { color: theme.colors.MUTED }]}>
            Attach photos of the item or chat screenshots (max 5)
          </Text>
          <View style={stylesheet.photosRow}>
            {photos.map((uri, i) => {
              return (
                <View key={i} style={stylesheet.photoWrapper}>
                  <Image source={{ uri }} style={stylesheet.photoThumb} contentFit="cover" />
                  <TouchableOpacity style={stylesheet.removePhoto} onPress={() => removePhoto(i)}>
                    <Feather name="x-circle" size={20} color="#B71C1C" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {photos.length < 5 && (
              <TouchableOpacity
                style={[
                  stylesheet.addPhotoBtn,
                  { backgroundColor: theme.colors.SURFACE, borderColor: theme.colors.GLASS_BORDER },
                ]}
                onPress={pickPhotos}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.colors.G} />
                ) : (
                  <Feather name="plus" size={28} color={theme.colors.G} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            stylesheet.submitBtn,
            (!selectedReason || submitting) && [
              stylesheet.submitBtnDisabled,
              { backgroundColor: theme.colors.MUTED },
            ],
          ]}
          onPress={handleSubmit}
          disabled={!selectedReason || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={stylesheet.submitBtnText}>Open Dispute</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 'bold' },
  scroll: { padding: 16 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionSub: { fontSize: 12, marginBottom: 12, marginTop: -8 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
  },
  reasonRowSelected: {},
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {},
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  reasonLabel: { fontSize: 15, fontWeight: '500' },
  reasonLabelSelected: { fontWeight: '700' },
  textArea: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 130,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrapper: { position: 'relative', width: 80, height: 80 },
  photoThumb: { width: 80, height: 80, borderRadius: 10 },
  removePhoto: { position: 'absolute', top: -8, right: -8 },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    backgroundColor: '#B71C1C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {},
  submitBtnText: { color: theme.colors.TEXT_PRIMARY, fontSize: 16, fontWeight: 'bold' },
}));
