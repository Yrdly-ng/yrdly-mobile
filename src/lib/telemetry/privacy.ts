import { diagnosticMessage } from './diagnostics';
import type { ErrorEvent, StackFrame } from '@sentry/react-native';
import type { PostHogOptions } from 'posthog-react-native';
import { isScreenName } from './routes';
import { deviceLabel, homeState } from './metadata';

export function telemetryEnvironment(): 'development' | 'preview' | 'production' {
  const value = process.env.EXPO_PUBLIC_APP_ENV;
  return value === 'development' || value === 'preview' || value === 'production'
    ? value
    : __DEV__
      ? 'development'
      : 'production';
}

export const appEvents = new Set([
  'business_saved',
  'business_created',
  'message_sent',
  'business_save_failed',
  'message_send_failed',
  'ticket_checkout_started',
  'ticket_checkout_opened',
  'ticket_checkout_failed',
  'ticket_verification_failed',
  'ticket_issued',
  'ticket_refund_requested',
  'ticket_refund_failed',
  'event_withdrawal_requested',
  'event_withdrawal_failed',
  'booking_checkout_started',
  'booking_payment_confirmed',
  'booking_checkout_failed',

] as const);
export type AppEvent = typeof appEvents extends Set<infer T> ? T : never;

export const errorContexts = new Set([
  'business.save',
  'business.load',
  'chat.send',
  'chat.load',
  'app.error_boundary',
  'app.logger',
]);

export function isUserId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export function isEmail(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

const errorTypes = new Set([
  'Error',
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'RangeError',
  'URIError',
  'EvalError',
  'AggregateError',
]);

export function isErrorCode(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[0-9]{2}[0-9A-Z]{3}|PGRST[0-9]{3})$/.test(value);
}

function cleanFilename(value?: string): string | undefined {
  const path = value?.split(/[?#]/)[0];
  return path?.startsWith('app:///') ? path : path?.split('/').pop();
}

function cleanFrame(frame: StackFrame): StackFrame {
  // File names and line numbers remain useful for source-map symbolication.
  // Drop source snippets, local variables, full device paths, and URL credentials.
  return {
    filename: cleanFilename(frame.filename),
    function: frame.function?.replace(/[^a-zA-Z0-9_.$<> [\]-]/g, '').slice(0, 160),
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
    instruction_addr: frame.instruction_addr,
    platform: frame.platform,
  };
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const operation = event.tags?.operation;
  const screen = event.tags?.screen;
  const code = event.tags?.error_code;
  const replayId = event.contexts?.replay?.replay_id;
  // Free-form error messages can contain server payloads, chat text, addresses,
  // or credentials. Group by exception class + original stack, not those values.
  const safe: ErrorEvent = {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    sdk: event.sdk,
    debug_meta: event.debug_meta
      ? {
          images: event.debug_meta.images?.map((image) =>
            'code_file' in image
              ? { ...image, code_file: cleanFilename(image.code_file) || 'unknown' }
              : image
          ),
        }
      : undefined,
    user: isUserId(event.user?.id)
      ? {
          id: event.user.id,
          ...(isEmail(event.user.email) ? { email: event.user.email } : {}),
        }
      : undefined,
    // Preserve an existing replay link without retaining arbitrary replay metadata.
    contexts:
      typeof replayId === 'string' && /^[0-9a-f]{32}$/i.test(replayId)
        ? { replay: { replay_id: replayId } }
        : undefined,
    tags: {
      ...(typeof operation === 'string' && errorContexts.has(operation) ? { operation } : {}),
      ...(isScreenName(screen) ? { screen } : {}),
      ...(isErrorCode(code) ? { error_code: code } : {}),
    },
    exception: event.exception
      ? {
          values: event.exception.values?.map((exception) => ({
            type: errorTypes.has(exception.type || '') ? exception.type : 'Error',
            value: diagnosticMessage({ message: exception.value }) === 'Application operation failed' ? 'Error details omitted for privacy' : diagnosticMessage({ message: exception.value }),
            stacktrace: exception.stacktrace
              ? { frames: exception.stacktrace.frames?.map(cleanFrame) }
              : undefined,
            mechanism: exception.mechanism
              ? {
                  type: exception.mechanism.type,
                  handled: exception.mechanism.handled,
                }
              : undefined,
          })),
        }
      : undefined,
  };
  if (!safe.exception) safe.message = 'Application error';
  return safe;
}

type BeforeSend = Exclude<NonNullable<PostHogOptions['before_send']>, unknown[]>;

export const sanitizePostHogEvent: BeforeSend = (event) => {
  if (
    event.event !== '$exception' &&
    event.event !== '$identify' &&
    event.event !== '$screen' &&
    !appEvents.has(event.event as AppEvent)
  )
    return null;
  const source = event.properties || {};
  if (event.event === '$screen' && !isScreenName(source.$screen_name)) return null;
  const properties: NonNullable<typeof event.properties> = {};
  // Email is a person-level lookup field, accepted only on identity events.
  // Never allow it (or arbitrary profile data) onto screens/product events.
  if (event.event === '$identify') {
    const set =
      source.$set && typeof source.$set === 'object' && !Array.isArray(source.$set)
        ? (source.$set as Record<string, unknown>)
        : {};
    const email = isEmail(set.email) ? set.email : isEmail(source.email) ? source.email : undefined;
    if (email) properties.$set = { email };
  }
  // Keep only ingestion/identity metadata and deliberate product properties.
  for (const key of [
    'token',
    'distinct_id',
    '$anon_distinct_id',
    '$session_id',
    '$device_id',
    '$lib',
    '$lib_version',
    '$is_identified',
    '$process_person_profile',
    '$app_version',
    '$app_build',
    '$os_name',
    '$os_version',
  ]) {
    const value = source[key];
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
      properties[key] = value;
  }
  if (event.event === '$exception') {
    const list = Array.isArray(source.$exception_list) ? source.$exception_list as Record<string, unknown>[] : [];
    if (!list.length) return null;
    properties.$exception_list = list.map(exception => ({
      type: 'Error', value: diagnosticMessage({message:exception.value}),
    }));
  }
  properties.$geoip_disable = true;
  if (['android', 'ios', 'web'].includes(source.app_platform as string))
    properties.app_platform = source.app_platform;
  for (const key of ['device_model', 'device_manufacturer']) {
    const value = deviceLabel(source[key]);
    if (value) properties[key] = value;
  }
  if (['phone', 'tablet', 'tv', 'desktop', 'unknown'].includes(source.device_type as string))
    properties.device_type = source.device_type;
  const state = homeState(source.home_state);
  if (state && source.$is_identified === true) properties.home_state = state;
  properties.app_environment = telemetryEnvironment();
  if (isScreenName(source.$screen_name)) properties.$screen_name = source.$screen_name;
  return { event: event.event, uuid: event.uuid, timestamp: event.timestamp, properties };
};
