import { ApiError } from '@/lib/network/api-client';

export type PublishingStage = 'preparing' | 'uploading' | 'publishing' | 'checking' | 'complete';

export class PublishingOutcomeUncertainError extends Error {
  constructor() {
    super("We couldn't confirm whether your post was published. Retry safely to check again.");
    this.name = 'PublishingOutcomeUncertainError';
  }
}

export function getPublishingErrorMessage(error: unknown, stage: PublishingStage): string {
  if (error instanceof PublishingOutcomeUncertainError) return error.message;
  if (error instanceof ApiError && error.status === 401) {
    return 'Your session has expired. Please sign in again to continue.';
  }
  if (error instanceof ApiError && error.status >= 500) {
    return 'YRDLY is having trouble connecting right now. Please try again shortly.';
  }
  if (error instanceof ApiError && error.status === 403) {
    return "You don't have permission to publish this post.";
  }
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return 'Some post details could not be saved. Please review them and try again.';
  }
  if (stage === 'uploading') {
    return 'Your upload was interrupted. Your draft is saved, so you can retry.';
  }
  if (
    error instanceof TypeError ||
    (error instanceof Error && /network|fetch failed|connection lost/i.test(error.message))
  ) {
    return 'Connection lost. Check your internet and try again.';
  }
  return "We couldn't publish your post. Your draft is saved; please try again.";
}

export function logPublishingFailure(error: unknown, stage: PublishingStage, startedAt: number) {
  if (!__DEV__) return;
  const status = error instanceof ApiError ? error.status : undefined;
  const category =
    error instanceof PublishingOutcomeUncertainError
      ? 'outcome-uncertain'
      : status === 401
        ? 'authentication'
        : status && status >= 500
          ? 'server'
          : stage === 'uploading'
            ? 'upload'
            : error instanceof TypeError
              ? 'network'
              : 'unknown';
  console.warn('[PostPublishing] operation failed', {
    stage,
    category,
    status,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    elapsedMs: Date.now() - startedAt,
  });
}
