import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SceneBg, GlassCard, PrimaryBtn, BackBtn } from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const { colors } = ONBOARDING_THEME;

export default function VerifyEmailScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(45);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
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

  const filled = digits.every((d) => d !== '');

  const handleVerifyOtp = async () => {
    const token = digits.join('');
    if (token.length < 6) return;

    setError('');
    setVerifying(true);

    try {
      const emailStr = typeof email === 'string' && email ? email.trim().toLowerCase() : '';
      const { error: err } = await supabase.auth.verifyOtp({
        email: emailStr,
        token,
        type: 'signup',
      });

      setVerifying(false);

      if (err) {
        setError(err.message || 'Invalid verification code');
      } else {
        router.push('/(auth)/phone' as any);
      }
    } catch (e: any) {
      setVerifying(false);
      setError(e.message || 'Verification failed');
    }
  };

  useEffect(() => {
    if (filled && !verifying) {
      handleVerifyOtp();
    }
  }, [digits]);

  const handleResend = async () => {
    if (!email || typeof email !== 'string') return;
    setCountdown(45);
    await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
  };

  return (
    <View style={styles.container}>
      <SceneBg photoId="1768244016593-8ca75b15bc92" pos="center 25%" gradientStart="42%" />

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
              <View style={styles.centerBox}>
                <View style={styles.envelopeBadge}>
                  <Ionicons name="mail-outline" size={28} color={colors.G} />
                </View>
                <Text style={styles.titleText}>Verify your email</Text>
                <Text style={styles.descText}>
                  We sent a 6-digit code to{' '}
                  <Text style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }}>
                    {typeof email === 'string' ? email : 'your email'}
                  </Text>
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* 6-Digit Email OTP Box */}
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

              <PrimaryBtn
                label={verifying ? 'Verifying...' : 'Verify & Continue'}
                onClick={handleVerifyOtp}
                disabled={!filled || verifying}
              />

              <View style={styles.actionsBox}>
                <TouchableOpacity onPress={countdown === 0 ? handleResend : undefined}>
                  <Text
                    style={[
                      styles.resendText,
                      {
                        color: countdown > 0 ? colors.LABEL : colors.G,
                        opacity: countdown > 0 ? 0.6 : 1,
                      },
                    ]}
                  >
                    {countdown > 0
                      ? `Resend email code in ${countdown}s`
                      : 'Resend verification code'}
                  </Text>
                </TouchableOpacity>
              </View>
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
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  centerBox: {
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
  },
  envelopeBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 24,
    fontFamily: 'Outfit-ExtraBold',
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
  },
  descText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.LABEL,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 270,
  },
  errorText: {
    color: colors.DANGER,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    width: 46,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    textAlign: 'center',
    color: theme.colors.TEXT_PRIMARY,
    fontSize: 22,
    fontFamily: 'Inter-Bold',
  },
  actionsBox: {
    alignItems: 'center',
    gap: 12,
  },
  resendText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
}));
