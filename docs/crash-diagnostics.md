# Crash prevention and diagnostic contract

This change reduces known media/data failure risks; it does not establish the cause of the historical Android graphics-driver abort or guarantee crash-free operation.

## Diagnostic trail

Sentry keeps at most 20 manual breadcrumbs. Only registered route templates, fixed product action names, foreground/background states, retry requests and memory-warning categories are accepted. No resolved item/user IDs, query strings, request/response bodies, message text, media URLs, arbitrary console logs or UI contents are added. Trails clear when the account changes. Source-map/debug IDs and release/build metadata remain available for grouping.

## Reliability analytics

| Event | Meaning |
| --- | --- |
| `app_started` | One event per browser document/app process, after initialization. This is a launch count, not a unique-user or session count. |
| `app_error` | A Sentry error report processed by the JavaScript hook, with a bounded category, exception type, operation, route and handled flag when available. Report counts are not unique crashes. |
| `app_recovery_requested` | The user chose retry. This does not assert that recovery succeeded. |
| `app_previous_native_crash` | The native SDK explicitly reported a crash on the previous run. Unknown/false results are not counted. |
| `app_memory_warning` | A platform memory warning, limited to one event per 30 seconds. Availability depends on the operating system. |

Filter events by `app_environment` before comparing releases. Native events retain `$app_version`, `$app_build`, OS and bounded device metadata. Sentry preserves model, architecture, memory pressure and app build, excluding device IDs/names and location.

A hard process termination can happen before a JavaScript analytics event is flushed. Native crash reports and `app_previous_native_crash` must be reviewed alongside these analytics; absence of an analytics event is not evidence that no crash occurred.

## Release verification

Run the telemetry tests, typecheck and lint. Run `pnpm test:release` and compile both native bundles. Install a newly built APK/IPA for native diagnostics to take effect. Media previews now avoid idle decoders and release active feed/community players on blur/background. Android EAS builds reject a missing Maps key.
