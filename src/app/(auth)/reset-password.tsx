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
  PasswordStrength,
  PrimaryBtn,
  BackBtn,
} from '@/components/onboarding/primitives';
import { ONBOARDING_THEME } from '@/constants/onboarding-theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-supabase-auth';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

const { colors, radii } = ONBOARDING_THEME;

export default function ResetPasswordScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updatePassword, signOut } = useAuth();

  const handleUpdate = async () => {
    if (pw !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (pw.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(pw);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to update password');
    } else {
      setDone(true);
      // Trigger the explicit security email via Edge Function
      try {
        await supabase.functions.invoke('send-security-email', {
          body: { type: 'password_update' },
        });
      } catch (e) {
        console.warn('Failed to send security email', e);
      }

      // Sign out to force the user to log in with the new password.
      setTimeout(async () => {
        await signOut();
        router.replace('/(auth)/login');
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      <SceneBg photoId="1707011017057-e80acf66ddeb" pos="center 55%" gradientStart="30%" />

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
              <View style={styles.titleBox}>
                <Text style={styles.titleText}>Create new password</Text>
                <Text style={styles.subtitleText}>
                  Your new password must be different from previous passwords.
                </Text>
              </View>

              <View style={styles.inputStack}>
                <GlassInput
                  type={show1 ? 'text' : 'password'}
                  placeholder="New password"
                  value={pw}
                  onChange={setPw}
                  icon={<Ionicons name="lock-closed-outline" size={18} color={colors.LABEL} />}
                  right={
                    <TouchableOpacity onPress={() => setShow1(!show1)}>
                      <Ionicons
                        name={show1 ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.LABEL}
                      />
                    </TouchableOpacity>
                  }
                />

                {pw.length > 0 && <PasswordStrength value={pw} />}

                <GlassInput
                  type={show2 ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={setConfirm}
                  icon={<Ionicons name="lock-closed-outline" size={18} color={colors.LABEL} />}
                  right={
                    <TouchableOpacity onPress={() => setShow2(!show2)}>
                      <Ionicons
                        name={show2 ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.LABEL}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>

              <PrimaryBtn
                label={loading ? 'Updating...' : 'Reset Password'}
                onClick={handleUpdate}
              />

              {done && (
                <View style={styles.successToast}>
                  <View style={styles.toastCheck}>
                    <Ionicons name="checkmark" size={14} color={colors.DARK} />
                  </View>
                  <Text style={styles.toastText}>Password updated successfully!</Text>
                </View>
              )}
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
    lineHeight: 22,
  },
  inputStack: {
    gap: 12,
  },
  successToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(130,219,126,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(130,219,126,0.2)',
  },
  toastCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.G,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    fontSize: 13,
    color: colors.G,
    fontFamily: 'Inter-Medium',
  },
}));
