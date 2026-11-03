# Mobile reports and moderation — 3 November 2026

User authorized improving moderation across mobile/web and giving mobile admins complete case controls.

Implemented in mobile launch worktree:
- Existing admin child-safety route now hosts Reports & safety with general, post and comment queues, child-safety filter, status filters, pagination, retry and empty states.
- Case detail shows reported account name/profile link/restrictions, reporter name, safe content text/visibility, explanation, timestamps and persisted action history. UUID references collapsed.
- Required decision reason and confirmation for resolve/dismiss/reopen, hide/restore content, suspend/ban/restore account. All actions use the central case-scoped API with observed status to guard stale decisions. Actions refresh authoritative detail. No automatic sensitive-media display. Normal attachments are revealed only after an explicit tap, with existing private-media parsing and 5-minute signed URLs. Sensitive child-safety attachments are never requested.
- Admin layout accepts role=admin or is_admin; backend remains authoritative.
- Existing automated content queue retained and links to Reports & safety.
- General report form points order problems to Disputes; removed unsupported 24h review guarantee from payment dispute form.

Backend dependency: new /api/admin/reports list and /{kind}/{id} detail/action endpoints and additive moderation migration owned by product backend specialist. Do not release mobile feature before matching backend migration/API is available. No deployment, build or schema application performed by mobile specialist.

Checks: four focused tests pass (including actual screen reason/confirmation/history lifecycle); 15 combined moderation/store-safety tests pass; manager full-release suite passed 332 checks before the final attachment addition. Three authenticated API-adapter checks cover (all 8 actions × 3 kinds, observed state/reason, filtering, human labels); added to existing release suite. Final TypeScript passed. Scoped lint zero errors, existing warnings plus loading-state effect warning. Manager checked actual RN-web component at 390px and 1024px with fixture API: no JS errors or horizontal overflow; names, context and action history visible. Native VoiceOver/TalkBack checks not performed here.
