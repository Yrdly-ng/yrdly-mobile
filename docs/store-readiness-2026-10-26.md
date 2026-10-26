# Store submission readiness — 26 October 2026

**Decision: not ready to submit to either store.** This is a source, configuration, automated-check, public-policy-page and EAS-history review, not an installed-device acceptance test or an inspection of App Store Connect / Play Console.

Scope: `yrdly-mobile`, relevant account-deletion implementation in `yrdly-app`, and public legal pages in `yrdly`. No application code, deployments, accounts, or submissions were changed. The mobile checkout changed externally during the audit; final observed HEAD was `13274a93076fb10b44acfb6ca38809feb228a941`. Checks ran during that review window, not against an immutable final release artifact.

## Follow-up implementation and deployment

The findings below record the original audit. Subsequent authorized work implemented:

- A shared native Apple/Google OAuth browser/session-completion flow with callback validation, cancellation and error handling; callback-screen recovery navigation.
- Terms and privacy links on login/signup and privacy settings; a versioned account-scoped terms/community-rules acknowledgement before content interaction, including existing/social accounts. Support, reporting and deletion remain available without acceptance. This acknowledgement is not advertising or optional-analytics consent and is not a backend authorization claim.
- Chat/profile report routing with account/conversation context; report persistence errors retain the form instead of claiming success. Post/marketplace reporting also checks insertion errors. Outgoing blocked-chat retries stop before delivery.
- Removal of the admin action that cleared deletion requests without erasure; accurate request/retention copy and a saved-row check before confirming receipt. Actual erasure remains an operational release gate.
- Website privacy disclosure updates for PostHog, Sentry replay and Crisp, plus corrected deletion navigation. Website build and lint pass (24 existing lint warnings); local desktop/phone checks found the disclosures and no horizontal overflow.
- Explicit EAS production store distribution, Android AAB and physical-device iOS configuration, with instructions in `docs/store-release.md`.
- Child-safety follow-up adds the 18+ declaration, text-only reporting, public standards and a mobile admin inbox with confirmed post-hide and suspend/ban actions for linked reported targets. The actions use authenticated admin APIs, verify the target against an open child-safety report, and write audit records. The post is hidden from other viewers, but underlying media deletion/access has not been demonstrated. The shared session gate checks suspension status. The three Supabase migrations are installed in production; the matching API release has been pushed to main. Broader content/media removal coverage also remains open.
- YRDLY named Victor Salami (lead), Opiah David (backup), and Boluwatife Lasisi (additional escalation contact); role acceptance, console entry, queue/mailbox coverage and legal reporting/retention procedures still need human confirmation.

The expanded release suite passed 286 tests after the latest moderation changes. Mobile typecheck and focused lint passed; focused lint reported 16 existing warnings in `PostCard.tsx` and no errors. The product app typecheck, focused lint, and production build passed. An isolated PGlite test applied all three pending moderation migrations and verified session suspension checks, audited account actions, and reported-post hiding. Telemetry (20), maps (23), and directions (7) suites passed. The public-site production build passed and lint completed with zero errors and 24 warnings. The child-safety and privacy pages now return HTTP 200 in production. The three moderation migrations are installed in production with exact SQL recorded in migration history. A rollback rehearsal, independent rollback verification, post-commit schema/grant checks, and production security advisor check passed. No actions were taken on customer accounts or content. Signed store builds have been requested from EAS for mobile source `8e581e2`; completion and credentials remain subject to EAS results. No store submission was performed. Full authenticated moderation acceptance on installed devices remains outstanding.

**Production migration blocker resolved:** `../yrdly-app/docs/production-release.md` documents selected production deployments, explaining the older timestamp differences. The reviewed session gate and required columns were verified in production. Only migrations `20261026170603`, `20261026170833`, and `20261026180520` were executed and recorded atomically, after a successful rollback rehearsal. Older history was preserved. The new gate preserves onboarding before profile creation while rejecting suspended/banned profiles; post hiding rejects missing report status/category. Regression coverage passed. Product API main includes the matching routes and the evidence is in `../yrdly-app/docs/child-safety-release-2026-10-26.md`. Do not blanket-push the migration folder or repair older versions based on timestamp differences.

Native-device QA, real release screenshots, provider/signing credentials, child-safety operations, and store-console declarations remain outstanding. YRDLY confirms launch tickets are for in-person event admission; Payluk remains appropriate for that scope. Reassess if digital event access is introduced.

## Original audit findings (status updated above)

