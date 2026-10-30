import { diagnosticMessage } from './diagnostics';
import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { homeState } from './metadata';
import {
  appEvents,
  errorContexts,
  isErrorCode,
  isEmail,
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
let currentEmail: string | null = null;
let currentHomeState: string | null = null;
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

  const posthogReplayEnabled = !!(process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim());
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
        replaysSessionSampleRate: posthogReplayEnabled ? 0 : 0.1,
        replaysOnErrorSampleRate: posthogReplayEnabled ? 0 : 1.0,
        maxBreadcrumbs: 0,
        beforeBreadcrumb: () => null,
        beforeSend: sanitizeSentryEvent,
        // Keep default error/unhandled rejection handlers and native crash support.
        // Use one masked recorder: PostHog where configured, otherwise Sentry.
        integrations: (defaults) => [
          ...defaults.filter(
            (integration) =>
              !['Breadcrumbs', 'HttpContext', 'MobileReplay'].includes(integration.name)
          ),
          ...(!posthogReplayEnabled ? [Sentry.mobileReplayIntegration({
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
          })] : []),
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
        sessionReplayConfig: {
          maskAllTextInputs: true, maskAllImages: true, maskAllSandboxedViews: true,
          captureLog: false, captureNetworkTelemetry: false, throttleDelayMs: 2000,
        },
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
          app_platform: Platform.OS,
          device_model: Device.modelName,
          device_manufacturer: Device.manufacturer,
          device_type: Device.deviceType === Device.DeviceType.PHONE ? 'phone'
            : Device.deviceType === Device.DeviceType.TABLET ? 'tablet'
            : Device.deviceType === Device.DeviceType.TV ? 'tv'
            : Device.deviceType === Device.DeviceType.DESKTOP ? 'desktop' : 'unknown',
        }),
      });
    });
  }
}

export function setTelemetryUser(id: string | null, email: string | null = null, selectedHomeState: unknown = null): void {
  const nextUser = isUserId(id) ? id : null;
  const nextEmail = nextUser && isEmail(email) ? email : null;
  const nextState = nextUser ? homeState(selectedHomeState) : null;
  currentHomeState = nextState;
  if (currentUser === nextUser && currentEmail === nextEmail) return;
  if (currentUser === nextUser) {
    currentEmail = nextEmail;
    if (sentryEnabled)
      safely(() =>
        Sentry.setUser(nextUser ? { id: nextUser, ...(nextEmail ? { email: nextEmail } : {}) } : null)
      );
    if (nextUser) safely(() => analytics?.identify(nextUser, nextEmail ? { email: nextEmail } : {}));
    return;
  }
  safely(() => analytics?.stopSessionRecording());
  const previousUser = currentUser;
  currentUser = nextUser;
  currentEmail = nextEmail;
  lastScreen = null;
  if (sentryEnabled)
    safely(() =>
      Sentry.setUser(nextUser ? { id: nextUser, ...(nextEmail ? { email: nextEmail } : {}) } : null)
    );
  // reset() before identify() prevents joining two authenticated accounts.
  if (previousUser) {
    try {
      analytics?.reset();
    } catch {
      // If clearing identity fails, do not risk linking another account.
      analytics = undefined;
    }
  }
  if (nextUser) safely(() => analytics?.identify(nextUser, nextEmail ? { email: nextEmail } : {}));
}

export function trackScreen(template: string): void {
  const name = screenName(template);
  const replayAllowed = !!name && ['(tabs)/catalog', 'events/team', 'my-events'].includes(template);
  safely(() => replayAllowed ? analytics?.startSessionRecording() : analytics?.stopSessionRecording());
  if (!name || name === lastScreen) return;
  lastScreen = name;
  if (sentryEnabled) safely(() => Sentry.setTag('screen', name));
  safely(() => analytics?.screen(name, { home_state: currentHomeState }));
}

export function trackEvent(event: AppEvent): void {
  if (!appEvents.has(event)) return;
  safely(() => analytics?.capture(event, { home_state: currentHomeState }));
}

export function captureAppError(error: unknown, context?: string): void {
  safely(() => analytics?.captureException(new Error(diagnosticMessage(error))));
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
