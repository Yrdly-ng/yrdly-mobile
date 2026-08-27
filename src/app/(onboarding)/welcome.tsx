import { Logo, PrimaryBtn, SceneBg, SecondaryBtn } from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { colors } = ONBOARDING_THEME;

export default function WelcomeScreen() {
  const router = useRouter();
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <SceneBg photoId="1594538756542-8c88bda491c5" pos="center 40%" gradientStart="30%" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Animated.View
            style={[styles.floatContainer, { transform: [{ translateY: floatAnim }] }]}
          >
            <Logo size={88} />
            <Text style={styles.logoText}>YRDLY</Text>
            <Text style={styles.tagline}>Your Neighbourhood, Connected.</Text>
          </Animated.View>
        </View>

        <View style={styles.bottomActions}>
          <PrimaryBtn
            label="Get Started"
            onClick={() => router.push('/(onboarding)/tour')}
            icon={<Ionicons name="arrow-forward" size={18} color="#000" />}
          />
          <SecondaryBtn
            label="Already have an account? Sign in"
            onClick={() => router.push('/(auth)/login')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.DARK,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatContainer: {
    alignItems: 'center',
    gap: 16,
  },
  logoText: {
    fontFamily: 'Outfit-ExtraBold',
    fontSize: 48,
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
});
