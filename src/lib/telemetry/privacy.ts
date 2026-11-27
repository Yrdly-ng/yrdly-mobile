import { diagnosticMessage, isNativeErrorCode } from './diagnostics';
import type { ErrorEvent, StackFrame } from '@sentry/react-native';
import type { PostHogOptions } from 'posthog-react-native';
import { isScreenName } from './routes';
import { deviceLabel, homeState } from './metadata';
import { reliabilityEvents, reliabilityProperties, sanitizeDiagnosticBreadcrumb } from './reliability';

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
  'account_created',
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
  'catalog.location.permission',
  'catalog.location.position',
  'media.photo.decode',
  'media.photo.export',
  'media.picker',
  'media.video.initialize',
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
  'NativeException',
  'CodedError',
  'SIGABRT',
  'SIGSEGV',
  'IllegalStateException',
  'OutOfMemoryError',
]);

export function isErrorCode(value: unknown): value is string {
  return isNativeErrorCode(value) ||
    (typeof value === 'string' && /^(?:[0-9]{2}[0-9A-Z]{3}|PGRST[0-9]{3})$/.test(value));
}

function cleanFilename(value?: string): string | undefined {
  const path = value?.split(/[?#]/)[0];
  return path?.startsWith('app:///') ? path : path?.split('/').pop();
}

function cleanPostHogStacktrace(
  value: unknown
): { frames: Array<Record<string, string | number | boolean>> } | undefined {
  if (!value || typeof value !== 'object' || !('frames' in value) || !Array.isArray(value.frames)) return undefined;
  const frames = value.frames.slice(-40).flatMap((frame) => {
    if (!frame || typeof frame !== 'object') return [];
    const item = frame as Record<string, unknown>;
    const clean: Record<string, string | number | boolean> = {};
    const filename = typeof item.filename === 'string' ? cleanFilename(item.filename) : undefined;
    const functionName = typeof item.function === 'string'
      ? item.function.replace(/[^a-zA-Z0-9_.$<> -]/g, '').slice(0, 160)
      : undefined;
    if (filename) clean.filename = filename;
    if (functionName) clean.function = functionName;
    if (typeof item.lineno === 'number' && Number.isInteger(item.lineno) && item.lineno >= 0) clean.lineno = item.lineno;
    if (typeof item.colno === 'number' && Number.isInteger(item.colno) && item.colno >= 0) clean.colno = item.colno;
    if (typeof item.in_app === 'boolean') clean.in_app = item.in_app;
    return Object.keys(clean).length ? [clean] : [];
  });
  return frames.length ? { frames } : undefined;
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

export function sanitizeSentryEvent(event: ErrorEvent, originalException?: unknown): ErrorEvent {
  const candidateOperation = event.tags?.operation;
  const operation = typeof candidateOperation === 'string' && errorContexts.has(candidateOperation)
    ? candidateOperation
    : undefined;
  const screen = event.tags?.screen;
  const safeScreen = isScreenName(screen) ? screen : undefined;
  const originalCode = originalException && typeof originalException === 'object' && 'code' in originalException
    ? originalException.code
    : undefined;
  const code = isErrorCode(event.tags?.error_code) ? event.tags?.error_code : originalCode;
  const replayId = event.contexts?.replay?.replay_id;
  const contexts: NonNullable<ErrorEvent['contexts']> = {};
  if (typeof replayId === 'string' && /^[0-9a-f]{32}$/i.test(replayId)) contexts.replay = { replay_id: replayId };
  // Keep only hardware/runtime facts needed to correlate crashes. Never retain
  // device IDs, names, locale, addresses, request payloads or arbitrary contexts.
  const device = event.contexts?.device;
  if (device) {
    const clean: Record<string, string | number | boolean> = {};
    for (const key of ['model', 'manufacturer', 'brand', 'arch']) {
      const value = deviceLabel(device[key]);
      if (value) clean[key] = value;
    }
    for (const key of ['memory_size', 'free_memory', 'processor_count']) {
      const value = device[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) clean[key] = value;
    }
    for (const key of ['low_memory', 'simulator']) if (typeof device[key] === 'boolean') clean[key] = device[key];
    if (Object.keys(clean).length) contexts.device = clean;
  }
  const app = event.contexts?.app;
  if (app) {
    const clean: Record<string, string | boolean> = {};
    for (const key of ['app_version', 'app_build']) {
      const value = app[key];
      if (typeof value === 'string' && /^[a-zA-Z0-9._+-]{1,80}$/.test(value)) clean[key] = value;
    }
    if (typeof app.in_foreground === 'boolean') clean.in_foreground = app.in_foreground;
    if (Object.keys(clean).length) contexts.app = clean;
  }
  const os = event.contexts?.os;
  if (os) {
    const clean: Record<string, string> = {};
    if (['Android', 'iOS', 'Windows', 'macOS', 'Linux'].includes(os.name || '')) clean.name = os.name!;
    if (typeof os.version === 'string' && /^[0-9][a-zA-Z0-9._+-]{0,39}$/.test(os.version)) clean.version = os.version;
    if (Object.keys(clean).length) contexts.os = clean;
  }
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
    contexts: Object.keys(contexts).length ? contexts : undefined,
    breadcrumbs: event.breadcrumbs?.slice(-20).map(sanitizeDiagnosticBreadcrumb).filter((value): value is NonNullable<typeof value> => value !== null),
    tags: {
      ...(operation ? { operation } : {}),
      ...(safeScreen ? { screen: safeScreen } : {}),
      ...(isErrorCode(code) ? { error_code: code } : {}),
      ...reliabilityProperties({ app_state: event.tags?.app_state }),
    },
    exception: event.exception
      ? {
          values: event.exception.values?.map((exception, index, exceptions) => {
            const type = exception.type && errorTypes.has(exception.type) ? exception.type : 'Error';
            const category = diagnosticMessage({ message: exception.value });
            const original = index === exceptions.length - 1
              ? diagnosticMessage(originalException)
              : 'Application operation failed';
            const classified = category === 'Application operation failed' ? original : category;
            const nativeCode = index === exceptions.length - 1 && isNativeErrorCode(code) ? code : undefined;
            const context = operation || safeScreen;
            const location = context ? ` in ${context}` : '';
            return {
              type,
              value: classified === 'Application operation failed'
                ? `${type}${location}: ${nativeCode ?? (operation?.startsWith('catalog.location.') || operation?.startsWith('media.') ? 'operation failed' : 'cause unclassified')}`
                : classified,
              stacktrace: exception.stacktrace
                ? { frames: exception.stacktrace.frames?.map(cleanFrame) }
                : undefined,
              mechanism: exception.mechanism
                ? {
                    type: exception.mechanism.type,
                    handled: exception.mechanism.handled,
                  }
                : undefined,
            };
          }),
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
    !appEvents.has(event.event as AppEvent) &&
    !reliabilityEvents.has(event.event)
  )
    return null;
  const source = event.properties || {};
  if (event.event === '$screen' && !isScreenName(source.$screen_name)) return null;
  const properties: NonNullable<typeof event.properties> = {};
  if (reliabilityEvents.has(event.event)) Object.assign(properties, reliabilityProperties(source));
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
    const operation = typeof source.operation === 'string' && errorContexts.has(source.operation)
      ? source.operation
      : undefined;
    properties.$exception_list = list.map(exception => {
      const category = diagnosticMessage({ message: exception.value });
      const value = category === 'Application operation failed' && operation
        ? `Application operation failed in ${operation}`
        : category;
      const stacktrace = cleanPostHogStacktrace(exception.stacktrace);
      const allowedTypes = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError', 'AggregateError', 'NativeException', 'CodedError']);
      const type = typeof exception.type === 'string' && allowedTypes.has(exception.type)
        ? exception.type
        : 'Error';
      return {
        type,
        value,
        ...(stacktrace ? { stacktrace } : {}),
      };
    });
    if (operation) properties.operation = operation;
    if (isErrorCode(source.error_code)) properties.error_code = source.error_code;
  }
  if (event.event === 'account_created' && ['email', 'google', 'apple'].includes(source.signup_method as string)) {
    properties.signup_method = source.signup_method as string;
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
