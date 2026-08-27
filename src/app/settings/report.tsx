import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import ImagePicker from 'react-native-image-crop-picker';
import { Image } from 'expo-image';
import { useAuth } from '../../hooks/use-supabase-auth';
import { supabase } from '../../lib/supabase';
import { useCategories } from '../../hooks/use-categories';
import { StorageService } from '../../lib/storage-service';
export default function ReportScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);

  const router = useRouter();
  const { user } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories('report');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [image, setImage] = useState<{ uri: string; mime: string; name: string } | null>(null);

  const pickImage = async () => {
    try {
      const img = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 1,
      });

      if (img) {
        setImage({
          uri: img.path,
          mime: img.mime || 'image/jpeg',
          name: img.filename || `report-${Date.now()}.jpg`,
        });
      }
    } catch (e: any) {
      if (e.message !== 'User cancelled image selection') {
        console.error(e);
      }
    }
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in both the subject and description.');
      return;
    }

    setLoading(true);
    try {
      let uploadedImageUrl = null;
      if (image && user) {
        const file = {
          uri: image.uri,
          name: image.name,
          type: image.mime,
        };
        const { url, error: uploadError } = await StorageService.uploadReportImage(user.id, file);
        if (uploadError) {
          console.warn('Failed to upload image', uploadError);
        } else {
          uploadedImageUrl = url;
        }
      }

      // 1. Try to insert into reports table if it exists
      const insertData: any = {
        user_id: user?.id || null,
        category,
        subject: subject.trim(),
        description: description.trim(),
        status: 'open',
      };

      if (uploadedImageUrl) {
        insertData.image_url = uploadedImageUrl;
      }

      const { error } = await supabase.from('reports').insert(insertData);

      if (error) {
        // Table probably doesn't exist or RLS issue. Fallback to Email Support.
        console.warn('DB report insert failed, falling back to email client:', error);

        let bodyText = description;
        if (uploadedImageUrl) {
          bodyText += `\n\nAttached Image: ${uploadedImageUrl}`;
        }

        const safeSubject = encodeURIComponent(`[Report - ${category}] ${subject}`).replace(
          /%20/g,
          ' '
        );
        const safeBody = encodeURIComponent(bodyText).replace(/%20/g, ' ');

        const mailUrl = `mailto:support@yrdly.ng?subject=${safeSubject}&body=${safeBody}`;
        const supported = await Linking.canOpenURL(mailUrl);
        if (supported) {
          await Linking.openURL(mailUrl);
          Alert.alert(
            'Open Mail',
            'We opened your email app to send the report. Please send the pre-filled email.'
          );
          router.back();
        } else {
          Alert.alert(
            'Error',
            'Unable to open email client. Please send your report directly to support@yrdly.ng'
          );
        }
      } else {
        Alert.alert(
          'Thank You',
          'Your report has been submitted successfully. Our team will review it shortly.'
        );
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryLabel = category || 'Select Category';

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Report an Issue</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.desc}>
          If you run into technical bugs, have marketplace disputes, or wish to report inappropriate
          content or behaviour, let us know below.
        </Text>

        {/* Category Dropdown */}
        <Text style={s.inputLabel}>ISSUE CATEGORY</Text>
        <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowDropdown(!showDropdown)}>
          <Text style={s.dropdownBtnText}>{selectedCategoryLabel}</Text>
          <Ionicons
            name={showDropdown ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.LABEL}
          />
        </TouchableOpacity>

        {showDropdown && (
          <View style={s.dropdownOptions}>
            {categoriesLoading ? (
              <ActivityIndicator color={theme.colors.GOLD} style={{ padding: 12 }} />
            ) : (
              categories.map((c, idx) => {
                return (
                  <React.Fragment key={c.id}>
                    {idx > 0 && <View style={s.divider} />}
                    <TouchableOpacity
                      style={s.optionItem}
                      onPress={() => {
                        setCategory(c.name);
                        setShowDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          s.optionText,
                          category === c.name && {
                            color: theme.colors.G,
                            fontFamily: 'Inter-SemiBold',
                          },
                        ]}
                      >
                        {c.name}
                      </Text>
                      {category === c.name && (
                        <Ionicons name="checkmark" size={18} color={theme.colors.G} />
                      )}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })
            )}
          </View>
        )}

        {/* Subject */}
        <Text style={[s.inputLabel, { marginTop: 16 }]}>SUBJECT</Text>
        <View style={s.inputBox}>
          <TextInput
            placeholder="e.g. Can't link bank account"
            placeholderTextColor={theme.colors.LABEL}
            style={s.textInput}
            value={subject}
            onChangeText={setSubject}
          />
        </View>

        {/* Description */}
        <Text style={[s.inputLabel, { marginTop: 16 }]}>DESCRIPTION</Text>
        <View style={[s.inputBox, { height: 140, alignItems: 'flex-start', paddingTop: 12 }]}>
          <TextInput
            placeholder="Describe the issue in detail..."
            placeholderTextColor={theme.colors.LABEL}
            style={[s.textInput, { height: '100%', textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
          />
        </View>

        {/* Attachment */}
        <Text style={[s.inputLabel, { marginTop: 16 }]}>ATTACHMENT (OPTIONAL)</Text>
        <TouchableOpacity style={s.imageUploadBtn} onPress={pickImage}>
          {image ? (
            <>
              <Image source={{ uri: image.uri }} style={s.previewImage} contentFit="cover" />
              <TouchableOpacity style={s.removeImageBtn} onPress={() => setImage(null)}>
                <Ionicons name="close" size={16} color={theme.colors.TEXT_PRIMARY} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Feather name="image" size={24} color={theme.colors.MUTED} />
              <Text style={s.uploadText}>Tap to select an image</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.TEXT_PRIMARY} />
          ) : (
            <Text style={s.submitBtnText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const sStylesheet = createStyleSheet((theme) => ({
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
  content: { padding: 20 },
  desc: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    lineHeight: 22,
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: theme.colors.MUTED,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  dropdownBtnText: { fontFamily: 'Inter', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  dropdownOptions: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    overflow: 'hidden',
    marginBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: { fontFamily: 'Inter', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter',
    fontSize: 14,
    height: '100%',
  },
  imageUploadBtn: {
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    borderRadius: 12,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  uploadText: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.MUTED, marginTop: 8 },
  previewImage: { width: '100%', height: '100%' },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.G,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.colors.TEXT_PRIMARY },
}));
