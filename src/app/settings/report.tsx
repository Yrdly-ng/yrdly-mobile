import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import ImagePicker from 'react-native-image-crop-picker';
import { Image } from 'expo-image';
import { useAuth } from '../../hooks/use-supabase-auth';
import { supabase } from '../../lib/supabase/supabase';
import { useCategories } from '../../hooks/categories/use-categories';
import { StorageService } from '../../lib/media/storage-service';
export default function ReportScreen() {
  const { theme } = useUnistyles();
  const s = sStylesheet;

  const router = useRouter();
  const params = useLocalSearchParams<{ reported_user_id?: string; reported_post_id?: string; conversation_id?: string; category?: string }>();
  const reportedUserId =
    typeof params.reported_user_id === 'string' ? params.reported_user_id : undefined;
  const reportedPostId =
    typeof params.reported_post_id === 'string' ? params.reported_post_id : undefined;
  const conversationId =
    typeof params.conversation_id === 'string' ? params.conversation_id : undefined;
  const submitting = useRef(false);
  const { user } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories('report');
  const [category, setCategory] = useState(params.category === 'Child safety' ? 'Child safety' : '');
  const [subject, setSubject] = useState(reportedUserId ? 'Report a user' : reportedPostId ? 'Report a post' : '');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [image, setImage] = useState<{ uri: string; mime: string; name: string } | null>(null);

  const pickImage = async () => {
    if (category === 'Child safety') return;
    try {
      const img = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 1,
        compressImageMaxWidth: 4096,
        compressImageMaxHeight: 4096,
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
    if (submitting.current) return;
    if (!user) {
      Alert.alert('Error', 'Please sign in before submitting a report.');
      return;
    }
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in both the subject and description.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      let uploadedImageUrl = null;
      if (image && user && category !== 'Child safety') {
        const file = {
          uri: image.uri,
          name: image.name,
          type: image.mime,
        };
        const { url, error: uploadError } = await StorageService.uploadReportImage(user.id, file);
        if (uploadError) throw uploadError;
        uploadedImageUrl = url;
      }

      // Keep the target and conversation attached to the moderator's report.
      const insertData: any = {
        user_id: user.id,
        ...(reportedUserId ? { reported_user_id: reportedUserId } : {}),
        ...(reportedPostId ? { reported_post_id: reportedPostId } : {}),
        category,
        subject: subject.trim(),
        description: `${description.trim()}${conversationId ? `\n\nConversation: ${conversationId}` : ''}`,
        status: 'open',
      };

      if (uploadedImageUrl) {
        insertData.image_url = uploadedImageUrl;
      }

      const { error } = await supabase.from('reports').insert(insertData);

      if (error) throw error;
      Alert.alert(
        'Thank You',
        'Your report has been submitted successfully. Our team will review it shortly.'
      );
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit report.');
    } finally {
      submitting.current = false;
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

        {reportedUserId && (
          <Text style={s.desc}>
            The reported account{conversationId ? ' and conversation' : ''} will be included for our
            safety team.
          </Text>
        )}
        {reportedPostId && (
          <Text style={s.desc}>
            Reported post reference: {reportedPostId}. The reference will be included for our safety team.
          </Text>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: category === 'Child safety' }}
          disabled={loading}
          style={s.dropdownBtn}
          onPress={() => {
            setCategory('Child safety');
            setImage(null);
            setShowDropdown(false);
          }}
        >
          <Feather name="shield" size={18} color={theme.colors.G} />
          <Text style={s.dropdownBtnText}>Child safety</Text>
          {category === 'Child safety' && <Ionicons name="checkmark" size={18} color={theme.colors.G} />}
        </TouchableOpacity>
        {category === 'Child safety' && (
          <Text style={s.desc}>
            Report suspected child sexual abuse, exploitation, grooming, or an underage account.
            Describe where it happened and include the account name or content link. Do not upload,
            download or forward suspected illegal images or videos. If a child is in immediate
            danger, contact local emergency services; this form is not an emergency service.
          </Text>
        )}

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

        {category !== 'Child safety' && (
          <>
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

          </>
        )}

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

const sStylesheet = StyleSheet.create((theme) => ({
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
