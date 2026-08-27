import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function GuidelinesScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);

  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Guidelines</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.tagline}>
          YRDLY is built on trust, respect, and community spirit. Here's what we expect from every
          neighbour.
        </Text>

        {/* Card 1 */}
        <View style={s.sectionCard}>
          <View style={s.cardHeader}>
            <Feather name="shield" size={20} color={theme.colors.G} />
            <Text style={s.cardTitle}>Be Respectful</Text>
          </View>
          <Text style={s.cardBody}>
            Treat everyone with kindness. Harassment, hate speech, bullying, or discrimination of
            any kind will not be tolerated and will result in immediate banning.
          </Text>
        </View>

        {/* Card 2 */}
        <View style={s.sectionCard}>
          <View style={s.cardHeader}>
            <Feather name="shopping-bag" size={20} color={theme.colors.G} />
            <Text style={s.cardTitle}>Honest Commerce</Text>
          </View>
          <Text style={s.cardBody}>
            Accurately describe items you're selling. Do not list prohibited items (weapons, illegal
            substances, counterfeits). Always complete transactions safely and honour your
            agreements.
          </Text>
        </View>

        {/* Card 3 */}
        <View style={s.sectionCard}>
          <View style={s.cardHeader}>
            <Feather name="map-pin" size={20} color={theme.colors.G} />
            <Text style={s.cardTitle}>Keep it Local & Relevant</Text>
          </View>
          <Text style={s.cardBody}>
            Post announcements, events, and listings that directly affect your local community. Do
            not spam groups with external advertising, links, or off-topic discussions.
          </Text>
        </View>

        {/* Card 4 */}
        <View style={s.sectionCard}>
          <View style={s.cardHeader}>
            <Feather name="flag" size={20} color={theme.colors.G} />
            <Text style={s.cardTitle}>Report Suspicious Activity</Text>
          </View>
          <Text style={s.cardBody}>
            Help us protect the neighbourhood. If you notice listings that look like scams, or users
            acting inappropriately, flag them immediately using the "Report" button.
          </Text>
        </View>

        <Text style={s.footerText}>
          By participating in YRDLY, you agree to uphold these standards. Violating community
          guidelines may lead to account suspension or ban.
        </Text>
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
  content: { padding: 20, paddingBottom: 40 },
  tagline: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.MUTED,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  sectionCard: {
    backgroundColor: theme.colors.SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardTitle: { fontFamily: 'Outfit-Bold', fontSize: 16, color: theme.colors.TEXT_PRIMARY },
  cardBody: { fontFamily: 'Inter', fontSize: 13, color: theme.colors.LABEL, lineHeight: 20 },
  footerText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: theme.colors.MUTED,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
}));
