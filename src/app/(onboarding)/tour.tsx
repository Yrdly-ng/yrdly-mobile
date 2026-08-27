import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SceneBg, ProgressPills, PrimaryBtn } from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { Ionicons } from '@expo/vector-icons';

const { colors } = ONBOARDING_THEME;

const SLIDES = [
  {
    headline: 'Welcome to Your\nNeighbourhood',
    description:
      'Stay connected with the people, places, and conversations that make your neighbourhood feel like home.',
    imageId: '1752622176337-5d9315e2df6e',
    cta: 'Continue',
  },
  {
    headline: 'Everything You Need,\nClose to Home',
    description:
      'Discover trusted neighbours, support local businesses, and find great deals just around the corner.',
    imageId: '1579998120708-682dd8a5624f',
    cta: 'Continue',
  },
  {
    headline: "Something's Always\nHappening Nearby",
    description:
      "From community gatherings to weekend markets, there's always something worth showing up for.",
    imageId: '1673280401347-309363111070',
    cta: 'Continue',
  },
  {
    headline: 'Meet the People\nAround You',
    description:
      'Build meaningful relationships with the people who live, work and create around you.',
    imageId: '1758525225816-8dd1901ef6ec',
    cta: 'Welcome Home',
  },
];

export default function TourScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const currentSlide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const advance = () => {
    if (!isLast) {
      setIdx((prev) => prev + 1);
    } else {
      router.push('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <SceneBg photoId={currentSlide.imageId} gradientStart="40%" />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <ProgressPills total={SLIDES.length} current={idx} />
          {!isLast && (
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.spacer} />

        {/* Content */}
        <View style={styles.contentBox}>
          <Text style={styles.headline}>{currentSlide.headline}</Text>
          <Text style={styles.description}>{currentSlide.description}</Text>
          <View style={{ marginTop: 8 }}>
            <PrimaryBtn
              label={currentSlide.cta}
              onClick={advance}
              icon={<Ionicons name={isLast ? 'home' : 'arrow-forward'} size={18} color="#000" />}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: colors.DARK,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  skipText: {
    color: colors.LABEL,
    fontSize: 14,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  contentBox: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  headline: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.TEXT_PRIMARY,
    lineHeight: 38,
  },
  description: {
    fontSize: 15,
    color: colors.MUTED,
    lineHeight: 24,
  },
}));
