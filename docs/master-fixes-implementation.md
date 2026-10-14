# Master fixes implementation — 14 October 2026

The coordinated web/backend implementation and the twelve issue-by-issue notes are in [the product repository's implementation report](https://github.com/Yrdly-ng/yrdly-app/blob/main/docs/master-fixes-implementation.md).

This mobile release includes natural media layouts and preserved post navigation/state, business image fallbacks, legible marketplace/event overlays, inline approved communities, encrypted account-scoped SQLite caches/drafts/outbox, session-revocation handling, optimistic idempotent messages with recipient receipts, bounded binary uploads, and simplified image/video crop-and-trim controls. The earlier focused release also moved the Crisp launcher above the app content.

A new native binary is required for the SQLCipher plugin; these changes must not be delivered to older binaries through an OTA update. The owner handles the IPA and all manual interaction testing. Expo Go cannot persist the encrypted cache and uses memory instead. iOS Universal Links require the signing team's public Team ID in the web deployment's `APPLE_TEAM_ID`; the Android association uses the EAS certificate, with Play signing certificates added separately when applicable. Map credentials and financial records were not changed.
