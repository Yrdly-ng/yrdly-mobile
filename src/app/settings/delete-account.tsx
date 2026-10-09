import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/use-supabase-auth';

export default function DeleteAccountScreen() {
  const { theme } = useUnistyles(); const s = sStylesheet;

  const router = useRouter();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDeleteRequest = async () => {
    if (!user) return;

    Alert.alert(
      'Are you absolutely sure?',
      'This cannot be undone. Your profile, posts and comments will be permanently deleted and you will be signed out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Sign in with Apple accounts must have their Apple token revoked on deletion;
              // a fresh authorization code lets the server do that.
              let appleAuthorizationCode: string | undefined;
              const { data: sessionData } = await supabase.auth.getSession();
              const providers: string[] = sessionData.session?.user.app_metadata?.providers ?? [];
              if (Platform.OS === 'ios' && providers.includes('apple')) {
                try {
                  const credential = await AppleAuthentication.signInAsync();
                  appleAuthorizationCode = credential.authorizationCode ?? undefined;
                } catch (e: any) {
                  if (e?.code === 'ERR_REQUEST_CANCELED') {
                    setLoading(false);
                    return;
                  }
                }
              }

              const { error } = await supabase.functions.invoke('delete-account', {
                body: { appleAuthorizationCode },
              });

              if (error) {
                let message = error.message;
                if (error instanceof FunctionsHttpError) {
                  const body = await error.context.json().catch(() => null);
                  if (body?.error) message = body.error;
                }
                throw new Error(message);
              }

              Alert.alert(
                'Account Deleted',
                'Your account has been deleted. You will be signed out now.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      signOut();
                    },
                  },
                ]
              );
            } catch (err: any) {
              Alert.alert('Could not delete account', err.message || 'Please try again.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Delete Account</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.warningCard}>
          <View style={s.iconCircle}>
            <Feather name="alert-triangle" size={32} color="#ef4444" />
          </View>
          <Text style={s.warningTitle}>Warning</Text>
          <Text style={s.warningText}>
            Deleting your account permanently removes your profile, posts and comments, and you
            will no longer be able to sign in.
          </Text>
          <Text style={s.warningText}>
            This action is irreversible. Records of completed payments are kept only where the law
            requires it. Orders with money still in escrow must be completed first.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.deleteBtn, loading && { opacity: 0.7 }]}
          onPress={handleDeleteRequest}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.TEXT_PRIMARY} />
          ) : (
            <Text style={s.deleteBtnText}>Delete My Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const sStylesheet = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.DARK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.GLASS_BORDER,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.SURFACE,
    borderWidth: 1,
    borderColor: theme.colors.GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Outfit-Bold', fontSize: 18, color: theme.colors.TEXT_PRIMARY },
  content: { padding: 20, flexGrow: 1, justifyContent: 'center', paddingBottom: 60 },

  warningCard: {
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  warningTitle: { fontFamily: 'Outfit-Bold', fontSize: 22, color: '#ef4444', marginBottom: 12 },
  warningText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: theme.colors.TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },

  deleteBtn: {
    backgroundColor: '#ef4444',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: theme.colors.TEXT_PRIMARY },
}));
