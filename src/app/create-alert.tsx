import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/use-supabase-auth';

const SEVERITY_COLORS = {
  information: {
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    text: '#3b82f6',
    icon: '#3b82f6',
  },
  caution: {
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    text: '#f59e0b',
    icon: '#f59e0b',
  },
  urgent: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    text: '#ef4444',
    icon: '#ef4444',
  },
};

const TYPE_LABELS = { safety: 'SAFETY ALERT', amber: 'AMBER ALERT', info: 'COMMUNITY INFO' };

export default function CreateAlertScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<'information' | 'caution' | 'urgent'>('caution');
  const [type, setType] = useState<'safety' | 'amber' | 'info'>('safety');
  const [area, setArea] = useState('');
  const [alertState, setAlertState] = useState('');
  const [alertLga, setAlertLga] = useState('');
  const [action, setAction] = useState('');

  const [published, setPublished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canPreview = title.trim() && desc.trim() && area.trim();

  const handlePublish = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { error } = await supabase.from('safety_alerts').insert({
        user_id: user.id,
        title,
        description: desc,
        severity,
        type,
        area_name: area,
        ...(alertState ? { state: alertState } : {}),
        ...(alertLga ? { lga: alertLga } : {}),
        ...(action ? { action } : {}),
        status: 'pending',
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPublished(true);
    } catch (err) {
      console.error(err);
      alert('Failed to publish alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (published) {
    return (
      <View style={[stylesheet.successContainer, { backgroundColor: theme.colors.DARK }]}>
        <View style={stylesheet.successIcon}>
          <Feather name="check" size={34} color={theme.colors.G} />
        </View>
        <Text style={stylesheet.successTitle}>Alert Submitted</Text>
        <Text style={stylesheet.successDesc}>
          The alert has been submitted to admins for review. It will be live once approved.
        </Text>
        <TouchableOpacity
          style={stylesheet.btnPrimary}
          onPress={() => router.replace('/catalog' as any)}
        >
          <Text style={stylesheet.btnPrimaryText}>Back to Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 8 }}>
          <Text style={stylesheet.btnText}>Back to Feed</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const c = SEVERITY_COLORS[severity];

  if (step === 'preview') {
    return (
      <View
        style={[
          stylesheet.container,
          { backgroundColor: theme.colors.DARK, paddingTop: insets.top },
        ]}
      >
        <View style={stylesheet.previewHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setStep('form')} style={stylesheet.backBtn}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={stylesheet.headerTitle}>Preview Alert</Text>
          </View>
          <TouchableOpacity
            onPress={handlePublish}
            style={[stylesheet.publishBtn, isSubmitting && { opacity: 0.7 }]}
            disabled={isSubmitting}
          >
            <Text style={stylesheet.publishBtnText}>
              {isSubmitting ? 'Submitting...' : 'Publish Alert'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={stylesheet.scrollContent}>
          <Text style={stylesheet.sectionLabel}>Home Feed Banner</Text>
          <View
            style={[stylesheet.bannerPreview, { backgroundColor: c.bg, borderColor: c.border }]}
          >
            <Feather name="alert-triangle" size={18} color={c.icon} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={[stylesheet.bannerType, { color: c.text }]}>{TYPE_LABELS[type]}</Text>
                <Text style={stylesheet.bannerMeta}>· {area || 'Your Area'} · Now</Text>
              </View>
              <Text style={stylesheet.bannerDesc}>
                {desc || 'Alert description will appear here.'}
              </Text>
            </View>
          </View>

          <Text style={[stylesheet.sectionLabel, { marginTop: 24 }]}>Alert Detail Preview</Text>
          <View style={[stylesheet.heroPreview, { backgroundColor: c.bg, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={[stylesheet.heroTypePill, { backgroundColor: `${c.icon}22` }]}>
                <Text style={[stylesheet.heroType, { color: c.text }]}>{TYPE_LABELS[type]}</Text>
              </View>
              <Text style={stylesheet.heroTime}>Now</Text>
            </View>
            <Text style={stylesheet.heroTitle}>{title || 'Alert title'}</Text>
            <Text style={stylesheet.heroArea}>📍 {area || 'Affected area'}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={stylesheet.header}>
        <TouchableOpacity onPress={() => router.back()} style={stylesheet.backBtn}>
          <Ionicons name="close" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={stylesheet.headerTitle}>Create Safety Alert</Text>
      </View>

      <ScrollView
        contentContainerStyle={stylesheet.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 24 }}>
          <View>
            <Text style={stylesheet.fieldLabel}>Severity</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(
                [
                  ['information', 'Info', '#64B5F6'],
                  ['caution', 'Caution', '#FFB74D'],
                  ['urgent', 'Urgent', '#EF4444'],
                ] as const
              ).map(([key, label, color]) => {
                const isSelected = severity === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setSeverity(key)}
                    style={[
                      stylesheet.severityBtn,
                      {
                        backgroundColor: isSelected ? `${color}15` : theme.colors.SURFACE,
                        borderColor: isSelected ? color : theme.colors.GLASS_BORDER,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        stylesheet.severityBtnText,
                        { color: isSelected ? color : theme.colors.MUTED },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={stylesheet.fieldLabel}>Alert Type</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(
                [
                  ['safety', 'Safety Alert'],
                  ['amber', 'Amber Alert'],
                  ['info', 'Community Info'],
                ] as const
              ).map(([key, label]) => {
                const isSelected = type === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setType(key)}
                    style={[
                      stylesheet.typeBtn,
                      {
                        backgroundColor: isSelected ? theme.colors.SURFACE : 'transparent',
                        borderColor: isSelected ? theme.colors.G : theme.colors.GLASS_BORDER,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        stylesheet.typeBtnText,
                        { color: isSelected ? theme.colors.TEXT_PRIMARY : theme.colors.MUTED },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={stylesheet.fieldLabel}>Alert Title</Text>
            <TextInput
              style={stylesheet.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Road closure at Admiralty Way"
              placeholderTextColor={theme.colors.MUTED}
            />
          </View>

          <View style={{ zIndex: 10 }}>
            <Text style={stylesheet.fieldLabel}>Affected Area</Text>
            <GooglePlacesAutocomplete
              placeholder="e.g. Lekki Phase 1, Lagos"
              onPress={(data, details = null) => {
                setArea(data.description);
                const d = data as any;
                if (d.terms && d.terms.length > 0) {
                  const terms = d.terms;
                  const countryIdx = terms.findIndex((t: any) => t.value === 'Nigeria');
                  if (countryIdx > 0) {
                    const s = terms[countryIdx - 1]?.value || '';
                    setAlertState(s);
                    if (countryIdx > 1) {
                      const l = terms[countryIdx - 2]?.value || '';
                      setAlertLga(l);
                      setArea(`${l}, ${s}`);
                    }
                  } else {
                    const s = terms[terms.length - 1]?.value || '';
                    setAlertState(s);
                    if (terms.length > 1) {
                      const l = terms[terms.length - 2]?.value || '';
                      setAlertLga(l);
                      setArea(`${l}, ${s}`);
                    }
                  }
                }
              }}
              query={{
                key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                language: 'en',
                components: 'country:ng',
              }}
              styles={{
                textInput: stylesheet.input,
                listView: {
                  backgroundColor: theme.colors.SURFACE,
                  borderRadius: 12,
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.GLASS_BORDER,
                },
                row: {
                  backgroundColor: theme.colors.SURFACE,
                  padding: 13,
                  height: 44,
                  flexDirection: 'row',
                },
                separator: {
                  height: 1,
                  backgroundColor: theme.colors.GLASS_BORDER,
                },
                description: {
                  color: theme.colors.TEXT_PRIMARY,
                },
              }}
              fetchDetails={false}
              enablePoweredByContainer={false}
              textInputProps={{
                placeholderTextColor: theme.colors.MUTED,
              }}
            />
          </View>

          <View>
            <Text style={stylesheet.fieldLabel}>Recommended Action</Text>
            <TextInput
              style={stylesheet.input}
              value={action}
              onChangeText={setAction}
              placeholder="e.g. Avoid Admiralty Way, use Chevron Drive"
              placeholderTextColor={theme.colors.MUTED}
            />
          </View>

          <View>
            <Text style={stylesheet.fieldLabel}>Description</Text>
            <TextInput
              style={[stylesheet.input, stylesheet.textArea]}
              value={desc}
              onChangeText={setDesc}
              placeholder="Factual description of what is happening…"
              placeholderTextColor={theme.colors.MUTED}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[stylesheet.bottomBar, { paddingBottom: insets.bottom || 20 }]}>
        <TouchableOpacity
          style={[stylesheet.continueBtn, !canPreview && stylesheet.continueBtnDisabled]}
          disabled={!canPreview}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep('preview');
          }}
        >
          <Text
            style={[stylesheet.continueBtnText, !canPreview && stylesheet.continueBtnTextDisabled]}
          >
            Preview Alert
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
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  publishBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ef4444',
  },
  publishBtnText: { fontFamily: 'Outfit-Bold', fontSize: 13, color: theme.colors.TEXT_PRIMARY },

  scrollContent: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },

  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.LABEL,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  severityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityBtnText: { fontFamily: 'Outfit-Bold', fontSize: 12 },

  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnText: { fontFamily: 'Inter-Regular', fontSize: 11 },

  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    color: theme.colors.TEXT_PRIMARY,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
  },
  textArea: { minHeight: 120 },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.GLASS_BORDER,
  },
  continueBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.G,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: 'rgba(130,219,126,0.2)' },
  continueBtnText: { fontFamily: 'Outfit-Bold', fontSize: 16, color: '#000' },
  continueBtnTextDisabled: { color: 'rgba(130,219,126,0.4)' },

  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 14,
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
    fontSize: 22,
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
  },
  successDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.MUTED,
    textAlign: 'center',
  },
  btnPrimary: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.G,
  },
  btnPrimaryText: { fontFamily: 'Outfit-Bold', fontSize: 14, color: '#000' },
  btnText: { fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.LABEL },

  sectionLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: theme.colors.LABEL,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bannerPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  bannerType: { fontFamily: 'Outfit-Bold', fontSize: 11 },
  bannerMeta: { fontFamily: 'Inter-Regular', fontSize: 10, color: theme.colors.LABEL },
  bannerDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.TEXT_PRIMARY,
    lineHeight: 18,
  },

  heroPreview: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderRadius: 24,
  },
  heroTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroType: { fontFamily: 'Outfit-Bold', fontSize: 11 },
  heroTime: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.LABEL },
  heroTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 8,
  },
  heroArea: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.LABEL },
}));
