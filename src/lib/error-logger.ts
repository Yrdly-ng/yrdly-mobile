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

  if (posthog && typeof posthog.capture === 'function') {
    try {
      posthog.capture('app_error', {
        context,
        error_message: errorMessage,
        stack,
        timestamp: new Date().toISOString(),
        ...extraProps,
      });
    } catch (phErr) {
      console.error('Failed to report error to PostHog:', phErr);
    }
  }

  if (customMessage) {
    return customMessage;
  }

  return ErrorMessageFormatter.formatAuthError(errorMessage);
}
