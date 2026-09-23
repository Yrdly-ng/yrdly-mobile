import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SceneBg,
  GlassCard,
  GlassInput,
  PrimaryBtn,
  BackBtn,
} from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { Ionicons } from '@expo/vector-icons';

const { colors, radii } = ONBOARDING_THEME;

export default function PhoneScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const [phone, setPhone] = useState('');

  return (
    <View style={styles.container}>
      <SceneBg photoId="1654762550505-7c58277e0fac" pos="center 35%" gradientStart="40%" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.topBar}>
            <BackBtn onClick={() => router.back()} light />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flex: 1, minHeight: 40 }} />

            <GlassCard>
              <View style={styles.titleBox}>
                <Text style={styles.titleText}>Verify your phone number</Text>
                <Text style={styles.subtitleText}>
                  YRDLY is a verified community. We use your number to keep buyers and sellers safe
                  in your neighbourhood.
                </Text>
              </View>

              {/* Phone Field Row */}
              <View style={styles.phoneRow}>
                <View style={styles.countryPill}>
                  <Text style={{ fontSize: 18 }}>🇳🇬</Text>
                  <Text style={styles.countryCode}>+234</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.LABEL} />
                </View>

                <View style={{ flex: 1 }}>
                  <GlassInput
                    placeholder="801 234 5678"
                    value={phone}
                    onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* Trust Badge */}
              <View style={styles.trustBadge}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={colors.G}
                  style={{ marginTop: 2 }}
                />
                <Text style={styles.trustText}>
                  Your number is never shared publicly with other users.
                </Text>
              </View>

              <PrimaryBtn
                label="Send Verification Code"
                onClick={() => router.push({ pathname: '/(auth)/verify-otp', params: { phone } })}
                disabled={phone.length < 10}
              />
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
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
    fontFamily: 'Inter-Medium',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  titleBox: {
    gap: 4,
  },
  titleText: {
    fontSize: 24,
    fontFamily: 'Outfit-ExtraBold',
    color: theme.colors.TEXT_PRIMARY,
  },
  subtitleText: {
    fontSize: 14,
    color: colors.LABEL,
    lineHeight: 24,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 56,
    borderRadius: radii.input,
    backgroundColor: colors.SURFACE,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
  },
  countryCode: {
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.SURFACE,
    borderWidth: 1,
    borderColor: colors.GLASS_BORDER,
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    color: colors.LABEL,
    lineHeight: 18,
  },
}));
