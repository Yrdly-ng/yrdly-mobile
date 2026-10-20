import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import {
  appEvents,
  errorContexts,
  isErrorCode,
  isUserId,
  sanitizePostHogEvent,
  sanitizeSentryEvent,
  telemetryEnvironment,
  type AppEvent,
} from './privacy';
import { screenName } from './routes';

let initialized = false;
let sentryEnabled = false;
let analytics: PostHog | undefined;
let currentUser: string | null = null;
let lastScreen: string | null = null;

// Analytics/reporting must never make a successful app action fail.
function safely(action: () => unknown): void {
  try {
    void Promise.resolve(action()).catch(() => {});
  } catch {
    // Intentionally do not log telemetry failures back into telemetry.
  }
}

export function initializeTelemetry(): void {
  if (initialized) return;
  initialized = true;
  if (process.env.EXPO_PUBLIC_TELEMETRY_DISABLED === 'true') return;
  if (__DEV__ && process.env.EXPO_PUBLIC_TELEMETRY_DEBUG !== 'true') return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (dsn) {
    safely(() => {
      Sentry.init({
        dsn,
        environment: telemetryEnvironment(),
        sendDefaultPii: false,
        enableLogs: false,
        enableCaptureFailedRequests: false,
        enableAutoPerformanceTracing: false,
        enableUserInteractionTracing: false,
        attachScreenshot: false,
        attachViewHierarchy: false,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        maxBreadcrumbs: 0,
        beforeBreadcrumb: () => null,
        beforeSend: sanitizeSentryEvent,
        // Keep default error/unhandled rejection handlers and native crash support.
        // Replace the default recorder with explicit masking. PostHog replay stays off.
        integrations: (defaults) => [
          ...defaults.filter(
            (integration) =>
              !['Breadcrumbs', 'HttpContext', 'MobileReplay'].includes(integration.name)
          ),
          Sentry.mobileReplayIntegration({
            maskAllText: true,
            maskAllImages: true,
            maskAllVectors: true,
            networkCaptureBodies: false,
            networkDetailAllowUrls: [],
            // Native maps and media surfaces can contain locations or private content
            // outside React Native Text/Image views. Other-platform names are ignored.
            maskedViewClasses: [
              'MKMapView',
              'GMSMapView',
              'RNMapsMapView',
              'RNMapsGoogleMapView',
              'com.google.android.gms.maps.MapView',
              'WKWebView',
              'android.webkit.WebView',
              'ExpoImage.ImageView',
              'ExpoVideo.VideoView',
              'ExpoCamera.CameraView',
              'expo.modules.image.ExpoImageView',
              'expo.modules.video.VideoView',
              'expo.modules.camera.ExpoCameraView',
              'android.view.SurfaceView',
              'android.view.TextureView',
            ],
          }),
        ],
      });
      sentryEnabled = true;
      Sentry.setUser(null);
    });
  }

  const key =
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
  if (key) {
    safely(() => {
      analytics = new PostHog(key, {
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
        persistence: 'memory',
        personProfiles: 'identified_only',
        captureAppLifecycleEvents: false,
        capturePushNotificationSubscriptions: false,
        capturePushNotificationOpened: false,
        enableSessionReplay: false,
        enablePersistSessionIdAcrossRestart: false,
        errorTracking: { autocapture: false },
        disableGeoip: true,
        disableSurveys: true,
        preloadFeatureFlags: false,
        disableRemoteFeatureFlags: true,
        setDefaultPersonProperties: false,
        before_send: sanitizePostHogEvent,
        logs: { beforeSend: () => null },
        customAppProperties: (properties) => ({
          $app_version: properties.$app_version,
          $app_build: properties.$app_build,
          $os_name: properties.$os_name,
          $os_version: properties.$os_version,
        }),
      });
    });
  }
}

export function setTelemetryUser(id: string | null): void {
  const nextUser = isUserId(id) ? id : null;
  if (currentUser === nextUser) return;
  const previousUser = currentUser;
  currentUser = nextUser;
  lastScreen = null;
  if (sentryEnabled) safely(() => Sentry.setUser(nextUser ? { id: nextUser } : null));
  // reset() before identify() prevents joining two authenticated accounts.
  if (previousUser) {
    try {
      analytics?.reset();
    } catch {
      // If clearing identity fails, do not risk linking another account.
      analytics = undefined;
    }
  }
  if (nextUser) safely(() => analytics?.identify(nextUser));
}

export function trackScreen(template: string): void {
  const name = screenName(template);
  if (!name || name === lastScreen) return;
  lastScreen = name;
  if (sentryEnabled) safely(() => Sentry.setTag('screen', name));
  safely(() => analytics?.screen(name));
}

export function trackEvent(event: AppEvent): void {
  if (!appEvents.has(event)) return;
  safely(() => analytics?.capture(event));
}

export function captureAppError(error: unknown, context?: string): void {
  if (!sentryEnabled) return;
  safely(() => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    Sentry.captureException(
      error instanceof Error ? error : new Error('Application operation failed'),
      {
        tags: {
          ...(context && errorContexts.has(context) ? { operation: context } : {}),
          ...(isErrorCode(code) ? { error_code: code } : {}),
        },
      }
    );
  });
}

export async function flushTelemetry(): Promise<void> {
  await Promise.allSettled([
    Promise.resolve().then(() => analytics?.flush()),
    Promise.resolve().then(() => (sentryEnabled ? Sentry.flush() : undefined)),
  ]);
}
