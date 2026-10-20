# Performance planning interview

Status: All five interview rounds and the consolidated shared understanding
confirmed on 2026-10-20. Baseline investigation started. The user subsequently
requested skipping Android testing for now; native performance measurements
and numerical acceptance targets remain pending.
The user subsequently invoked the implementation workflow and approved the
hook/cache test seams and review baseline. Implementation of baseline items
1–3 is authorized; deployment and native performance claims remain outside
this phase.

## Agreed direction

- Prioritize measurable improvements to the current user experience.
  R2, Redis, and tRPC remain options, not migration commitments.
- Improve opening the mobile feed and seeing usable content, including
  avatars and photos, first. Returning to previously visited screens follows.
- Recently cached public content may appear immediately while refreshing.
  Cached payment status, permissions, prices, and availability must not be
  treated as authoritative for consequential actions.
- Account changes must never expose another account's cached data.
- A usable feed has the first visible post's author, text, and correctly
  sized image displayed, with responsive scrolling and controls. A skeleton
  alone does not count; video downloads need not finish. Exact timing
  boundaries and treatment of image failures remain to be specified.
- Benchmark primarily on a mid-range Android phone with constrained mobile
  data, measuring empty-cache and returning-user journeys separately.
  Include iOS regression checks. Set numerical targets after the baseline.
- Preserve reading position when refreshing. Offer a "New posts" action
  instead of automatically inserting new items into the current reading
  position. Promptly remove content confirmed deleted or inaccessible.
- Image failures must leave the feed readable and interactive, with a stable
  placeholder and retry action. Track this as degraded content, not a
  successful fully loaded feed.
- Limited offline reading of previously public content is acceptable with
  a saved-content label and an expiry policy. Changes to visibility cannot
  be discovered offline; reconcile them when connectivity returns.
  Private/community content is excluded from this initial offline policy.
- Start with a mobile-feed pilot: baseline, targeted fixes, and before/after
  results. Set numerical targets after measurement and require evidence
  before expanding to other screens or infrastructure.
- Keep the existing offline scope: the first page of approved public,
  non-event posts, with a maximum restoration age of 15 minutes. Show the
  last successful refresh time. Never restore expired snapshots; already
  visible content may remain with a stale notice until leaving or refreshing.
- Switching account or geographic scope must not retain the old scope's
  visible feed. Match cached content to the account and complete location
  hierarchy, apply known blocks before rendering, and reject late responses
  from previous scopes. When offline without a matching snapshot, explain
  that the selected area requires a connection.
- Measure timings, request counts, transferred bytes, and cache outcomes
  using controlled test accounts first. Exclude post text, messages, precise
  location, and raw user identifiers from pilot measurements. Do not add a
  new analytics service.
- Pull-to-refresh and tapping "New posts" apply the latest feed and may
  reorder it. Automatic background refresh preserves reading position.
  Confirmed deletions and access restrictions still apply promptly.
- Retain the 30-second freshness threshold on return navigation. Refresh
  stale content on reconnect, avoid periodic polling, and prevent overlapping
  requests for the same account and geographic scope. Automatic refresh
  stages new content; explicit refresh applies it.
- Remove expired feed snapshots during the next cache-maintenance
  opportunity, such as opening or refreshing the feed. This cleanup excludes
  drafts and pending messages; account/logout cleanup remains separate.
- After shared-understanding confirmation, perform baseline measurement
  only. Present measured bottlenecks, proposed numerical targets, and a small
  implementation plan before changing feed behavior, adding infrastructure,
  or releasing the pilot.
- Use the same device, network profile, and test content for before/after
  comparisons.

These constraints align with
[the existing cache decision](adr/0001-encrypt-account-scoped-cache-and-outbox.md).
No new infrastructure decision or domain term has been settled.

## Next phase and its deliverables

The planning frontier is settled for the baseline phase:

1. Record the available representative Android device and reproducible
   constrained-network profile. Separate empty-cache opening, cached opening,
   and return-navigation measurements.
2. Specify timing boundaries and measure first usable content, image failures,
   responsiveness, request counts, transferred bytes, and cache outcomes.
3. Report code/runtime evidence for the largest bottlenecks and validate the
   identified location, blocking, refresh, and invalidation behavior.
4. Propose numerical acceptance targets and the smallest implementation
   scope supported by the baseline. Identify iOS regression coverage,
   rollout, and rollback requirements for that scope.

Device/profile values, numerical targets, and implementation-specific
rollout details are intentionally deferred to evidence gathering. No new
service, broad cache rewrite, or production rollout is approved by this plan.

## Evidence still being gathered

See [the baseline investigation](performance-baseline.md) for executed probes,
their limits, and the proposed implementation sequence. Android testing was
skipped at the user's request; native performance measurements remain pending.

The baseline investigation is recorded below. Targeted implementation of the
identified correctness issues is now underway. Findings from the architecture
audit remain hypotheses unless supported by code or measurements.

Source inspection found a 30-second focus-refresh threshold and scroll-offset
restoration in `src/app/(tabs)/index.tsx`. This is not an offline retention policy.

Inspection at the baseline commit of `src/hooks/posts/use-posts.tsx` and
`src/lib/offline/local-cache.ts` established:

- The default cache restoration age limit is 15 minutes; expiry does not
  physically delete rows or continuously expire already-visible content.
- Only the first fetched page of approved, explicitly public, non-event
  posts is persisted.
- Account owner/generation guards exist in the cache implementation; caller
  integration has not yet been verified.
- Feed keys use the deepest location value rather than the complete
  geographic hierarchy. Existing visible rows are not immediately cleared
  when switching to an uncached area offline.
- Cached rows are displayed before fresh blocked-user filtering.
- Cached and network refreshes replace the current first page, while
  realtime inserts prepend immediately. This conflicts with the accepted
  preserve-reading behavior.
- Realtime and optimistic changes invalidate the entire feed namespace.

These are source findings, not runtime verification. The pilot must cover
location scoping, blocking, refresh stability, and invalidation alongside speed.
