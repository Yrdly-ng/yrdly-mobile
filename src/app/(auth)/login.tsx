import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Logo,
  SceneBg,
  GlassCard,
  GlassInput,
  PrimaryBtn,
  Divider,
  SocialRow,
} from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';
import { Ionicons } from '@expo/vector-icons';

const { colors } = ONBOARDING_THEME;

export default function LoginScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithApple, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) setError(err.message);
  };

  const handleApple = async () => {
    setError('');
    const { error: err } = await signInWithApple();
    if (err) setError(err.message);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setError('');
    const { error: err } = await signIn(cleanEmail, password);
    if (err) {
      if (err.message.toLowerCase().includes('email not confirmed') || err.message.toLowerCase().includes('unconfirmed')) {
        try {
          await supabase.auth.resend({ type: 'signup', email: cleanEmail });
        } catch {}
        router.push('/(auth)/verify-email', { params: { email: cleanEmail } });
        return;
      }
      setError(err.message);
    } else {
      router.push('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <SceneBg
        photoId="1707011017057-e80acf66ddeb"
        gradientStart="40%"
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
            <Logo size={36} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.flexSpacer} />

            <GlassCard>
              <View style={styles.titleBox}>
                <Text style={styles.titleText}>Welcome back</Text>
                <Text style={styles.subtitleText}>Sign in to your neighbourhood</Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.inputStack}>
                <GlassInput
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={setEmail}
                  keyboardType="email-address"
                  icon={<Ionicons name="mail-outline" size={18} color={colors.LABEL} />}
                />

                <GlassInput
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={setPassword}
                  icon={<Ionicons name="lock-closed-outline" size={18} color={colors.LABEL} />}
                  right={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.LABEL}
                      />
                    </TouchableOpacity>
                  }
                />

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password')}
                  style={styles.forgotBtn}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <PrimaryBtn
                label="Sign In"
                onClick={handleSignIn}
                disabled={loading}
              />

              <Divider label="or continue with" />

              <SocialRow onGooglePress={handleGoogle} onApplePress={handleApple} />

              <View style={styles.crossLinkRow}>
                <Text style={styles.crossLinkText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => { router.push('/(auth)/signup' as any); }}>
                  <Text style={styles.crossLinkAction}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: colors.DARK,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  flexSpacer: {
    flex: 1,
    minHeight: 40,
  },
  titleBox: {
    gap: 4,
  },
  titleText: {
    fontSize: 26,
    fontFamily: 'Outfit-ExtraBold',
    color: theme.colors.TEXT_PRIMARY,
  },
  subtitleText: {
    fontSize: 14,
    color: colors.LABEL,
    fontFamily: 'Inter-Regular',
  },
  errorText: {
    color: colors.DANGER,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  inputStack: {
    gap: 12,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    color: colors.G,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  crossLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossLinkText: {
    fontSize: 14,
    color: colors.LABEL,
    fontFamily: 'Inter-Regular',
  },
  crossLinkAction: {
    color: colors.G,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
}));
