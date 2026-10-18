# Publish safe community content after trusted moderation

All community submissions currently enter a review queue, while mobile also attempts to choose moderation status independently. The agreed product behaviour is to publish safe posts and replies after trusted server moderation, holding suspicious content and failed checks for review and showing the author the submission's status.

This trades the simplicity and publication delay of blanket manual review for a trusted moderation workflow that both clients share. Client-supplied moderation status must not authorize publication, and a failed moderation check must not publish content automatically.

Owners, admins, and moderators review their community's pending content and reports under YRDLY staff oversight. Automated failures receive bounded retries before manual review. Edits are reviewed as separate revisions so the existing published version remains visible until its replacement is approved; this adds revision state rather than making approved content disappear whenever its author edits it.

## Implementation and release, 2026-10-18

The migration `20261018143334_complete_community_lifecycle.sql` is shared by mobile and web. Atomic commands enforce admission, role hierarchy, ownership acceptance, bans, content revisions, and actual stored attachment limits. Existing public attachments may be retained only when editing the author's existing post. New media uses the private `community-media` bucket; clients refresh its signed URLs before expiry and on foreground return.

`process-community-jobs` publishes safe text/images through service-only review commands. Videos, flagged content, and exhausted failures remain pending for manual review. Jobs retry at most three times. Activity notifications remain in history when community mute suppresses device alerts. The existing push delivery worker also rechecks membership and mute before retries.

Verification: `pnpm test:release` passed all 73 tests, including isolated PostgreSQL permission/lifecycle cases, existing content-trigger compatibility, worker moderation/mute behavior, and routing. These tests do not verify production credentials, provider delivery, or a physical device. Fresh TypeScript checks and iOS exports were skipped at the user's request. No APK/IPA build was triggered.

Release remains separate: apply the migration once to the shared Supabase project, deploy `process-community-jobs` plus the updated push sender/outbox worker from web, and deploy the web changes. Confirm the periodic job uses the existing Vault `project_url` and `service_role_key` credentials and that text/image moderation credentials are available. Exercise admission, invitation, moderation, and notification taps with real test accounts before distribution. Mobile changes require a later user-authorized app release.

The command payload interface still accepts a general record; the database remains the authority for validation. A discriminated TypeScript payload map is an optional follow-up to improve compile-time feedback.


### Compatibility and production rollout

Installed versions use direct table writes. Invoker triggers adapt their membership, request, and moderation actions to the checked command implementation. Existing clients can still join, mute, leave, submit text, and review requests. Direct content insertion always creates a trusted pending review; only legacy inserts enqueue through the compatibility trigger, avoiding duplicate jobs for command callers. Legacy clients must update before attaching community media. Focused verification after this addition: all 19 communities tests passed.

Production history contains previously applied migrations absent from these checkouts. Deploy using an isolated folder populated by `supabase migration fetch --linked`, then add the new migration and confirm the dry run includes only that migration. Do not revert existing history or replay unrelated schema changes.
