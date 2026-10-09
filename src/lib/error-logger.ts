import { ErrorMessageFormatter } from './error-messages';
import { captureError } from './monitoring';

export interface LogErrorOptions {
  context?: string;
  extraProps?: Record<string, any>;
  customMessage?: string;
}

/**
 * Logs an error and returns a user-friendly error message for display.
 */
export function logError(
  error: any,
  options: LogErrorOptions = {}
): string {
  const { context = 'general_error', extraProps = {}, customMessage } = options;

  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error ?? '');
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context}] Error:`, error);
  captureError(error, context, extraProps);

  if (customMessage) {
    return customMessage;
  }

  return ErrorMessageFormatter.formatAuthError(errorMessage);
}
