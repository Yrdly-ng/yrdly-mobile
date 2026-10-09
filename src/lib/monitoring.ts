import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

/**
 * App health monitoring (App Store Guideline 2.6):
 * - Sentry: native + JS crash reports, unhandled errors, performance traces
 * - PostHog: product analytics (screens, app lifecycle events)
 *
 * Both are no-ops when their env keys are missing, so local/dev builds still run.
 * Users are identified by Supabase user ID only — no email, name, or phone is sent.
 */

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const sentryEnabled = !!SENTRY_DSN;

if (sentryEnabled) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,
  });
}

export const posthog: PostHog | null = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
    })
  : null;

export function trackScreen(name: string) {
  posthog?.screen(name);
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  posthog?.capture(event, properties);
}

export function identifyUser(userId: string | null) {
  if (userId) {
    Sentry.setUser({ id: userId });
    posthog?.identify(userId);
  } else {
    Sentry.setUser(null);
    posthog?.reset();
  }
}

export function captureError(error: unknown, context?: string, extra?: Record<string, any>) {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    if (context) scope.setTag('context', context);
    if (extra) scope.setExtras(extra);
    Sentry.captureException(error);
  });
}

export const wrapRoot = <P extends Record<string, any>>(Component: React.ComponentType<P>) =>
  sentryEnabled ? Sentry.wrap(Component) : Component;
