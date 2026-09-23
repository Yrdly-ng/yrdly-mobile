import { StyleSheet as UnistylesStyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SceneBg, GlassCard, PrimaryBtn, BackBtn } from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';

const { colors } = ONBOARDING_THEME;

export default function VerifyOtpScreen() {
  const { theme } = useUnistyles(); const styles = stylesheet;
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(45);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDigit = (i: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyPress = (i: number, key: string) => {
    if (key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handleVerify = () => {
    router.push('/(onboarding)/profile1' as any);
  };

  const filled = digits.every((d) => d !== '');

  useEffect(() => {
    if (filled) {
      handleVerify();
    }
  }, [digits]);

  return (
    <View style={styles.container}>
      <SceneBg photoId="1654762550505-7c58277e0fac" pos="center 30%" gradientStart="40%" />

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
                <Text style={styles.titleText}>Enter SMS code</Text>
                <Text style={styles.subtitleText}>
                  We sent a 6-digit code via SMS to{' '}
                  <Text style={{ color: colors.MUTED, fontFamily: 'Inter-Medium' }}>
                    {phone ? `+234 ${phone}` : 'your phone number'}
                  </Text>
                </Text>
              </View>

              {/* OTP Digit Boxes */}
              <View style={styles.otpRow}>
                {digits.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    value={d}
                    onChangeText={(v) => handleDigit(i, v)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: d ? 'rgba(130,219,126,0.1)' : colors.SURFACE,
                        borderColor: d ? 'rgba(130,219,126,0.5)' : colors.GLASS_BORDER,
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Countdown */}
              <View style={styles.resendBox}>
                <TouchableOpacity onPress={countdown === 0 ? () => setCountdown(45) : undefined}>
                  <Text
                    style={[
                      styles.timerText,
                      {
                        color: countdown > 0 ? colors.LABEL : colors.G,
                        fontFamily: 'Inter-SemiBold',
                      },
                    ]}
                  >
                    {countdown > 0
                      ? `Resend SMS in 0:${String(countdown).padStart(2, '0')}`
                      : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </View>

              <PrimaryBtn label="Verify & Continue" onClick={handleVerify} disabled={!filled} />
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const stylesheet = UnistylesStyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: colors.DARK,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
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
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  otpBox: {
    flex: 1,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: 'center',
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 22,
    fontFamily: 'Inter-Bold',
  },
  resendBox: {
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontSize: 13,
  },
  altText: {
    fontSize: 13,
    color: colors.LABEL,
    lineHeight: 20,
    textAlign: 'center',
  },
}));
