# Encrypt account-scoped cached data and pending messages

Yrdly uses Expo SQLite with SQLCipher for structured public metadata, the current account's profile and drafts, and its pending-message outbox. The encryption key stays in SecureStore; account changes and logout purge cached records, and account generations prevent late responses from repopulating another user's cache. Existing credential storage and media file caches remain separate.

Persistent private drafts and messages require the rebuilt native binary; Expo Go and binaries without SQLCipher use memory only. Failed or restored outgoing messages require an explicit retry rather than automatically submitting a sensitive write after reconnecting. Public listings are cached for limited offline reading, while permissions, moderation, availability and prices remain backend decisions.
