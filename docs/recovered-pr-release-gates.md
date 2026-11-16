# Recovered mobile PR release gates — 16 November 2026

PRs #7 and #14 were reviewed against main. Current Sentry/PostHog initialization, privacy filtering, native replay and source-map uploads are retained; the older monitoring layer and dependency versions were not copied.

Recovered changes: legal links, native iOS Apple authentication with a hashed nonce sent to Apple and the raw nonce to Supabase, and first-client Firebase key validation. Android keeps its existing guarded browser OAuth flow. Firebase live preflight, generated config checks and signed APK resource/certificate checks remain active.

Before an iOS store submission:
- Confirm Sign in with Apple is enabled for the actual signed app and Supabase Apple Client IDs allow com.yrdly. Do not change production provider settings without checking the existing values.
- Build a signed iOS archive and test native Apple success, cancellation, returning-user sign-in, and profile completion on a device. JavaScript bundles and mocks do not verify Apple's entitlement or audience configuration.
- Reconcile App Store Connect privacy answers and PrivacyInfo.xcprivacy with actual shipped SDK collection and optional analytics/replay settings. The old PR's blanket declarations are not automatically authoritative. Do not copy required-reason declarations without mapping them to actual API usage.
- Verify APNs environment against the distribution provisioning profile. The current Android QA build is not evidence of iOS push delivery.

These are release gates, not completed device/store checks. Android APK #75's notification test remains pending tester feedback. No provider claim, bank withdrawal, mass notification, or store submission was initiated during this recovery.
