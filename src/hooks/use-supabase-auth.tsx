'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { AuthService, AuthUser } from '@/lib/auth-service';
import { supabase } from '@/lib/supabase';
import { oneSignalService } from '@/lib/onesignal';
import { usePostHog } from 'posthog-react-native';
import { identifyUser } from '@/lib/analytics';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';


const PROFILE_CACHE_FILE = `${FileSystem.documentDirectory}user_profile_cache.json`;

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
  const posthog = usePostHog();

  useEffect(() => {
    let isMounted = true;
    let profileChannel: any = null;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser);

          if (currentUser) {
            try {
              let userProfile = null;
              try {
                // Try cache first for fast boot
                const info = await FileSystem.getInfoAsync(PROFILE_CACHE_FILE);
                if (info.exists) {
                  const cached = await FileSystem.readAsStringAsync(PROFILE_CACHE_FILE);
                  const parsed = JSON.parse(cached);
                  if (parsed && parsed.id === currentUser.id) {
                    userProfile = parsed;
                  }
                }
              } catch (e) {}

              const netInfo = await NetInfo.fetch();
              if (netInfo.isConnected) {
                // Fetch fresh profile in background and update state when ready
                AuthService.getUserProfile(currentUser.id)
                  .then((freshProfile) => {
                    if (freshProfile && isMounted) {
                      setProfile(freshProfile);
                      FileSystem.writeAsStringAsync(
                        PROFILE_CACHE_FILE,
                        JSON.stringify(freshProfile)
                      ).catch(() => {});
                    }
                  })
                  .catch((e) => console.warn('Background profile fetch error:', e));

                // Also try quick fetch for initial mount
                try {
                  const fetchPromise = AuthService.getUserProfile(currentUser.id);
                  const timeoutPromise = new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 2000)
                  );
                  const quickProfile = await Promise.race([fetchPromise, timeoutPromise]);
                  if (quickProfile) {
                    userProfile = quickProfile;
                  }
                } catch (e) {}
              }

              // If no profile exists and not from cache, create one
              if (!userProfile && !profileCreationInProgress.current) {
                profileCreationInProgress.current = true;
                try {
                  await AuthService.createUserProfile(
                    currentUser,
                    currentUser.user_metadata?.name ||
                      currentUser.user_metadata?.full_name ||
                      currentUser.user_metadata?.display_name ||
                      currentUser.user_metadata?.given_name ||
                      currentUser.email?.split('@')[0] ||
                      'User'
                  );
                  // Fetch the newly created profile
                  userProfile = await AuthService.getUserProfile(currentUser.id);
                  if (userProfile) {
                    FileSystem.writeAsStringAsync(
                      PROFILE_CACHE_FILE,
                      JSON.stringify(userProfile)
                    ).catch(() => {});
                  }
                } catch (createError) {
                  console.error('Error creating user profile on initial load:', createError);
                  userProfile = {
                    id: currentUser.id,
                    name: currentUser.user_metadata?.name || 'User',
                    email: currentUser.email,
                    profile_completed: true,
                  } as AuthUser;
                } finally {
                  profileCreationInProgress.current = false;
                }
              }

              if (isMounted) {
                setProfile(userProfile);
              }
            } catch (error) {
              console.error('Error fetching user profile (initial session):', error);
              // Don't null the profile on transient errors — keep whatever we have
            }
          } else {
            // No user, ensure profile is also null
            if (isMounted) {
              setProfile(null);
            }
          }
        }
      } catch (error) {
        // Don't log AuthSessionMissingError as it's expected when user is logged out
        if (error instanceof Error && error.message !== 'Auth session missing!') {
          console.error('Error getting initial session:', error);
        }
        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const setupProfileRealtime = (userId: string) => {
      // Clean up existing subscription if present
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
        profileChannel = null;
      }
      // Set up real-time subscription for profile updates
      profileChannel = supabase
        .channel(`user-profile-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`,
          },
          async (payload) => {
            if (isMounted && payload.new) {
              // Use the new payload directly instead of fetching which may return stale data
              setProfile((prev) => {
                if (!prev) return payload.new as AuthUser;
                return { ...prev, ...(payload.new as Partial<AuthUser>) };
              });
            }
          }
        )
        .subscribe();
    };

    getInitialSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = AuthService.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;

      // Skip INITIAL_SESSION — already handled by getInitialSession above
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT') {
        FileSystem.deleteAsync(PROFILE_CACHE_FILE, { idempotent: true }).catch(() => {});
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          console.warn('[Yrdly Auth] Ignored SIGNED_OUT event because device is offline.');
          return;
        }
      }

      if (event === 'TOKEN_REFRESH_FAILED') {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          console.warn('[Yrdly Auth] Token refresh failed while online. Logging out.');
          FileSystem.deleteAsync(PROFILE_CACHE_FILE, { idempotent: true }).catch(() => {});
          if (posthog) {
            posthog.capture('user_signed_out_forcefully');
            posthog.reset();
          }

          oneSignalService.logout();
          setUser(null);
          setProfile(null);
          supabase.auth.signOut().catch(() => {});
        } else {
          console.warn(
            '[Yrdly Auth] Token refresh failed but offline, keeping current user state.'
          );
        }
        return;
      }

      // On token refresh, only update profile silently in background — don't setState
      if (event === 'TOKEN_REFRESHED') {
        if (user) {
          AuthService.getUserProfile(user.id)
            .then((freshProfile) => {
              if (freshProfile && isMounted) {
                setProfile(freshProfile);
                FileSystem.writeAsStringAsync(
                  PROFILE_CACHE_FILE,
                  JSON.stringify(freshProfile)
                ).catch(() => {});
              }
            })
            .catch(() => {});
        }
        return;
      }

      if (isMounted) {
        setUser(user);

        if (user) {
          oneSignalService.login(user.id);

          try {
            let userProfile = null;
            try {
              const info = await FileSystem.getInfoAsync(PROFILE_CACHE_FILE);
              if (info.exists) {
                const cached = await FileSystem.readAsStringAsync(PROFILE_CACHE_FILE);
                const parsed = JSON.parse(cached);
                if (parsed && parsed.id === user.id) {
                  userProfile = parsed;
                }
              }
            } catch (e) {}

            const netInfo = await NetInfo.fetch();
            if (netInfo.isConnected) {
              try {
                const fetchPromise = AuthService.getUserProfile(user.id);
                const timeoutPromise = new Promise<null>((resolve) =>
                  setTimeout(() => resolve(null), 5000)
                );
                const freshProfile = await Promise.race([fetchPromise, timeoutPromise]);

                if (freshProfile) {
                  userProfile = freshProfile;
                  FileSystem.writeAsStringAsync(
                    PROFILE_CACHE_FILE,
                    JSON.stringify(freshProfile)
                  ).catch(() => {});
                }
              } catch (e) {
                console.warn('Network fetch for profile failed:', e);
              }
            }

            // If no profile exists, create one
            if (!userProfile && !profileCreationInProgress.current) {
              profileCreationInProgress.current = true;
              try {
                await AuthService.createUserProfile(
                  user,
                  user.user_metadata?.name ||
                    user.user_metadata?.full_name ||
                    user.user_metadata?.display_name ||
                    user.user_metadata?.given_name ||
                    user.email?.split('@')[0] ||
                    'User'
                );
                // Fetch the newly created profile
                userProfile = await AuthService.getUserProfile(user.id);
                if (userProfile) {
                  FileSystem.writeAsStringAsync(
                    PROFILE_CACHE_FILE,
                    JSON.stringify(userProfile)
                  ).catch(() => {});
                }
              } catch (createError) {
                console.error('Error creating user profile:', createError);
                userProfile = {
                  id: user.id,
                  name: user.user_metadata?.name || 'User',
                  email: user.email,
                  profile_completed: false,
                } as AuthUser;
              } finally {
                profileCreationInProgress.current = false;
              }
            }

            if (isMounted) {
              setProfile(userProfile);
              if (posthog) {
                identifyUser(posthog, user, userProfile);
              }
              // Set up real-time subscription for this user's profile
              setupProfileRealtime(user.id);
            }
          } catch (error) {
            console.error('Error fetching user profile (auth change):', error);
            // Don't null the profile on transient fetch errors — keep existing state
          }
        } else {
          setProfile(null);
          // Clean up profile subscription
          if (profileChannel) {
            supabase.removeChannel(profileChannel);
            profileChannel = null;
          }
        }

        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
      }
    };
  }, []); // Empty deps — auth listener must never be torn down and re-registered mid-session

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
      if (posthog) {
        posthog.capture('user_signed_out');
        posthog.reset();
      }

      oneSignalService.logout();
      FileSystem.deleteAsync(PROFILE_CACHE_FILE, { idempotent: true }).catch(() => {});
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
      if (data?.error) throw new Error(data.error);

      if (profile) {
        const updatedProfile = { ...profile, phone_verified: true };
        setProfile(updatedProfile);
        FileSystem.writeAsStringAsync(PROFILE_CACHE_FILE, JSON.stringify(updatedProfile)).catch(
          () => {}
        );
      }
      return true;
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
