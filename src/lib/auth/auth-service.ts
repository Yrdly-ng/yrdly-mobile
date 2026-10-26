import { checkActiveSession, endRevokedSession } from './session-policy';
import { supabase } from '../supabase/supabase';
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
  nearby_enabled?: boolean;
  notification_settings?: {
    friendRequests: boolean;
    messages: boolean;
    postUpdates: boolean;
    comments: boolean;
    postLikes: boolean;
    eventInvites: boolean;
    marketplaceUpdates: boolean;
    bookings: boolean;
    orderUpdates: boolean;
    paymentReceived: boolean;
    disputeUpdates: boolean;
    safetyAlerts: boolean;
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
  role?: 'user' | 'admin' | 'moderator';
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

      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (
          errMsg.includes('already registered') ||
          errMsg.includes('already in use') ||
          errMsg.includes('user_already_exists')
        ) {
          return {
            user: null,
            session: null,
            error: new Error(
              'An account with this email address already exists. Please log in instead.'
            ),
          };
        }
        throw error;
      }

      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          user: null,
          session: null,
          error: new Error(
            'An account with this email address already exists. Please log in instead.'
          ),
        };
      }

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

      if (data.user && (await checkActiveSession(true)) === false) {
        await endRevokedSession();
        throw new Error('This session has been replaced by a newer sign-in.');
      }
      if (data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('is_suspended, is_banned, status, suspension_reason')
          .eq('id', data.user.id)
          .maybeSingle();

        if (
          profile &&
          (profile.is_suspended ||
            profile.is_banned ||
            profile.status === 'suspended' ||
            profile.status === 'banned')
        ) {
          await supabase.auth.signOut({ scope: 'local' });
          return {
            user: null,
            error: new Error(
              'Your account has been suspended or banned. You cannot log in or transact.'
            ),
          };
        }
      }

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { user: null, error };
    }
  }

  private static async signInWithProvider(provider: 'google' | 'apple') {
    try {
      const redirectTo = this.getRedirectUrl();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Unable to start sign-in. Please try again.');

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
        provider === 'google' ? { browserPackage: 'com.android.chrome' } : {}
      );
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { data: null, error: null };
      }
      if (result.type !== 'success' || !result.url) {
        throw new Error('Sign-in did not finish. Please try again.');
      }
      if (result.url.split(/[?#]/)[0] !== redirectTo.split(/[?#]/)[0]) {
        throw new Error('Unexpected sign-in callback. Please try again.');
      }
      const callback = new URL(result.url);
      const query = callback.searchParams;
      const hash = new URLSearchParams(callback.hash.slice(1));
      if (query.has('error') || hash.has('error')) {
        throw new Error('Sign-in was not approved. Please try again.');
      }
      const code = query.get('code');
      const access_token = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');
      const sessionResult = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : access_token && refresh_token
          ? await supabase.auth.setSession({ access_token, refresh_token })
          : null;
      if (!sessionResult) throw new Error('Sign-in callback was incomplete. Please try again.');
      if (sessionResult.error) throw sessionResult.error;
      if (!sessionResult.data.session) throw new Error('Unable to create a sign-in session.');
      return { data: sessionResult.data, error: null };
    } catch (error) {
      // Do not log callback URLs or provider tokens.
      return { data: null, error };
    }
  }

  static signInWithGoogle() {
    return this.signInWithProvider('google');
  }

  static signInWithApple() {
    return this.signInWithProvider('apple');
  }

  // Sign out
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
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
      }
      // A cached token is useful offline, but must pass the server's session
      // policy before restoring authenticated access when connected.
      if (session && (await checkActiveSession()) === false) {
        await endRevokedSession();
        return null;
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

      let query = supabase.from('public_profiles').select('id').ilike('username', clean);

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
          marketplaceUpdates: true,
          bookings: true,
          orderUpdates: true,
          paymentReceived: true,
          disputeUpdates: true,
          safetyAlerts: true,
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
        .from('escrow_transactions')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .in('status', ['pending', 'paid', 'shipped', 'delivered', 'disputed'])
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
        .from('escrow_transactions')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq('status', 'disputed')
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
      // Auth callbacks run under Supabase's lock. Defer network work until it is released.
      setTimeout(() => {
        void (async () => {
          if (
            session &&
            (await supabase.auth.getSession()).data.session?.access_token !== session.access_token
          )
            return;
          if (session && event !== 'INITIAL_SESSION') {
            const active = await checkActiveSession(event === 'SIGNED_IN');
            if (active === false) {
              await endRevokedSession();
              return;
            }
          }
          callback(event, session);
        })();
      }, 0);
    });
  }
}
