import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'How does marketplace escrow work?',
    a: 'When you buy an item, your payment is held securely in escrow by YRDLY. Once you meet the seller and verify the item is in the described condition, you release the funds to the seller. This protects both parties from fraud.',
  },
  {
    q: 'How do I list an item for sale?',
    a: 'Tap the "+" icon in the bottom menu or go to the Marketplace tab, then tap "List Item". Enter the details, upload photos, set a price, and publish it to your neighbourhood.',
  },
  {
    q: 'Can I change my home neighbourhood?',
    a: 'Yes. Go to Settings > Location, and select a new State and LGA. Note that updating your location will change the posts and listings visible to you to match your new neighbourhood.',
  },
  {
    q: 'What should I do if I get scammed?',
    a: 'If you suspect a scam, do not release escrow funds. Go to the transaction details page and tap "File Dispute". Our admin team will investigate and mediate the dispute.',
  },
];

function FAQRow({ faq }: { faq: FAQItem }) {
  const { theme } = useUnistyles(); const s = sStylesheet;

  const [expanded, setExpanded] = useState(false);

  return (
    <View style={s.faqItem}>
      <TouchableOpacity style={s.faqHeader} onPress={() => setExpanded(!expanded)}>
        <Text style={s.faqQuestion}>{faq.q}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.LABEL}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={s.faqBody}>
          <Text style={s.faqAnswer}>{faq.a}</Text>
        </View>
      )}
    </View>
  );
}

export default function HelpScreen() {
  const { theme } = useUnistyles(); const s = sStylesheet;

  const router = useRouter();

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@yrdly.ng?subject=YRDLY Mobile Support Request');
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Help Center</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Frequently Asked Questions</Text>

        <View style={s.faqCard}>
          {FAQS.map((faq, idx) => {
            return (
              <React.Fragment key={faq.q}>
                {idx > 0 && <View style={s.divider} />}
                <FAQRow faq={faq} />
              </React.Fragment>
            );
          })}
        </View>

        <View style={s.supportCard}>
          <Feather name="mail" size={22} color={theme.colors.G} style={{ marginBottom: 8 }} />
          <Text style={s.supportTitle}>Still need help?</Text>
          <Text style={s.supportDesc}>
            Our support team is available to assist you with any questions or account issues.
          </Text>
          <TouchableOpacity style={s.supportBtn} onPress={handleContactSupport}>
            <Text style={s.supportBtnText}>Email Support</Text>
          </TouchableOpacity>
        </View>
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
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 18,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 16,
  },
  faqCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    overflow: 'hidden',
    marginBottom: 24,
  },
  faqItem: { width: '100%' },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    marginRight: 16,
  },
  faqBody: { paddingHorizontal: 16, paddingBottom: 16 },
  faqAnswer: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.LABEL, lineHeight: 20 },
  divider: { height: 1, backgroundColor: theme.colors.GLASS_BORDER },

  supportCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    padding: 20,
    alignItems: 'center',
  },
  supportTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 4,
  },
  supportDesc: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: theme.colors.MUTED,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  supportBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: theme.colors.G,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.colors.TEXT_PRIMARY },
}));
