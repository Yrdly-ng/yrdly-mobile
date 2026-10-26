# Store release procedure

Use the EAS `production` profile for store artifacts. It explicitly selects store distribution, the production environment, an Android App Bundle and a physical-device iOS archive. The `apk` profile remains for Android installation/testing and overrides the bundle format. The existing GitHub native workflows produce an APK and an unsigned IPA; neither is the store submission path.

## Prepare the candidate

Run from `yrdly-mobile`:

```sh
pnpm typecheck
pnpm lint
pnpm test:release
pnpm test:telemetry
pnpm test:maps
pnpm test:directions
```

Record the exact commit and keep the working tree clean before building. Confirm the EAS production environment points to the production API/auth projects and supplies payment, maps and telemetry settings. Never put signing keys, service-role credentials or Apple private keys in public Expo variables.

Before the production build, release the matching web API and review/apply the pending child-safety migrations through the product repository's production-history procedure: `20261026170603_enforce_account_suspension_in_active_sessions.sql`, `20261026170833_add_audited_account_moderation_actions.sql`, and `20261026180520_enable_reported_child_safety_post_takedowns.sql`. **Current blocker:** the linked production migration history diverges in both directions; a dry run reports 22 remote versions with no local SQL and local versions absent remotely. `supabase migration fetch` produced placeholders rather than their SQL. Do not run migration repair or deploy the API until original scripts and the production schema/history are reconciled and reviewed. Then verify the deployed mobile admin endpoints against isolated test accounts. These changes are not present in production until that release is complete. Launch tickets are for physical, in-person admission and use the existing Payluk flow; do not treat physical event tickets as digital access purchases.

## Build (does not submit)

```sh
eas build --platform android --profile production
eas build --platform ios --profile production
```

Use the established Android upload key for `com.yrdly`; do not generate a replacement for an existing Play app without a planned key reset. iOS requires valid Apple distribution credentials and a provisioning profile for `com.yrdly`. Resolve interactive credential prompts with the account owner. An unsigned IPA cannot be uploaded as the release artifact.

Builds can consume EAS quota. These commands are documented here, not automatically triggered by tests or by this change. Do not use `--auto-submit` during readiness checks.

## Verify the actual artifacts

- Confirm the Android download is `.aab`, targets API 36 or later, uses the expected signing identity, and passes Play Console's 16 KB compatibility checks. Exercise it through an internal testing track.
- Confirm the iOS archive is signed for App Store distribution and built with iOS 26 SDK or later; validate/upload using the account's approved process and test through TestFlight.
- Run fresh-install login (including Apple), callback/restart, legal acceptance, reporting/blocking, deletion-request, location, media, ticket and payment-cancellation tests. Verify permissions denied and offline/error cases.
- Verify session replay masking on real native surfaces; automated tests do not prove it.
- Capture screenshots from the candidate on iPhone, iPad (supported), and Android. Existing reconstructed marketing packs are not release screenshots.

## Before submission

Complete store privacy disclosures, content/age ratings, support/privacy/deletion URLs and reviewer credentials. Deploy the reviewed privacy-policy and child-safety pages before the listing references them. Approve child-safety standards, assign the required Google contact, and verify manual account-erasure operations. Launch tickets are confirmed as in-person admission and can continue through Payluk; reassess billing if digital event access is added. These operational decisions are not completed by a successful build.

## Deletion operations acceptance check

Use an isolated development account, never a real customer's account for validation. Record its request receipt time and confirm the request stays visible until actual erasure. The removed admin shortcut must not be replaced by manually clearing `delete_requested`.

An authorized operator must determine which financial/legal records must remain, revoke sessions and applicable Apple tokens, remove the account's non-retained data and uploaded media using the reviewed backend procedure, and verify removal from auth, profiles, content and storage. Deleting only the authentication row does not establish that all associated data is gone. Confirm the deleted account can no longer authenticate or access private data and send a completion notice through the approved support process. Keep a minimal access-controlled audit record of completion and any justified retention. Do not run an improvised cascading production deletion script.

The current changes improve request reliability and prevent false completion; they do not implement or certify this erasure procedure. Successful end-to-end execution and an assigned operator are still required before submission.

References: [EAS configuration](https://docs.expo.dev/eas/json/), [Android build process](https://docs.expo.dev/build-reference/android-builds/), [iOS build process](https://docs.expo.dev/build-reference/ios-builds/).