1. **Apple sign-in is incomplete on native.** `src/lib/auth/auth-service.ts:221` calls OAuth and returns its URL without the native browser/session-completion flow used by Google sign-in. Complete and test Apple login, callback, session persistence and logout on iPhone. Apple guideline 4.8 requires a qualifying equivalent option when social login is offered, unless an exception applies.
2. **Chat reporting falsely confirms success.** `src/app/chat/[id].tsx:1602` only displays an alert. Persist the report, deliver it to moderation, and show success only after submission succeeds. Verify blocking prevents subsequent unwanted interactions, not merely hiding the conversation. Other report flows do not make this broken action acceptable.
3. **No accessible in-app Privacy Policy / Terms links or pre-UGC terms acceptance were found.** `src/app/settings/privacy.tsx` contains privacy toggles, not a policy link. Add accessible links and acceptance before content creation, including social-signup paths. Public pages are live at `/privacy-policy` and `/terms` on `yrdly.ng` (HTTP 200 checked).
4. **Privacy disclosures need reconciliation.** The live policy names Crashlytics, while current mobile telemetry uses Sentry (including session replay), PostHog, and Crisp support. Review actual collected/shared data, purpose, retention and consent; update the policy and both stores' privacy declarations consistently. See `docs/mobile-telemetry.md`, `src/lib/telemetry/index.ts`, `src/components/CrispChat.tsx`, and `../yrdly/app/privacy-policy/page.tsx:79`. Do not infer that ATT is required solely from analytics use.
5. **Published child-safety standards are missing from the inspected public pages.** Terms, privacy and trust-and-safety pages were fetched successfully; none supplied explicit CSAE standards. For a Social-category launch, publish app-named standards and document reporting/escalation operations; designate the required child-safety contact in Play Console. Align intended ages, signup behavior and store questionnaires.
6. **Screenshot packs are drafts.** Both `output/Google playstore builds/manifest.json` and `output/apple appstore builds/manifest.json` explicitly identify reconstructed UI requiring native captures before submission. Replace them with accurate screenshots of the release app; include the applicable iPad assets because tablet support is enabled.

## Release gates still requiring evidence

- **Signed release artifacts:** EAS returned no iOS builds and no Android `production`-profile builds. Latest observed Android build was an internal preview from 19 October; older store-distribution builds used the APK profile. GitHub iOS workflow produces an unsigned IPA; Android workflow uses `assembleRelease` (APK). Produce/locate a signed App Store archive and a signed Google Play AAB from the agreed release commit. Builds outside EAS were not inspected.
- **Platform validation:** EAS iOS configuration selects Xcode 26.2 and the installed React Native toolchain targets Android API 36, consistent with current minimum submission requirements. Verify actual final artifacts, signing, production configuration, iOS privacy manifests and Android 16 KB native-library compatibility. Configuration alone is not binary proof.
- **Account deletion:** In-app requests exist, and the public policy provides an email deletion path and 30-day timeframe. However, `src/app/(admin)/requests.tsx:179` only clears the request flag and reminds the operator to delete data manually. Manual deletion is permitted by Apple; missing automation alone is not a violation. Demonstrate a completed test-account deletion including associated content/media, applicable retained-record disclosure, completion notice and Apple token revocation where relevant. Do not mark requests resolved before erasure is confirmed.
- **Event ticket billing:** YRDLY confirms that launch tickets are for admission to in-person events. Payluk is the appropriate external payment path for physical live-event admission under current store rules. Do not use that checkout to sell access to a livestream or other digital service; reassess billing before offering any such product.
- **Installed-device QA:** Verify fresh install, email/phone/Google/Apple login, session restoration, permission denial, maps/location, uploads/video, reports/blocking, payment success/cancellation, ticket check-in, push delivery, private media, deletion and replay masking on Android and iPhone. Test iPad if supported. No device-run sign-off was produced by this audit.
- **Store consoles:** Verify developer enrollment and agreements, app identifiers/signing, privacy labels/Data safety, content and age ratings, child-safety declaration, reviewer credentials with reliable access, support/deletion URLs, listing assets and review notes. These console records were not inspected. New personal Google Play accounts created after 13 November 2023 require at least 12 continuously opted-in closed testers for 14 days and production-access approval; applicability to this account is unknown.

## Checks completed

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Release tests | 286 passed |
| Telemetry tests | 20 passed |
| Maps tests | 23 passed |
| Directions tests | 7 passed |
| Focused mobile lint | 0 errors; 16 existing `PostCard.tsx` warnings |
| Product app build/typecheck/focused lint | Passed |
| Public website build/lint | Build passed; lint 0 errors, 24 warnings |
| Moderation migrations | Installed and recorded in production; PGlite regression and live access checks passed |
| Production migration history | Documented selected-deployment procedure used; older history preserved |
| Formatting | Earlier audit: 20 files failed; not rerun |
| Public privacy, terms, trust-and-safety, child-safety URLs | HTTP 200 |
| EAS build history | Read-only inspection completed |

The 317 passing tests do not establish native runtime stability or store compliance. Formatting and lint warnings are maintenance issues, not automatic store rejection reasons.

## Recommended order

1. Fix Apple login, report submission, legal links/acceptance and disclosure gaps.
2. Demonstrate account deletion operations and confirm the launch ticket scope remains in-person admission.
3. Build signed release artifacts and complete installed-device QA.
4. Capture real screenshots, complete console declarations and reviewer access, then submit.

## Official references checked

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — login 4.8, UGC 1.2, privacy 5.1.1, payments 3.1.3 and screenshots 2.3.
- [Apple account deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) — manual processing is permitted with timing and confirmation.
- [Apple SDK requirements](https://developer.apple.com/news/?id=ueeok6yw) — iOS 26 SDK since 28 April 2026.
- [Google UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937) — terms acceptance, reporting and blocking.
- [Google child-safety standards](https://support.google.com/googleplay/android-developer/answer/14747720) — published standards and console contact.
- [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111) — in-app and external request paths.
- [Google payments guidance](https://support.google.com/googleplay/android-developer/answer/10281818) — digital purchases and exceptions.
- [Google target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878) — API 36 since 31 August 2026.
- [Android 16 KB requirement](https://android-developers.googleblog.com/2025/07/transition-to-16-kb-page-sizes-android-apps-games-android-studio.html) — verify native release compatibility.
- [Google personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465).
