import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function GenericSettingsScreen() {
  const { styles: s, theme } = useStyles(sStylesheet);

  const router = useRouter();
  const { title } = useLocalSearchParams();
  const headerTitle = title || 'Settings';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{headerTitle}</Text>
        <View style={{ width: 34 }} />
      </View>
      <View style={s.content}>
        <Ionicons
          name="construct-outline"
          size={48}
          color={theme.colors.LABEL}
          style={{ marginBottom: 16 }}
        />
        <Text style={s.title}>{headerTitle}</Text>
        <Text style={s.subtitle}>
          This section is currently under construction. Check back soon for updates!
        </Text>
      </View>
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
  content: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: 20,
    color: theme.colors.TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.LABEL,
    textAlign: 'center',
    lineHeight: 22,
  },
}));
