# Mobile analytics and error reporting

PostHog handles product analytics. Sentry handles JavaScript errors, React error boundaries, handled failures, and native crash reporting in rebuilt native apps. Both are initialized once by `src/telemetry.ts`, before themes and Expo Router load.

## Configuration

Merge the telemetry variables from `.env.example` into your environment; do not replace your existing application variables. Expo production already supplies the PostHog public key/host and Sentry DSN. `EXPO_PUBLIC_POSTHOG_API_KEY` is canonical; the existing `EXPO_PUBLIC_POSTHOG_KEY` remains a fallback.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog project ingestion key, not a personal API token |
| `EXPO_PUBLIC_POSTHOG_HOST` | Region-specific ingestion host, such as `https://us.i.posthog.com` |
| `EXPO_PUBLIC_SENTRY_DSN` | Mobile Sentry project DSN |
| `EXPO_PUBLIC_APP_ENV` | `development`, `preview`, or `production`; supplied by build profiles/CI |
| `EXPO_PUBLIC_TELEMETRY_DEBUG` | Set `true` explicitly to send from a local development build |
| `EXPO_PUBLIC_TELEMETRY_DISABLED` | Set `true` to disable both SDK initializations in that build |
| `SENTRY_ORG` | Build upload organization, `yrdly-ltd` |
| `SENTRY_PROJECT` | Build upload project, `yrdly-mobile` |
| `SENTRY_AUTH_TOKEN` | Build-only source-map upload credential; never put in Expo public variables or app config extras |

Missing configuration disables only the affected service. Local development does not send by default. The disabled flag is a build-time setting; an already installed binary does not fetch it remotely.

## Recorded behavior

- `TelemetryHandler` runs inside `AuthProvider`, waits for initial auth resolution, identifies only the account UUID, and resets analytics identity before a different account is identified. Names, email, phone, and profile metadata are not passed to either SDK.
- Screens come from `useSegments()` templates. `chat/[id]` is recorded as `/chat/[id]`, never the resolved conversation ID or query parameters. Known templates live in `src/lib/telemetry/routes.ts`; add a template there when adding a screen. Adjacent duplicate screen calls are suppressed. PostHog events carry an `app_environment` property so preview activity can be filtered separately from production.
- `business_saved` is emitted after the complete business save succeeds. `message_sent` is emitted after a successful message insert acknowledgement; fallback acknowledgement of an existing saved row does not emit another event. No business fields, message text, media URLs, or recipient IDs are included.
- Existing `ErrorBoundary` and `logError` report through Sentry. Business save and chat send catch blocks provide fixed operation labels. Backend errors without an Error stack are normalized to a stack-bearing Error; bounded SQL/PostgREST codes are retained when available.
- Background transitions flush buffered analytics/errors without making app actions depend on a telemetry request succeeding.

Use the exported helpers from `src/lib/telemetry` rather than creating SDK clients in screens. Extend the event/context allowlists deliberately when adding instrumentation. The integration does not use a second PostHog provider or automatic router capture.

## Privacy and diagnostics

Session replay, touch autocapture, automatic push-token capture, feature-flag requests, surveys, console/network breadcrumbs, screenshot/view capture, performance tracing, and SDK log collection are disabled. PostHog uses memory persistence and strips unapproved event properties before sending; authenticated analytics still use the stable account UUID. Anonymous identities are not retained between launches, and unsent memory events can be lost if the process is killed.

Sentry's JavaScript event filter removes free-form error messages, request payloads, extra fields, arbitrary contexts, and personal user properties. It retains the error class, stack locations, release/build, approved operation/screen/code tags, and matching debug-image IDs for symbolication. This intentionally limits free-text diagnostics. Native crash events do not necessarily pass through JavaScript hooks: keep Sentry's server-side data scrubbing enabled as well. The SDKs are not promised to suppress transport IP addresses at the server; PostHog GeoIP enrichment is disabled.

## Builds and source maps

`app.config.js` includes Sentry's Expo plugin; Metro uses `getSentryExpoConfig` with web replay excluded. Expo prebuild generates the Android Gradle and iOS Xcode upload hooks. GitHub and the EAS post-install hook run `scripts/configure-telemetry-build.cjs`. Uploads are enabled when organization, project, and auth token are configured. Otherwise uploads are disabled with a warning so an unconfigured preview build can still succeed. `SENTRY_DISABLE_AUTO_UPLOAD=true` is respected explicitly.

Never put the auth token into `extra`, public Expo variables, native `sentry.properties`, or committed files. CI receives it only from its secret store. Both GitHub build workflows forward the same public telemetry settings and build-only Sentry credentials. A new native binary is required after adding the Sentry SDK/plugin; existing installed apps and current queued builds do not acquire this integration.

## Validation

Run `pnpm test:telemetry`, `pnpm typecheck`, and `pnpm lint`. The SDK-boundary tests cover disabled/missing configuration, account switching/logout, route deduplication, payload filtering, source-map debug-image correspondence, and SDK failures. They do not transmit events.

For release validation, build a preview binary, sign in, navigate between screens, save a business, and send a test message between tester accounts. Check PostHog for template screen events and the successful action events. To validate handled errors without crashing a device, temporarily call `captureAppError(new Error('Telemetry smoke test'), 'app.logger')` in a development-only test action with explicit debug opt-in, then remove it. Confirm the Sentry issue has the expected environment and readable source-map stack. Also verify logout and account switches do not attach later events to the prior account. No permanent test button is included in the product.

References: [Expo Sentry setup](https://docs.expo.dev/guides/using-sentry/), [Sentry Expo guide](https://docs.sentry.io/platforms/react-native/guides/expo/), [PostHog React Native](https://posthog.com/docs/libraries/react-native), [Expo build environment variables](https://docs.expo.dev/eas/environment-variables/usage/).
