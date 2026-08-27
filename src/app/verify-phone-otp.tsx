import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useAuth } from '../hooks/use-supabase-auth';
import { ErrorMessage } from '../components/ErrorMessage';

const { width, height } = Dimensions.get('window');

const OTP_LENGTH = 6;

export default function VerifyPhoneOtpScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);
  const router = useRouter();
  const { phone, initialPinId } = useLocalSearchParams<{ phone: string; initialPinId: string }>();
  const { verifyPhoneOtp, sendPhoneOtp } = useAuth();

  const [pinId, setPinId] = useState(initialPinId || '');
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (digits.every((d) => d !== '')) {
      handleVerify(digits.join(''));
    }
  }, [digits]);

  const handleDigitChange = (value: string, index: number) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const newDigits = [...digits];
      for (let i = 0; i < OTP_LENGTH; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setDigits(newDigits);
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otp = code ?? digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    if (!pinId) {
      setError('Invalid session. Please go back and send code again.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await verifyPhoneOtp(pinId, otp);
      Alert.alert('Verified!', 'Your phone number has been verified.');
      router.back();
      // Wait a moment then go back again if we need to pop two screens
      setTimeout(() => router.back(), 500);
    } catch (e: any) {
      setError(e.message || 'Invalid or expired code. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !phone) return;
    setResending(true);
    setError('');
    try {
      const newPinId = await sendPhoneOtp(phone);
      setPinId(newPinId);
      setResendCooldown(60);
      Alert.alert('Code resent', `A new SMS has been sent to ${phone}`);
    } catch (e: any) {
      setError(e.message || 'Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={StyleSheet.absoluteFillObject}>
        <View
          style={[
            stylesheet.blob,
            { top: height * 0.05, left: width * 0.1, backgroundColor: theme.colors.G },
          ]}
        />
        <View
          style={[
            stylesheet.blob,
            { top: height * 0.75, left: width * 0.75, backgroundColor: theme.colors.G },
          ]}
        />
      </View>

      {isLiquidGlassSupported ? (
        <LiquidGlassView
          {...({ intensity: 20, tint: 'dark', fallbackColor: 'rgba(0, 0, 0, 0.6)' } as any)}
          style={StyleSheet.absoluteFillObject}
        />
      ) : Platform.OS === 'ios' ? (
        <BlurView intensity={20} style={StyleSheet.absoluteFillObject} tint="dark" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
      )}

      <View
        style={[
          stylesheet.card,
          { backgroundColor: theme.colors.SURFACE, shadowColor: theme.colors.TEXT_PRIMARY },
        ]}
      >
        <TouchableOpacity style={stylesheet.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>

        <View style={[stylesheet.iconRing, { backgroundColor: theme.colors.SURFACE }]}>
          <Feather name="message-square" size={36} color={theme.colors.G} />
        </View>

        <Text style={[stylesheet.title, { color: theme.colors.TEXT_PRIMARY }]}>
          Check your phone
        </Text>
        <Text style={[stylesheet.subtitle, { color: theme.colors.LABEL }]}>
          We sent a 6-digit SMS code to{'\n'}
          <Text style={[stylesheet.phoneText, { color: theme.colors.TEXT_PRIMARY }]}>{phone}</Text>
        </Text>

        <View style={stylesheet.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                inputRefs.current[i] = r;
              }}
              style={[
                stylesheet.otpBox,
                {
                  backgroundColor: theme.colors.SURFACE,
                  borderColor: theme.colors.GLASS_BORDER,
                  color: theme.colors.TEXT_PRIMARY,
                },
                d && [
                  stylesheet.otpBoxFilled,
                  { borderColor: theme.colors.G, backgroundColor: theme.colors.SURFACE },
                ],
              ]}
              value={d}
              onChangeText={(v) => handleDigitChange(v, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
            />
          ))}
        </View>

        <ErrorMessage error={error} />

        <TouchableOpacity
          style={[
            stylesheet.verifyBtn,
            { backgroundColor: theme.colors.G, shadowColor: theme.colors.G },
            loading && stylesheet.verifyBtnDisabled,
          ]}
          onPress={() => handleVerify()}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[stylesheet.verifyBtnText, { color: '#000' }]}>Verify</Text>
          )}
        </TouchableOpacity>

        <View style={stylesheet.resendRow}>
          <Text style={[stylesheet.resendLabel, { color: theme.colors.MUTED }]}>
            Didn't get the SMS?{' '}
          </Text>
          <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0 || resending}>
            {resending ? (
              <ActivityIndicator size="small" color={theme.colors.G} />
            ) : (
              <Text
                style={[
                  stylesheet.resendLink,
                  { color: theme.colors.G },
                  resendCooldown > 0 && [
                    stylesheet.resendLinkDisabled,
                    { color: theme.colors.MUTED },
                  ],
                ]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const _stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  blob: { position: 'absolute', width: 80, height: 80, borderRadius: 40, opacity: 0.45 },
  card: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  back: { alignSelf: 'flex-start', marginBottom: 20, padding: 4 },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 26, fontFamily: 'Outfit-ExtraBold', textAlign: 'center', marginBottom: 10 },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 32,
  },
  phoneText: { fontFamily: 'Inter-Bold' },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
  },
  otpBoxFilled: {},
  verifyBtn: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { fontSize: 16, fontFamily: 'Outfit-Bold' },
  resendRow: { flexDirection: 'row', alignItems: 'center' },
  resendLabel: { fontSize: 13, fontFamily: 'Inter-Regular' },
  resendLink: { fontSize: 13, fontFamily: 'Outfit-Bold' },
  resendLinkDisabled: {},
}));
