import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../hooks/use-supabase-auth';
import { acceptTerms, hasAcceptedTerms, isAccountHelpRoute } from '../../lib/legal/terms';
import { LegalLinks } from './LegalLinks';

// Keep navigation mounted for auth callbacks and deep links. The non-dismissible
// modal blocks content interaction, including direct links to composer screens.
export function TermsAcceptanceGate() {
  const { user, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  if (!user || hasAcceptedTerms(user) || isAccountHelpRoute(segments)) return null;
  return (
    <AcceptancePrompt
      key={user.id}
      userId={user.id}
      onSignOut={signOut}
      onHelp={(route) => router.push(route as any)}
    />
  );
}

function AcceptancePrompt({
  userId,
  onSignOut,
  onHelp,
}: {
  userId: string;
  onSignOut: () => Promise<{ error: any }>;
  onHelp: (route: string) => void;
}) {
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!checked || !adultConfirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await acceptTerms(userId, adultConfirmed);
    } catch {
      setError('We couldn’t save your acceptance. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>YRDLY COMMUNITY</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Before you continue
            </Text>
            <Text style={styles.body}>
              Yrdly accounts are for people aged 18 and older. Please review our Terms of Service and Privacy Policy before posting, messaging or
              sharing on Yrdly.
            </Text>
            <Text style={styles.body}>
              Keep our neighbourhoods safe. Harassment, threats, hate speech, scams, sexual
              exploitation of children, grooming, and illegal or abusive content are not allowed. Report harmful content
              using the in-app reporting tools.
            </Text>
            <LegalLinks includeSafety />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="I am 18 years old or older"
              accessibilityState={{ checked: adultConfirmed, disabled: busy }}
              disabled={busy}
              onPress={() => setAdultConfirmed(!adultConfirmed)}
              style={styles.choice}
            >
              <Text style={styles.check}>{adultConfirmed ? '☑' : '☐'}</Text>
              <Text style={styles.choiceText}>I am 18 years old or older.</Text>
            </Pressable>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="I agree to the terms and community rules"
              accessibilityState={{ checked, disabled: busy }}
              disabled={busy}
              onPress={() => setChecked(!checked)}
              style={styles.choice}
            >
              <Text style={styles.check}>{checked ? '☑' : '☐'}</Text>
              <Text style={styles.choiceText}>
                I agree to the Terms of Service and community rules above, and acknowledge the
                Privacy Policy.
              </Text>
            </Pressable>
            <Text style={styles.note}>
              This acknowledgement does not grant device permissions or consent to advertising
              tracking.
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !checked || !adultConfirmed || busy }}
              disabled={!checked || !adultConfirmed || busy}
              onPress={save}
              style={[styles.button, (!checked || !adultConfirmed || busy) && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Agree and continue</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  const result = await onSignOut();
                  if (result.error) throw result.error;
                } catch {
                  setError('Unable to sign out. Please try again.');
                } finally {
                  setBusy(false);
                }
              }}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Sign out</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onHelp('/settings/delete-account')}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Request account deletion</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onHelp('/settings/help')}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Contact support</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7f4' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },
  eyebrow: { fontFamily: 'Inter-SemiBold', fontSize: 12, letterSpacing: 2, color: '#197346' },
  title: { fontFamily: 'Outfit-Bold', fontSize: 30, color: '#15251b' },
  body: { fontFamily: 'Inter-Regular', fontSize: 16, lineHeight: 24, color: '#34463a' },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  check: { fontSize: 26, color: '#197346' },
  choiceText: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    lineHeight: 23,
    color: '#15251b',
  },
  note: { fontSize: 12, lineHeight: 18, color: '#4b5b50' },
  error: { color: '#ad2626', fontSize: 14 },
  button: {
    backgroundColor: '#197346',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontFamily: 'Inter-SemiBold', fontSize: 16 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#197346', fontFamily: 'Inter-Medium', fontSize: 14 },
});
