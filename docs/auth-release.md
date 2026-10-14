# Android authentication and onboarding correction — 14 October 2026

The reported APK `c078a366-0671-4677-acda-85f0acdadd8d` is the QA build from
`abd3f91b732d0fd2518f401bbb7a19e133c1ff10`, not the production release.

## Google callback

The public QA authorization endpoint reproduces Google's
`redirect_uri_mismatch`. QA and production use the same Google OAuth client,
but Google's sign-in page accepts production's branded callback and rejects
the QA project's callback. The correction belongs in that Web application
OAuth client's Authorized redirect URIs:

`https://jxgpvvehajxegeeozlnl.supabase.co/auth/v1/callback`

Keep the existing production callback entries. This Google Cloud correction is
pending operator confirmation; it does not require rebuilding the installed QA
APK. QA's separate Supabase return allowlist was also missing the native route.
`yrdlymobile://auth/callback` was added and read back, preserving existing entries.
Production already allows the native callback and was not changed by this repair.

Run `node qa-scripts/oauth-preflight.mjs qa` and then the same command with
`production`. The check follows Supabase's public authorization redirect and
asserts that Google accepts the backend callback. It never prints client IDs,
OAuth state or credentials. Passing this check does not prove a completed Google
account sign-in or a native session surviving an app restart.

## Unreadable inputs

Auth and onboarding screens use a permanently dark photo/glass background.
Some input and heading styles instead used the adaptive app theme's primary
text colour, which becomes dark in light mode. Email and phone OTP digits,
profile bio and neighbourhood search were affected. These screens now use the
onboarding palette's white primary text regardless of the main app preference.

The regression suite evaluates the actual screen styles with both real app
themes and asserts at least 4.5:1 contrast. Before the fix all nine light-mode
screen cases failed; after the fix all eighteen cases pass. Rebuilding and
reinstalling the APK is required for the colour changes. Physical-device
rendering and autofill remain to be confirmed by a tester.

## Android release build

Build `195dc115-73d2-46c3-87e5-bf084165083a` compiled the native video toolkit
but failed at `:app:mergeDexRelease` with `D8: Java heap space`.
`withAndroidBuildMemory` now configures a 4096 MB Gradle heap, 1024 MB metaspace,
two workers and nonparallel projects after expo-build-properties. Expo config
introspection confirms these values survive plugin evaluation. A successful
replacement EAS build is still required; configuration inspection is not an APK
compilation result. The user is handling the iOS binary.
