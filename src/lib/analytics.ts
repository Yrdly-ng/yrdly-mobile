import type { PostHog } from 'posthog-react-native';
import type { AuthUser } from './auth-service';

// ---------------------------------------------------------------------------
// Typed event names — single source of truth for all PostHog event strings
// ---------------------------------------------------------------------------
export type AnalyticsEvent =
  // User lifecycle
  | 'user_identified'
  // Profile tab
  | 'profile_tab_switched'
  | 'profile_edit_started'
  // Post creation funnels
  | 'post_creation_started'
  | 'post_media_attached'
  | 'post_created_success'
  | 'post_deleted'
  // Social interactions
  | 'post_liked'
  | 'post_unliked'
  | 'post_bookmarked'
  | 'post_unbookmarked'
  | 'post_shared'
  | 'post_commented'
  | 'user_followed'
  | 'user_unfollowed'
  // Search & discovery
  | 'search_performed'
  | 'search_filter_applied'
  | 'search_no_results'
  // Errors (existing pattern in error-logger.ts)
  | 'app_error';

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Capture a typed PostHog event. Silently no-ops when posthog is not available
 * (e.g. missing API key in dev / test).
 */
export function trackEvent(
  posthog: PostHog | null | undefined,
  event: AnalyticsEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties?: Record<string, any>
): void {
  if (!posthog || typeof posthog.capture !== 'function') return;
  try {
    posthog.capture(event, properties);
  } catch (e) {
    console.warn('[Analytics] Failed to capture event:', event, e);
  }
}

// ---------------------------------------------------------------------------
// User lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Identify the user with enriched traits derived from their AuthUser profile.
 * Call this when a session is established / profile is freshly loaded.
 */
export function identifyUser(
  posthog: PostHog | null | undefined,
  user: { id: string; email?: string },
  profile: AuthUser | null
): void {
  if (!posthog || typeof posthog.identify !== 'function') return;
  try {
    posthog.identify(user.id, {
      email: user.email ?? null,
      username: profile?.username ?? null,
      name: profile?.name ?? null,
      role: profile?.role ?? 'user',
      onboarding_status: profile?.onboarding_status ?? null,
      profile_completed: profile?.profile_completed ?? false,
      created_at: profile?.created_at ?? null,
      home_state: profile?.home_state ?? null,
    });
  } catch (e) {
    console.warn('[Analytics] Failed to identify user:', e);
  }
}

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

/** Track when the user switches between profile tabs (Posts / Texts / Saved). */
export function trackProfileTabSwitch(
  posthog: PostHog | null | undefined,
  tab: 'posts' | 'texts' | 'saved'
): void {
  trackEvent(posthog, 'profile_tab_switched', { tab });
}

/** Track when the user opens the profile edit screen. */
export function trackProfileEditStarted(posthog: PostHog | null | undefined): void {
  trackEvent(posthog, 'profile_edit_started');
}

// ---------------------------------------------------------------------------
// Post creation funnel helpers
// ---------------------------------------------------------------------------

export type PostCreationType = 'sale' | 'event' | 'post';

/** Called when user first opens a creation form. */
export function trackPostCreationStarted(
  posthog: PostHog | null | undefined,
  postType: PostCreationType
): void {
  trackEvent(posthog, 'post_creation_started', { post_type: postType });
}

/** Called after user attaches at least one media asset to their draft. */
export function trackPostMediaAttached(
  posthog: PostHog | null | undefined,
  postType: PostCreationType,
  mediaCount: number
): void {
  trackEvent(posthog, 'post_media_attached', { post_type: postType, media_count: mediaCount });
}

/** Called on successful DB insert / publish. */
export function trackPostCreatedSuccess(
  posthog: PostHog | null | undefined,
  postType: PostCreationType,
  postId?: string
): void {
  trackEvent(posthog, 'post_created_success', { post_type: postType, post_id: postId ?? null });
}

// ---------------------------------------------------------------------------
// Social interaction helpers
// ---------------------------------------------------------------------------

export function trackPostLike(
  posthog: PostHog | null | undefined,
  postId: string,
  liked: boolean
): void {
  trackEvent(posthog, liked ? 'post_liked' : 'post_unliked', { post_id: postId });
}

export function trackPostBookmark(
  posthog: PostHog | null | undefined,
  postId: string,
  bookmarked: boolean
): void {
  trackEvent(posthog, bookmarked ? 'post_bookmarked' : 'post_unbookmarked', { post_id: postId });
}

export function trackPostShared(posthog: PostHog | null | undefined, postId: string): void {
  trackEvent(posthog, 'post_shared', { post_id: postId });
}

export function trackPostCommented(posthog: PostHog | null | undefined, postId: string): void {
  trackEvent(posthog, 'post_commented', { post_id: postId });
}

export function trackUserFollow(
  posthog: PostHog | null | undefined,
  targetUserId: string,
  followed: boolean
): void {
  trackEvent(posthog, followed ? 'user_followed' : 'user_unfollowed', {
    target_user_id: targetUserId,
  });
}

// ---------------------------------------------------------------------------
// Search & discovery helpers
// ---------------------------------------------------------------------------

export function trackSearch(
  posthog: PostHog | null | undefined,
  query: string,
  resultCount: number
): void {
  if (resultCount === 0) {
    trackEvent(posthog, 'search_no_results', { query });
  } else {
    trackEvent(posthog, 'search_performed', { query, result_count: resultCount });
  }
}

export function trackSearchFilter(
  posthog: PostHog | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: Record<string, any>
): void {
  trackEvent(posthog, 'search_filter_applied', filters);
}
