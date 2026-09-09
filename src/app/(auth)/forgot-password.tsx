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
  SceneBg,
  GlassCard,
  GlassInput,
  PrimaryBtn,
  BackBtn,
} from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { useAuth } from '@/hooks/use-supabase-auth';
import { Ionicons } from '@expo/vector-icons';

const { colors, radii } = ONBOARDING_THEME;

export default function ForgotPasswordScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const { resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSendReset = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: err } = await resetPassword(email.trim());
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Failed to send reset link');
    } else {
      setSent(true);
    }
  };

  return (
    <View style={styles.container}>
      <SceneBg photoId="1707011017057-e80acf66ddeb" pos="center 60%" gradientStart="30%" />

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
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flex: 1 }} />

            <GlassCard>
              <View style={styles.centerBox}>
                <View style={styles.keyBadge}>
                  <Ionicons name="key-outline" size={28} color={colors.G} />
                </View>
                <Text style={styles.titleText}>Forgot your password?</Text>
                <Text style={styles.descText}>
                  No worries! Enter your account email and we'll send you a reset link.
                </Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {!sent ? (
                <>
                  <GlassInput
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={setEmail}
                    keyboardType="email-address"
                    icon={<Ionicons name="mail-outline" size={18} color={colors.LABEL} />}
                  />
                  <PrimaryBtn
                    label={submitting ? 'Sending...' : 'Send Reset Link'}
                    onClick={handleSendReset}
                    disabled={submitting || !email}
                  />
                </>
              ) : (
                <View style={styles.sentBox}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={24} color={colors.G} />
                  </View>
                  <Text style={styles.sentText}>
                    Reset link sent to{' '}
                    <Text
                      style={{ color: theme.colors.TEXT_PRIMARY, fontFamily: 'Inter-SemiBold' }}
                    >
                      {email || 'your email'}
                    </Text>
                    . Check your inbox.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => router.push('/(auth)/login')}
                style={styles.backLink}
              >
                <Text style={styles.backLinkText}>← Back to Sign In</Text>
              </TouchableOpacity>
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
  errorText: {
    color: colors.DANGER,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  keyBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.G,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
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
  sentBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(130,219,126,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentText: {
    fontSize: 14,
    color: colors.MUTED,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backLinkText: {
    fontSize: 14,
    color: colors.LABEL,
    fontFamily: 'Inter-Regular',
  },
}));
