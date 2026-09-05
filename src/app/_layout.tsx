import '../theme/unistyles';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/toast';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRouter, useSegments, usePathname, useGlobalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { usePushNotifications } from '../hooks/use-push-notifications';
import { AuthProvider, useAuth } from '../hooks/use-supabase-auth';
import { ThemeProvider } from '../context/ThemeContext';
import { LocationProvider } from '../context/LocationContext';
import { NotificationBadgeProvider } from '../context/NotificationBadgeContext';
import * as SplashScreen from 'expo-splash-screen';
import { PostHogProvider, usePostHog, PostHogErrorBoundary } from 'posthog-react-native';
import { setAudioModeAsync } from 'expo-audio';
import { OfflineBanner } from '../components/OfflineBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { oneSignalService } from '../lib/onesignal';
import { useFonts } from 'expo-font';
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { View, Text } from 'react-native';

const ErrorFallback = ({ error }: { error: any }) => (
  <View
    style={{
      flex: 1,
      backgroundColor: '#0A0A0A',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    }}
  >
    <Text style={{ color: '#EF4444', fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
      Something went wrong
    </Text>
    <Text style={{ color: '#9CA3AF', textAlign: 'center' }}>
      {error instanceof Error ? error.message : String(error)}
    </Text>
  </View>
);

SplashScreen.preventAutoHideAsync().catch(() => {
  // already hidden, ignore
});

function AnalyticsTracker() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    if (pathname && posthog) {
      posthog.screen(pathname, { params });
    }
  }, [pathname, params, posthog]);

  return null;
}

function NotificationsHandler() {
  usePushNotifications();
  return null;
}

function AudioSettingsHandler() {
  useEffect(() => {
    // Configure audio to play even when the physical silent switch is enabled on iOS
    // Wrapping in try-catch to prevent native bridge initialization crashes on Android
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });
      } catch (e) {
        console.warn('[Yrdly] Failed to configure audio mode:', e);
      }
    };
    configureAudio();
  }, []);
  return null;
}

function RootNavigationGuard() {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [profileWaitTime, setProfileWaitTime] = useState(0);

  useEffect(() => {
    if (user && !profile) {
      const timer = setTimeout(() => setProfileWaitTime((prev) => prev + 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setProfileWaitTime(0);
    }
  }, [user, profile, profileWaitTime]);

  useEffect(() => {
    if (loading) return;

    // Auth state resolved — dismiss the splash screen
    SplashScreen.hideAsync().catch(() => {});

    const inAuth = segments[0] === '(auth)' || (segments[0] as string) === 'auth';
    const inOnboarding = segments[0] === '(onboarding)';

    // These segments are valid deep-link destinations — never redirect away from them
    const DEEP_LINK_SEGMENTS = ['posts', 'events', 'marketplace', 'profile', 'chat', 'checkout'];
    const inDeepLink = DEEP_LINK_SEGMENTS.includes(segments[0] as string);

    try {
      if (!user) {
        // Not signed in → allow navigation within auth and onboarding flows
        if (!inAuth && !inOnboarding) {
          router.replace('/(onboarding)/welcome');
        }
        return;
      }

      // Signed in — wait for profile to load
      if (!profile) {
        // Deadlock prevention: if we've waited > 4 seconds and profile is still null,
        // assume it's a broken OAuth sign-up or network failure and push to onboarding to recover.
        if (profileWaitTime > 4 && !inOnboarding) {
          router.replace('/(onboarding)/profile1' as any);
        }
        return;
      }

      // If we're on a deep-linked content route, leave it alone
      if (inDeepLink) return;

      // Signed in and profile loaded — check onboarding state
      const needsProfile = !profile.profile_completed;

      if (needsProfile) {
        if (!inOnboarding) {
          router.replace('/(onboarding)/profile1' as any);
        }
      } else {
        // Onboarding complete — redirect out of auth/onboarding/root to tabs
        const isRoot =
          (segments as any).length === 0 ||
          (segments[0] as string) === 'index' ||
          (segments[0] as string) === '';
        const isResetPassword =
          (segments[0] === '(auth)' || segments[0] === 'auth') && segments[1] === 'reset-password';
        if (!isResetPassword && (inAuth || inOnboarding || isRoot)) {
          router.replace('/(tabs)');
        }
      }
    } catch (navError) {
      console.warn('[RootNavigationGuard] Navigation error (transient):', navError);
    }
  }, [user, profile, loading, segments, router, profileWaitTime]);

  return (
    <ErrorBoundary>
      <AnalyticsTracker />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="new-post"
          options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }}
        />
        <Stack.Screen name="verify-phone" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen
          name="verify-phone-otp"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="tickets" options={{ headerShown: false }} />
      </Stack>
    </ErrorBoundary>
  );
}

import { KeyboardProvider } from 'react-native-keyboard-controller';
import { UnistylesRuntime } from 'react-native-unistyles';
import { getStoredThemePreference } from '../lib/theme-preference';

function Layout() {
  useEffect(() => {
    oneSignalService.initialize();

    getStoredThemePreference().then((theme) => {
      if (theme) {
        UnistylesRuntime.setTheme(theme);
      }
    });
  }, []);

  const [fontsLoaded] = useFonts({
    Outfit: Outfit_400Regular,
    'Outfit-Light': Outfit_300Light,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'Outfit-ExtraBold': Outfit_800ExtraBold,
    'Outfit-Black': Outfit_900Black,
    Inter: Inter_400Regular,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  // Keep splash screen visible until fonts are ready
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#050505' }} />;
  }

  const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY || process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider position="bottom">
          {posthogKey ? (
            <PostHogProvider
              apiKey={posthogKey}
              options={{
                host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
                captureAppLifecycleEvents: true,
                enableSessionReplay: true,
                errorTracking: {
                  autocapture: {
                    nativeCrashes: true,
                    unhandledRejections: true,
                  },
                },
              }}
              autocapture={{ captureTouches: true, captureScreens: false }}
            >
              <PostHogErrorBoundary
                fallback={ErrorFallback}
                additionalProperties={{ app_section: 'root' }}
              >
                <KeyboardProvider>
                  <ThemeProvider>
                    <BottomSheetModalProvider>
                      <AuthProvider>
                        <LocationProvider>
                          <NotificationBadgeProvider>
                            <AudioSettingsHandler />
                            <NotificationsHandler />
                            <RootNavigationGuard />
                          </NotificationBadgeProvider>
                        </LocationProvider>
                      </AuthProvider>
                    </BottomSheetModalProvider>
                  </ThemeProvider>
                </KeyboardProvider>
              </PostHogErrorBoundary>
            </PostHogProvider>
          ) : (
            <KeyboardProvider>
              <ThemeProvider>
                <BottomSheetModalProvider>
                  <AuthProvider>
                    <LocationProvider>
                      <NotificationBadgeProvider>
                        <AudioSettingsHandler />
                        <NotificationsHandler />
                        <RootNavigationGuard />
                      </NotificationBadgeProvider>
                    </LocationProvider>
                  </AuthProvider>
                </BottomSheetModalProvider>
              </ThemeProvider>
            </KeyboardProvider>
          )}
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Layout;
