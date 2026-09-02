import { ErrorMessageFormatter } from './error-messages';

export interface LogErrorOptions {
  context?: string;
  posthog?: any;
  extraProps?: Record<string, any>;
  customMessage?: string;
}

/**
 * Logs an error to PostHog and returns a user-friendly error message for display.
 */
export function logError(
  error: any,
  options: LogErrorOptions = {}
): string {
  const { context = 'general_error', posthog, extraProps = {}, customMessage } = options;

  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error ?? '');
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context}] Error:`, error);

  if (posthog) {
    try {
      if (typeof posthog.captureException === 'function' && error instanceof Error) {
        posthog.captureException(error, { context, ...extraProps });
      } else if (typeof posthog.capture === 'function') {
        posthog.capture('app_error', {
          context,
          error_message: errorMessage,
          stack,
          timestamp: new Date().toISOString(),
          ...extraProps,
        });
      }

      if (posthog.logger && typeof posthog.logger.error === 'function') {
        posthog.logger.error(`[${context}] ${errorMessage}`, { stack, ...extraProps });
      }
    } catch (phErr) {
      console.error('Failed to report error to PostHog:', phErr);
    }
  }

  if (customMessage) {
    return customMessage;
  }

  return ErrorMessageFormatter.formatAuthError(errorMessage);
}
