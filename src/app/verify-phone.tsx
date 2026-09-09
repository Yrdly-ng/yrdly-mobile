import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useAuth } from '../hooks/use-supabase-auth';
import { ErrorMessage } from '../components/ErrorMessage';
const { width, height } = Dimensions.get('window');

export default function VerifyPhoneScreen() {
  const { styles: stylesheet, theme } = useStyles(_stylesheet);
  const router = useRouter();
  const { sendPhoneOtp } = useAuth();

  const [phone, setPhone] = useState('+234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    // Basic length check for +234 followed by 10 digits
    if (phone.length < 13 || !phone.startsWith('+234')) {
      setError('Please enter a valid Nigerian phone number (e.g. +23470...).');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const pinId = await sendPhoneOtp(phone);
      router.push({ pathname: '/verify-phone-otp', params: { phone, initialPinId: pinId } });
    } catch (e: any) {
      setError(e.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[stylesheet.container, { backgroundColor: theme.colors.DARK }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        style={{
          width: '100%',
          borderRadius: 28,
          padding: 24,
          alignItems: 'center',
          backgroundColor: theme.colors.SURFACE,
          borderWidth: 1,
          borderColor: theme.colors.GLASS_BORDER,
        }}
      >
        <TouchableOpacity
          style={{ alignSelf: 'flex-start', marginBottom: 16, padding: 4 }}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>

        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: theme.colors.G + '15',
            borderWidth: 1,
            borderColor: theme.colors.G + '25',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Feather name="smartphone" size={30} color={theme.colors.G} />
        </View>

        <Text style={[stylesheet.title, { color: theme.colors.TEXT_PRIMARY }]}>
          Verify Phone Number
        </Text>
        <Text style={[stylesheet.subtitle, { color: theme.colors.MUTED }]}>
          Enter your Nigerian phone number to receive a verification code.
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            height: 52,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.colors.GLASS_BORDER,
            backgroundColor: theme.colors.SURFACE,
            paddingHorizontal: 16,
            marginBottom: 16,
          }}
        >
          <Feather name="phone" size={18} color={theme.colors.LABEL} style={{ marginRight: 12 }} />
          <TextInput
            style={[stylesheet.input, { color: theme.colors.TEXT_PRIMARY }]}
            placeholder="+234 800 000 0000"
            placeholderTextColor={theme.colors.LABEL}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <ErrorMessage error={error} />

        <TouchableOpacity
          style={[
            {
              width: '100%',
              height: 50,
              borderRadius: 25,
              backgroundColor: theme.colors.G,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 8,
            },
            loading && { opacity: 0.6 },
          ]}
          onPress={handleSend}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.TEXT_PRIMARY} />
          ) : (
            <Text style={[stylesheet.verifyBtnText, { color: '#000' }]}>Send Code</Text>
          )}
        </TouchableOpacity>
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
  title: { fontSize: 24, fontFamily: 'Outfit-ExtraBold', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter-SemiBold' },
  verifyBtn: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { fontSize: 15, fontFamily: 'Outfit-ExtraBold' },
}));
