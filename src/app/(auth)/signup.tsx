import { createStyleSheet, useStyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Logo,
  SceneBg,
  GlassCard,
  GlassInput,
  PasswordStrength,
  PrimaryBtn,
  Divider,
  SocialRow,
} from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { AuthService } from '@/lib/auth-service';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-supabase-auth';
import { Ionicons } from '@expo/vector-icons';

const { colors } = ONBOARDING_THEME;

export default function SignUpScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const { signUp, signInWithGoogle, signInWithApple, loading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const isPasswordStrong = (pw: string) => {
    return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  };

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

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      setError('Please fill in all required fields');
      return;
    }

    if (!isPasswordStrong(password)) {
      setError('Please create a strong password meeting all 4 requirements below');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setError('');

    const { error: err, session } = await signUp(cleanEmail, password, name);
    if (err) {
      if (
        err.message.toLowerCase().includes('already registered') ||
        err.message.toLowerCase().includes('already in use')
      ) {
        try {
          await supabase.auth.resend({ type: 'signup', email: cleanEmail });
        } catch {}
        router.push('/(auth)/verify-email', { params: { email: cleanEmail } });
        return;
      }
      setError(err.message);
    } else if (!session) {
      router.push('/(auth)/verify-email', { params: { email: cleanEmail } });
    } else {
      router.push('/(auth)/phone' as any);
    }
  };

  return (
    <View style={styles.container}>
      <SceneBg photoId="1571346746462-d4e51c41072f" gradientStart="40%" />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.header}>
            <Logo size={36} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.flexSpacer} />

            <GlassCard>
              <View style={styles.titleBox}>
                <Text style={styles.titleText}>Join your neighbourhood</Text>
                <Text style={styles.subtitleText}>
                  Create your account — it only takes a moment
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.inputStack}>
                <GlassInput
                  placeholder="Full name"
                  value={name}
                  onChange={setName}
                  icon={<Ionicons name="person-outline" size={18} color={colors.LABEL} />}
                />
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
                  placeholder="Create a password"
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

                {password.length > 0 && <PasswordStrength value={password} />}
              </View>

              <PrimaryBtn label="Create Account" onClick={handleSignUp} disabled={loading} />

              <Divider label="or continue with" />

              <SocialRow onGooglePress={handleGoogle} onApplePress={handleApple} />

              <View style={styles.crossLinkRow}>
                <Text style={styles.crossLinkText}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={() => {
                    router.push('/(auth)/login');
                  }}
                >
                  <Text style={styles.crossLinkAction}>Sign in</Text>
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
