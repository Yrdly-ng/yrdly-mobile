# YRDLY native push reliability — 12 November 2026

## Evidence at the start of this repair

Production Supabase `YRDLY BACKEND` (`yoiyqxtpmxnrrbqqidcs`), read-only audit:

| Signal | Observed |
|---|---:|
| `user_push_tokens` rows | 12 |
| Unique Expo push tokens | 2 |
| Users represented | 3 |
| iOS token records | 0 |
| Largest shared native token | 10 rows, 2 users, 9 device IDs |
| Last 30-day native delivery rows | 204 failed / 16 `delivered` (Expo receipt status) |
| `SENDER_ID_MISMATCH` failures | 9, latest 9 Nov 2026 |
| Unregistered-device failures | 23 |
| Malformed/invalid provider requests | 117 |

`delivered` in the delivery table means **Expo returned an OK receipt**, not that Android/iOS visibly displayed a banner.

## Configured Android identity

- App package: `com.yrdly`
- Firebase project ID: `yrdly-470221`
- FCM project number / Sender ID: `399225255875`
- Expo EAS project UUID: see `app.config.js` under `extra.eas.projectId`
- `GOOGLE_SERVICES_JSON` or `GOOGLE_SERVICES_JSON_BASE64` supplies the Android Firebase client configuration; **these must never be a Firebase service-account private-key JSON**.
- The canonical validator `scripts/validate-android-firebase.cjs` checks the Android Firebase project ID, sender number, `com.yrdly` and `mobilesdk_app_id` prefix.
- The separate **FCM V1 service-account** credential uploaded to Expo (Credentials → Android → `com.yrdly` → FCM V1) must refer to the *same* Firebase project. That remote configuration cannot be established from GitHub source code.

## Fixes and safeguards

- Native token registration in `src/hooks/notifications/use-push-notifications.ts` exchanges one device token without recursively triggering the native token listener; registration races and app-resume retries are covered by `tests/push-registration.test.cjs`.
- Android EAS APK/AAB builds now refuse missing/foreign Firebase config. iOS builds do **not** require Android Firebase material.
- The backend sender and outbox (web repo PR #88) check **latest owner of each Expo push token across all accounts**, fail closed if ownership is unavailable, and suppress historical duplicate registrations. These protect against a stale token being used for the wrong account; they do not repair credentials or physically mint new tokens.
- Mobile Settings → Notifications includes a **Send Test Notification** control. It sends a bearer-authenticated request plus this installation's stable device ID to `POST /api/notifications/native-test`; the route verifies account+device ownership, rate-limits to two per minute, and queues a single-device test (120-second TTL). A queued result is not proof of receipt. The test endpoint is deployed separately with web repo PR #88.
- Daily-prompt broadcast switch remains OFF.

## Release and physical-device acceptance

1. In Expo's EAS dashboard, check the Android FCM V1 service account for the `com.yrdly` application belongs to Firebase project `yrdly-470221`. Confirm the project number matches the public `google-services.json`. If this is not true, obtain the correct FCM V1 service-account key securely from Firebase and upload it to Expo. Never commit that key or paste it into chat.
2. Build a **new signed Android APK/AAB** using the corrected `google-services.json`. Verify build logs explicitly ran the sender validator; an unsigned JS bundle is not an installable APK. If building via GitHub Actions, the existing manual Android workflow produces an APK artifact but its signing configuration is not an EAS store signing attestation.
3. Install the new app on an **authorized Android test device**, clear older app data/reinstall to refresh a stale Firebase token where appropriate, sign in, allow notifications and wait for native registration. Verify this account+device received a fresh row in `user_push_tokens`.
4. In the installed app choose **Settings → Notifications → Send Test Notification**. Verify visible notification in foreground, background, and app-closed states, and correct tap navigation. Inspect the server queue and Expo push receipt; an OK receipt alone is insufficient.
5. For **native iOS**, obtain a properly **signed** iOS build with the `com.yrdly` push entitlement and valid APNs key in EAS credentials. An unsigned GitHub iOS IPA cannot prove APNs delivery. Install on an authorized iPhone and repeat registration / foreground / background / closed / click tests.
6. Verify notification preference opt-outs, logout/account switching and no duplicate fanout. Repeat on the same device after switching test accounts; the old account must not receive new pushes.
7. Keep `DAILY_PROMPT_PUSH_ENABLED` disabled until native tests and scheduled-reminder QA pass. Rotate the leaked staging service-role credential separately under the user's control.

## Troubleshooting

- **`SENDER_ID_MISMATCH`**: most likely mismatch between Android `google-services.json`, installed build's Firebase project and Expo's FCM V1 service account. Resolve at credentials/build level, then mint a new token from a new build.
- **`DeviceNotRegistered`**: old/uninstalled app token; server already retires terminal invalid tokens. Reinstall/re-register a tester.
- **No iOS token**: investigate physical device, permission, signed provisioning/APNs entitlement, Expo build and account registration. Web/PWA iPhone notifications do not count as native app APNs tokens.
- **No test push**: confirm user is authenticated, device has a valid `user_push_tokens` row, server endpoint is deployed, and rate limiter allows the request. After a test, check `push_notification_deliveries` by user and timestamp; do not copy token strings into logs or reports.

## Rollback

If the ownership guard incorrectly suppresses legitimate pushes, redeploy the previous known-good *worker* and *sender* function source only after confirming consequences. Avoid rolling back on an apparent sender-mismatch error: it is not a database ownership bug and rollback does not fix FCM credentials. Never turn on mass daily reminders as a debugging tactic.
