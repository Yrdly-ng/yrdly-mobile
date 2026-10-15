'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { AuthService, AuthUser } from '@/lib/auth/auth-service';
import { supabase } from '@/lib/supabase/supabase';
import { getOrCreateDeviceId } from '@/lib/offline/device-id';
import NetInfo from '@react-native-community/netinfo';
import { localCache } from '@/lib/offline/local-cache';
import { watchSession } from '@/lib/auth/session-policy';

interface AuthContextType {
  user: User | null;
  profile: AuthUser | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name: string,
    username?: string
  ) => Promise<{ user: User | null; session: Session | null; error: any }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: any }>;
  signInWithGoogle: () => Promise<{ data: any; error: any }>;
  signInWithApple: () => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<string>;
  verifyPhoneOtp: (pinId: string, pin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const profileCreationInProgress = React.useRef(false);
  useEffect(() => watchSession(), []);

  useEffect(() => {
    let mounted = true,
      version = 0;
    let currentUserId: string | null = null;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    const stopProfile = () => {
      if (profileChannel) {
        void supabase.removeChannel(profileChannel);
        profileChannel = null;
      }
    };
    const applySession = async (nextUser: User | null, quiet = false) => {
      const request = ++version;
      const owner = nextUser?.id ?? null;
      if (owner !== currentUserId) {
        stopProfile();
        setProfile(null);
      }
      currentUserId = owner;
      localCache.setAccount(owner);
      if (!mounted) return;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const cached = await localCache.read<AuthUser>(nextUser.id, 'profile', 'self', 7 * 86400000);
      if (!mounted || request !== version) return;
      if (cached) {
        setProfile(cached.value);
        setLoading(false);
      }
      try {
        if ((await NetInfo.fetch()).isConnected !== false) {
          const result = await supabase
            .from('users')
            .select('*')
            .eq('id', nextUser.id)
            .abortSignal(AbortSignal.timeout(10000))
            .maybeSingle();
          if (!mounted || request !== version) return;
          if (result.error) throw result.error;
          let fresh = result.data as AuthUser | null;
          // A timeout or offline cache miss must never be treated as a missing profile.
          if (!fresh && !profileCreationInProgress.current) {
            profileCreationInProgress.current = true;
            try {
              await AuthService.createUserProfile(
                nextUser,
                nextUser.user_metadata?.name || nextUser.user_metadata?.full_name || 'User'
              );
              fresh = await AuthService.getUserProfile(nextUser.id);
            } finally {
              profileCreationInProgress.current = false;
            }
          }
          if (fresh && mounted && request === version) {
            setProfile(fresh);
            void localCache.write(nextUser.id, 'profile', 'self', fresh);
          }
        }
      } catch {
        /* Keep an account-scoped encrypted snapshot during transient outages. */
      } finally {
        if (mounted && request === version && !quiet) setLoading(false);
      }
      if (!mounted || request !== version || profileChannel) return;
      profileChannel = supabase
        .channel(`user-profile-${nextUser.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${nextUser.id}` },
          (payload) => {
            if (!mounted || currentUserId !== nextUser.id) return;
            setProfile((previous) => {
              const next = { ...previous, ...payload.new } as AuthUser;
              void localCache.write(nextUser.id, 'profile', 'self', next);
              return next;
            });
          }
        )
        .subscribe();
    };
    void AuthService.getCurrentUser().then((user) => {
      if (mounted && version === 0) void applySession(user);
    });
    const {
      data: { subscription },
    } = AuthService.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'TOKEN_REFRESH_FAILED') return; // A failed refresh is not proof of revocation; the session watcher checks online.
      void applySession(session?.user ?? null, event === 'TOKEN_REFRESHED');
    });
    return () => {
      mounted = false;
      version++;
      subscription.unsubscribe();
      stopProfile();
    };
  }, []);

  const signUp = async (email: string, password: string, name: string, username?: string) => {
    setLoading(true);
    try {
      const result = await AuthService.signUp(email, password, name, username);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (result.error || !session) {
        setLoading(false);
      }
      return result;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await AuthService.signIn(email, password);
      if (result.error) {
        setLoading(false);
      }
      return result;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithGoogle();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (result.error || !session) {
        setLoading(false);
      }
      return result;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const signInWithApple = async () => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithApple();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (result.error || !session) {
        setLoading(false);
      }
      return result;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (user) {
        try {
          const deviceId = await getOrCreateDeviceId();
          await supabase
            .from('user_push_tokens')
            .delete()
            .eq('user_id', user.id)
            .eq('device_id', deviceId);
        } catch (err) {
          console.error('Failed to delete push token on sign out:', err);
        }
      }

      localCache.setAccount(null);
      const result = await AuthService.signOut();
      setUser(null);
      setProfile(null);
      return result;
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    return await AuthService.resetPassword(email);
  };

  const updatePassword = async (newPassword: string) => {
    return await AuthService.updatePassword(newPassword);
  };

  const updateProfile = async (updates: Partial<AuthUser>) => {
    if (!user) throw new Error('No user logged in');

    try {
      await AuthService.updateUserProfile(user.id, updates);

      const updatedProfile = profile ? { ...profile, ...updates } : null;
      setProfile(updatedProfile);
      if (updatedProfile) void localCache.write(user.id, 'profile', 'self', updatedProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const sendPhoneOtp = async (phone: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone },
      });
      if (error) throw new Error(error.message || 'Failed to send OTP');
      if (data?.error) throw new Error(data.error);
      return data.pinId as string;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async (pinId: string, pin: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { pinId, pin },
      });
      if (error) throw new Error(error.message || 'Failed to verify OTP');
      if (data?.error) {
        let errMessage = data.error;
        if (
          typeof errMessage === 'string' &&
          (errMessage.toLowerCase().includes('token') ||
            errMessage.toLowerCase().includes('expired'))
        ) {
          errMessage =
            'The verification code has expired. Please request a new code and try again.';
        }
        throw new Error(errMessage);
      }

      if (profile) {
        const updatedProfile = { ...profile, phone_verified: true };
        setProfile(updatedProfile);
        if (user?.id) void localCache.write(user.id, 'profile', 'self', updatedProfile);
      }
      return true;
    } catch (err: any) {
      let errMessage = err.message || err;
      if (
        typeof errMessage === 'string' &&
        (errMessage.toLowerCase().includes('token') || errMessage.toLowerCase().includes('expired'))
      ) {
        errMessage = 'The verification code has expired. Please request a new code and try again.';
      }
      throw new Error(errMessage);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    sendPhoneOtp,
    verifyPhoneOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
