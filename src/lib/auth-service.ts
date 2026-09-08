import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  phone_verified?: boolean;
  name?: string;
  legal_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: {
    state?: string;
    lga?: string;
    city?: string;
    ward?: string;
  };
  home_state?: string | null;
  home_lga?: string | null;
  home_ward?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
  home_location_geom?: string | null;
  friends?: string[];
  blocked_users?: string[];
  interests?: string[];
  share_location?: boolean;
  notification_settings?: {
    friendRequests: boolean;
    messages: boolean;
    postUpdates: boolean;
    comments: boolean;
    postLikes: boolean;
    eventInvites: boolean;
  };
  is_online?: boolean;
  last_seen?: string;
  onboarding_status?:
    'signup' | 'email_verification' | 'profile_setup' | 'welcome' | 'tour' | 'completed';
  profile_completed?: boolean;
  onboarding_completed_at?: string;
  tour_completed?: boolean;
  welcome_message_sent?: boolean;
  created_at?: string;
  updated_at?: string;
  role?: 'user' | 'admin';
  is_admin?: boolean;
  discoverable?: boolean;
}

export class AuthService {
  private static getRedirectUrl() {
    const url = makeRedirectUri({
      path: 'auth/callback',
    });

    return url;
  }

  // Sign up with email and password
  static async signUp(email: string, password: string, name: string, username?: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // NOTE: Do NOT include emailRedirectTo here.
          // With no redirectTo, Supabase sends a 6-digit OTP code to the user's email,
          // which is what the verify-otp screen expects.
          // Adding emailRedirectTo causes Supabase to send a magic-link instead,
          // which breaks the OTP flow and produces "error sending confirmation code".
          data: {
            name,
            username,
          },
        },
      });

      if (error) throw error;
      return { user: data.user, session: data.session, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { user: null, session: null, error };
    }
  }

  // Sign in with email and password
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { user: data.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error };
    }
  }

  // Sign in with Google
  static async signInWithGoogle() {
    try {
      const redirectTo = this.getRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true, // Prevents default web redirect, required for native
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Opens the secure native browser to complete OAuth
        // Force Chrome on Android to bypass buggy app interceptors (like OPay/EaseMoni)
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
          browserPackage: 'com.android.chrome',
        });

        if (result.type === 'success' && result.url) {
          // If Supabase uses PKCE flow (default in v2), extract code:
          const urlParams = new URLSearchParams(result.url.split('?')[1] || '');
          const code = urlParams.get('code');
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          } else {
            // If Implicit flow (hash), extract token:
            const hashParams = new URLSearchParams(result.url.split('#')[1] || '');
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { data: null, error };
    }
  }

  // Sign in with Apple
  static async signInWithApple() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: this.getRedirectUrl(),
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Apple sign in error:', error);
      return { data: null, error };
    }
  }

  // Sign out
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  }

  // Get current user
  static async getCurrentUser(): Promise<User | null> {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        if (error.message !== 'Auth session missing!') {
          console.error('Get current session error:', error);
        }
        // Return session user if it exists despite the error (e.g. offline refresh failure)
        return session?.user ?? null;
      }
      return session?.user ?? null;
    } catch (error: any) {
      if (error.message !== 'Auth session missing!') {
        console.error('Get current session error:', error);
      }
      return null;
    }
  }

  // Get user profile from public.users table
  static async getUserProfile(userId: string): Promise<AuthUser | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Database error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  // Check if a username is available (case-insensitive)
  static async checkUsernameAvailability(
    username: string,
    excludeUserId?: string
  ): Promise<boolean> {
    try {
      const clean = username.replace(/^@/, '').trim().toLowerCase();
      if (!clean) return true;

      let query = supabase.from('users').select('id').ilike('username', clean);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error checking username availability:', error);
        return true;
      }

      return !data || data.length === 0;
    } catch (e) {
      console.error('Check username availability error:', e);
      return true;
    }
  }

  // Create user profile in public.users table
  static async createUserProfile(user: User, name: string) {
    try {
      const existingProfile = await this.getUserProfile(user.id);
      if (existingProfile) {
        return;
      }

      const finalName = name || user.user_metadata?.name || user.email?.split('@')[0];

      const { error } = await supabase.from('users').insert({
        id: user.id,
        name: finalName,
        legal_name: user.user_metadata?.legal_name,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url,
        profile_completed: false,
        onboarding_status: 'profile_setup',
        notification_settings: {
          friendRequests: true,
          messages: true,
          postUpdates: true,
          comments: true,
          postLikes: true,
          eventInvites: true,
        },
      });

      if (error) {
        if (error.code === '23505') {
          return;
        }
        console.error('Database error creating user profile:', error);
        throw error;
      }
    } catch (error) {
      console.error('Create user profile error:', error);
      throw error;
    }
  }

  // Update user profile
  static async updateUserProfile(userId: string, updates: Partial<AuthUser>) {
    try {
      if (updates.username) {
        updates.username = updates.username.replace(/^@/, '').trim().toLowerCase();
      }

      const { error } = await supabase.from('users').update(updates).eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('Update user profile error:', error);
      throw error;
    }
  }

  // Check if account can be safely deleted without pending transactions/disputes
  static async canDeleteAccount(userId: string): Promise<{ canDelete: boolean; reason?: string }> {
    try {
      // Check for pending escrow transactions
      const { data: pendingTx } = await supabase
        .from('transactions')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq('status', 'pending_escrow')
        .limit(1);

      if (pendingTx && pendingTx.length > 0) {
        return {
          canDelete: false,
          reason:
            'You have active escrow transactions in progress. Please complete or cancel them before deleting your account.',
        };
      }

      // Check for open disputes
      const { data: openDisputes } = await supabase
        .from('disputes')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq('status', 'open')
        .limit(1);

      if (openDisputes && openDisputes.length > 0) {
        return {
          canDelete: false,
          reason:
            'You have open marketplace disputes. Please resolve all open disputes before deleting your account.',
        };
      }

      return { canDelete: true };
    } catch (e) {
      return { canDelete: true };
    }
  }

  // Promote user to admin (admin-only)
  static async promoteToAdmin(userId: string) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');

      const profile = await this.getUserProfile(currentUser.id);
      if (profile?.role !== 'admin' && !profile?.is_admin) {
        throw new Error('Not authorized to promote users');
      }

      const { error } = await supabase
        .from('users')
        .update({ role: 'admin', is_admin: true })
        .eq('id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Promote to admin error:', error);
      return { error };
    }
  }

  // Reset password
  static async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: makeRedirectUri({ path: 'reset-password' }),
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error };
    }
  }

  // Update password
  static async updatePassword(newPassword: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Update password error:', error);
      return { error };
    }
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
}
