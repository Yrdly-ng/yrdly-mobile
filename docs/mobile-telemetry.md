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

- `TelemetryHandler` runs inside `AuthProvider`, waits for initial auth resolution, identifies the account by its stable UUID, and resets analytics identity before a different account is identified. The account email is sent only as a person property to PostHog and as the Sentry user email, so staff can search for an account. A changed email refreshes the person property without changing the UUID. Names, phone, and other profile metadata are not passed to either SDK. Email is never allowed on screen or product-event properties.
- Screens come from `useSegments()` templates. `chat/[id]` is recorded as `/chat/[id]`, never the resolved conversation ID or query parameters. Known templates live in `src/lib/telemetry/routes.ts`; add a template there when adding a screen. Adjacent duplicate screen calls are suppressed. PostHog events carry an `app_environment` property so preview activity can be filtered separately from production.
- `business_saved` is emitted after the complete business save succeeds. `message_sent` is emitted after a successful message insert acknowledgement; fallback acknowledgement of an existing saved row does not emit another event. No business fields, message text, media URLs, or recipient IDs are included.
- Existing `ErrorBoundary` and `logError` report through Sentry. Business save and chat send catch blocks provide fixed operation labels. Backend errors without an Error stack are normalized to a stack-bearing Error; bounded SQL/PostgREST codes are retained when available.
- Background transitions flush buffered analytics/errors without making app actions depend on a telemetry request succeeding.

Use the exported helpers from `src/lib/telemetry` rather than creating SDK clients in screens. Extend the event/context allowlists deliberately when adding instrumentation. The integration does not use a second PostHog provider or automatic router capture.

## Privacy and diagnostics

Sentry mobile session replay is enabled in source configuration with a 10% session sample rate and a 100% error sample rate for sessions not already selected. Error sampling includes native unhandled promise rejections, which Sentry labels `handled: true`. Sampling is subject to SDK delivery and project quotas; it does not guarantee a recording for every error. PostHog session replay remains disabled to avoid recording each session twice.

Replay masks all text, inputs, images, vectors, and WebViews. Additional native class masks cover maps, Expo images/video/camera, and Android SurfaceView/TextureView surfaces, which can contain private content outside standard text/image views. Keep global masking enabled. `ReplayLabel` uses Sentry's native `Unmask` view for fixed, non-sensitive interface copy only; never use it around names, messages, input values, locations, or server-provided content. Map tiles and positions remain hidden while the surrounding interaction is visible. Replay network body capture is disabled and no network URLs are allowlisted.

## PostHog usage dashboard

Use PostHog Product Analytics to create a dashboard named **YRDLY Mobile Usage**. Add trends with daily/weekly intervals and filter `app_environment` to `production` when reviewing real user activity. Suggested insights:

1. **Active accounts:** unique `distinct_id` for `$screen`, with a daily trend.
2. **Most visited screens:** `$screen` broken down by `$screen_name`.
3. **Core actions:** counts of `business_saved` and `message_sent` over time.
4. **App versions:** unique account count or event count broken down by `$app_version`.

Events are allowlisted and intentionally sparse; today the app emits `business_saved` and `message_sent`, but does not emit failure events, so these counts do not provide an action success rate. No session replay or automatic lifecycle events are sent to PostHog. Person profiles can be searched by account UUID or email after the account identifies. The dashboard is not created automatically by the app; create it in the connected PostHog project and share access only with staff who need usage data.

Automatic push-token capture, feature-flag requests, surveys, console/network breadcrumbs, standalone error screenshot/view-hierarchy attachments, performance tracing, and SDK log collection remain disabled. Replay frames are separate from standalone error screenshot attachments. PostHog uses memory persistence and strips unapproved event properties before sending; authenticated analytics still use the stable account UUID. Anonymous identities are not retained between launches, and unsent memory events can be lost if the process is killed.

Sentry's JavaScript event filter removes free-form error messages, request payloads, extra fields, arbitrary contexts, and personal user properties. It retains the error class, stack locations, release/build, approved operation/screen/code tags, matching debug-image IDs for symbolication, and a validated opaque replay ID when supplied. The mobile replay integration also links the sanitized error to its recording. This intentionally limits free-text diagnostics. Native crash events and native replay recordings do not necessarily pass through JavaScript hooks: replay content is protected by native masking, and Sentry's server-side data scrubbing must remain enabled. The SDKs are not promised to suppress transport IP addresses at the server; PostHog GeoIP enrichment is disabled.

## Builds and source maps

`app.config.js` includes Sentry's Expo plugin; Metro uses `getSentryExpoConfig` with web replay excluded. Expo prebuild generates the Android Gradle and iOS Xcode upload hooks. GitHub and the EAS post-install hook run `scripts/configure-telemetry-build.cjs`. Uploads are enabled when organization, project, and auth token are configured. Otherwise uploads are disabled with a warning so an unconfigured preview build can still succeed. `SENTRY_DISABLE_AUTO_UPLOAD=true` is respected explicitly.

Never put the auth token into `extra`, public Expo variables, native `sentry.properties`, or committed files. CI receives it only from its secret store. Both GitHub build workflows forward the same public telemetry settings and build-only Sentry credentials. A new native binary is required after adding the Sentry SDK/plugin; existing installed apps and current queued builds do not acquire this integration.

Replay uses `@sentry/react-native` 8.27.0 and CLI 3.8.0. The SDK upgrade fixes iOS Fabric image masking and adds native class masking; 7.11.0 must not be used for this replay configuration. Version 8 requires iOS 15+, Xcode 16.4+, Android Gradle Plugin 7.4+, and Kotlin 1.8+. The application's React Native minimum iOS 15.1, AGP 8.12/Kotlin 2.1 tooling, and EAS Xcode 26.2 profiles satisfy those requirements. This native SDK upgrade requires a newly built and installed binary; an OTA-only change cannot update its native masking. Expo Go and the web target do not support this mobile recorder.

## Validation

Run `pnpm test:telemetry`, `pnpm typecheck`, and `pnpm lint`. The SDK-boundary tests cover disabled/missing configuration, account switching/logout, route deduplication, payload filtering, source-map debug-image correspondence, and SDK failures. They do not transmit events.


For release validation, build a preview binary, sign in, navigate between screens, save a business, and send a test message between tester accounts. Check PostHog for template screen events and the successful action events. To validate handled errors without crashing a device, temporarily call `captureAppError(new Error('Telemetry smoke test'), 'app.logger')` in a development-only test action with explicit debug opt-in, then remove it. Confirm the Sentry issue has the expected environment and readable source-map stack. Also verify logout and account switches do not attach later events to the prior account. No permanent test button is included in the product.

References: [Expo Sentry setup](https://docs.expo.dev/guides/using-sentry/), [Sentry Expo guide](https://docs.sentry.io/platforms/react-native/guides/expo/), [PostHog React Native](https://posthog.com/docs/libraries/react-native), [Expo build environment variables](https://docs.expo.dev/eas/environment-variables/usage/).

Replay references: [Sentry mobile replay](https://docs.sentry.io/platforms/react-native/session-replay/), [native masking](https://docs.sentry.io/platforms/react-native/session-replay/privacy/), [iOS Fabric image fix](https://github.com/getsentry/sentry-react-native/pull/6726), [SDK 7-to-8 migration](https://docs.sentry.io/platforms/react-native/migration/v7-to-v8/).
