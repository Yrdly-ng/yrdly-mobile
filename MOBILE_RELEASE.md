# Coordinated release — October 2026

This branch depends on the matching web/server release in
https://github.com/Yrdly-ng/yrdly-app/pull/74 and its reviewed Supabase cutover.
It must reach installed clients before restrictive database permissions and
private media buckets are enabled in production.

## Changes

- Marketplace, event and booking payments use Payluk checkout tokens and server
  verification. Service receipt releases only the server-verified transaction.
- Bank linking and withdrawals use server authorization, authoritative balances
  and complete fee quotes. Unknown transfer outcomes require history/support
  review before another withdrawal; financial mutations are not automatically retried.
- Paid listings, tickets, catalog items and configured booking payments enforce
  the approved NGN 1,200 minimum. Free giveaways and tickets remain supported.
- Public profile queries avoid private user fields. Chat attachments and reports
  use private object references and authorized signing; conversations exist before upload.
- Publication, ticket check-in, actor notifications, booking flags and safety
  moderation use authorized server endpoints. Flagged events remain drafts.
- Unused Paystack/legacy financial clients are removed. Native build workflows
  use the Payluk public key and an encrypted Firebase configuration secret.

## Verification

- `pnpm typecheck`: pass.
- `pnpm lint`: zero errors; 856 existing warnings (recorded baseline: 877).
- `pnpm test:release`: 12 passing contract tests for payment transport/retry
  rules, SDK construction, minimum prices, private references, withdrawal
  quotes and booking verification/receipt.
- Android and iOS JavaScript exports passed locally with public placeholders and
  dotenv disabled. CI recompiles the final source for both platforms.
- The sibling web QA harness passed 44 real isolated-QA profile/API contracts.
- New helpers, tests and workflow formatting passed. Repository-wide formatting
  still fails on 142 existing files; this branch does not rewrite unrelated formatting.

JavaScript exports and contract tests do not verify installed device behavior.
Before production cutover, verify Android/iOS WebView payment/cancellation,
booking receipt, private image/video/report rendering, camera ticket scanning,
push delivery and Google consent on compatible installed clients. The app has
no configured Expo update channel/runtime, so a source merge alone does not
roll out these changes. Do not rerun completed QA payouts or fund retained
escrows while checking compatibility.
