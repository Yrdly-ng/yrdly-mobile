import { ErrorMessageFormatter } from './error-messages';
import { captureAppError } from '../telemetry';

export interface LogErrorOptions {
  context?: string;
  extraProps?: Record<string, any>;
  customMessage?: string;
}

/**
 * Logs an error and returns a user-friendly error message for display.
 */
export function logError(error: any, options: LogErrorOptions = {}): string {
  const { context = 'general_error', customMessage } = options;

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? '');
  captureAppError(error, 'app.logger');
  console.error(`[${context}] Error:`, error);

  if (customMessage) {
    return customMessage;
  }

  return ErrorMessageFormatter.formatAuthError(errorMessage);
}
