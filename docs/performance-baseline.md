# Mobile feed baseline investigation

Date: 2026-10-20
Source commit: `8f4f5fedaab0325189ee1ac263020430304187dc`
Scope: baseline investigation only; no application changes or deployment.

## Status

The user confirmed [the performance plan](performance-plan.md), then requested
skipping Android testing for now. No Android device or configured emulator was
available. Native feed timing, image transfer sizes, frame responsiveness,
and before/after performance comparisons have **not** been measured.

The findings below establish isolated behavior, not the cause or size of
production slowness. They do not justify a storage migration or new cache service.

## Executed checks

From the mobile app directory:

```sh
node --test tests/offline-cache.test.cjs tests/telemetry.test.cjs
node /private/tmp/yrdly-feed-baseline.cjs
```

The existing tests passed 19/19. Their host execution time is not app latency.
The temporary probe also exited successfully, asserting the current behavior
including two undesirable outcomes. Its success means reproduction succeeded,
not that the agreed product behavior is satisfied.

The probe transpiles and executes the actual cache and feed hook source with
mocked React, database, connectivity, and native boundaries. React effects are
not executed, and hook refresh is invoked directly. It does not establish
full-screen lifecycle behavior, rendering, native SQLite performance, or
production request timings. The script is a temporary local artifact, not yet
a committed regression harness.

## Observations

| Observation | Evidence and scope |
| --- | --- |
| Cache restoration expires after 15 minutes | Actual cache read accepts age 900,000ms and rejects 900,001ms. The expired row remains readable with an explicitly larger age limit; expiry is not physical deletion. |
| Owner and distinct-key isolation | Cache reads for another owner or a different location key return no record in the isolated probe. Existing tests cover account-switch generation guards. |
| Feed invalidation removes the namespace | A cached feed entry is unavailable after namespace invalidation. |
| Refresh replaces displayed content twice | Direct hook refresh displays cached first-page rows while its network boundary waits, then replaces those with fresh first-page rows. |
| Offline area change can retain old rows | After loading one area, refreshing an uncached area offline leaves the preceding rows in hook state. |
| Geographic cache keys can collide | The same ward name under two different states generates the same feed cache key. |
| Four query constructions in the fixture refresh | Posts, events, following, and followers. This is not a whole-screen request count or evidence that any query is slow. |

Source inspection also found cached rows being applied before fresh
blocked-user filtering. This needs a dedicated behavioral regression test;
the temporary probe did not exercise a blocked-user scenario.

`src/lib/telemetry/index.ts` disables automatic Sentry performance and user
interaction tracing. The inspected feed code does not provide the agreed
first-usable-content measurement. This does not establish that all production
telemetry is absent.

## Small proposed implementation plan

The user subsequently authorized items 1–3 through the implementation
workflow, including hook/cache regression tests and review against the source
commit above. The observations in this report describe that baseline commit.
Item 4 remains deferred; no deployment is authorized.

1. **Correct feed scope.** Use account plus complete geographic hierarchy;
   clear or replace visible rows when scope changes, reject late old-scope
   responses, and filter known blocked authors before cached rows are shown.
   Convert the two reproduced scope cases into failing regression tests.
2. **Separate initial display from background refresh.** Restore a matching
   valid snapshot on initial entry. Stage new posts during passive refresh;
   apply them on explicit refresh or "New posts." Preserve the reading anchor,
   and promptly remove confirmed deleted/inaccessible content. Test paginated
   reading, realtime inserts, concurrent refresh triggers, and account changes.
3. **Make freshness explicit.** Retain the 15-minute restoration boundary and
   30-second focus-refresh policy; show the last successful refresh time,
   stale/offline states, and retry behavior. Prune expired feed snapshots at
   maintenance opportunities without touching drafts or the message outbox.
4. **Measure before claiming a speed improvement.** Resume controlled native
   measurements when Android testing is available. Investigate actual media
   bytes and request timings before selecting image, query, or cache changes.

No SWR-wide migration, Redis, R2, provider change, or release is proposed for
these correctness fixes. Keep changes localized so each can be reverted
independently; do not alter the encrypted-cache or account-purge guarantees.

## Deferred native measurement protocol

Proposed reproducible profile, not a measured baseline:

- Record Android device model, OS, app commit/build mode, and thermal state.
  Use a release build and controlled test accounts/content.
- Use a fixed constrained link, initially 1.6 Mbps downstream, 750 Kbps
  upstream, and 150ms added round-trip latency. Record the actual shaping tool
  and verify the applied profile. This is a repeatable laboratory condition,
  not a claim to represent every Nigerian mobile network.
- Separate empty feed/media cache, valid cached opening, and return navigation.
  Preserve the test login; never clear a real user's drafts or outbox.
- Record process launch separately from feed-entry timing. End the usable-feed
  interval when the first visible post's author/text/avatar and first image
  are rendered and controls respond. Record text-only posts separately.
- Record image failure as a degraded outcome, not a fast successful load.
  Keep no-content/error outcomes separate from usable-feed timings.
- Repeat each condition on fixed content, report median and tail measurements
  with sample counts, and record request count, bytes, and cache hit/miss.
  Do not infer a reliable p95 from a handful of runs.
- Reuse the same conditions after changes. Set numerical acceptance targets
  only after obtaining the baseline; correctness requirements above already
  have deterministic acceptance criteria.

Do not collect content, credentials, precise locations, or raw account IDs
in performance artifacts. Native measurement and iOS regression coverage
remain pending; no deployment is authorized by this report.

## Implementation follow-up

Items 1–3 were implemented after the user approved the hook/cache test seams.
The feed now isolates complete account/location scopes, filters blocked authors,
stages passive refreshes, verifies retained content access, and exposes refresh
time, offline/retry state, and a “New posts” action. Feed-only maintenance prunes
expired snapshots without changing drafts, outbox, or encryption guarantees.

Validation: the full host suite passed 214/214 before final targeted corrections.
Subsequent feed/cache checks passed 26/26; the final feed run passed 21/21,
including two additional review regressions. Repository lint passed; changed-file
lint reported no errors and 50 warnings. Tests execute real React effects with
mocked network/native boundaries; they do not establish device performance.
Final TypeScript checking exited successfully after the review fixes.

Standards review found no actionable issues. Spec review identified late explicit
refresh intent and failed friendship lookup handling; both received regression
tests and fixes. Failed friendship checks preserve visible content and freshness
timestamps while exposing retry feedback.
