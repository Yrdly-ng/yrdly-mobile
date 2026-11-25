const nativeErrorCodes = new Set([
  'ERR_CURRENT_LOCATION_IS_UNAVAILABLE',
  'ERR_LOCATION_BACKGROUND_UNAUTHORIZED',
  'ERR_LOCATION_MISSING_ACTIVITY',
  'ERR_LOCATION_REQUEST_CANCELLED',
  'ERR_LOCATION_REQUEST_REJECTED',
  'ERR_LOCATION_SETTINGS_UNSATISFIED',
  'ERR_LOCATION_UNAUTHORIZED',
  'ERR_LOCATION_UNAVAILABLE',
  'ERR_LOCATION_UNKNOWN',
  'ERR_NO_PERMISSION_IN_MANIFEST',
  'ERR_NO_PERMISSIONS_MODULE',
  'E_ACTIVITY_DOES_NOT_EXIST',
  'E_CALLBACK_ERROR',
  'E_FAILED_TO_OPEN_CAMERA',
  'E_NO_IMAGE_DATA_FOUND',
  'E_NO_LIBRARY_PERMISSION',
  'E_PICKER_CANCELLED',
]);

export function isNativeErrorCode(value: unknown): value is string {
  return typeof value === 'string' && nativeErrorCodes.has(value);
}

/** Fixed categories only: never send the original server payload or user content. */
export function diagnosticMessage(value: unknown): string {
  const text = value instanceof Error ? value.message :
    value && typeof value === 'object' && 'message' in value && typeof value.message === 'string' ? value.message : '';
  if (diagnosticMessages.has(text)) return text;
  if (/HybridObject.*MediaToolkit|MediaToolkit.*HybridObject/i.test(text)) return 'Native media toolkit initialization failed';
  if (/^Photo (?:decode|export) failed$|^Photo storage unavailable$/.test(text)) return text;
  if (/^Current location is unavailable|location services are disabled|location request failed/i.test(text)) return 'Device location unavailable';
  if (/^(?:Abort|SIGABRT)$/.test(text)) return 'Native abort';
  if (/out of memory|failed to allocate a [0-9]+ byte allocation/i.test(text)) return 'Memory allocation failed';
  if (/^The (?:operation|user request) was aborted[.!]?$/.test(text)) return 'Operation cancelled';
  // Emit only fixed categories (or a bounded React error number), never the
  // property name, component content, URL or provider payload in the message.
  const reactError = text.match(/^Minified React error #([0-9]{1,3});/);
  if (reactError) return `React runtime error #${reactError[1]}`;
  if (/^React runtime error #[0-9]{1,3}$/.test(text)) return text;
  if (/^addViewAt: failed to insert view \[/i.test(text)) return 'Native view insertion failed';
  if (/decoder.*(?:failed|unavailable)|codec.*(?:failed|unavailable)|mediacodec/i.test(text)) return 'Media decoder unavailable';
  if (/maximum call stack size exceeded|too much recursion/i.test(text)) return 'JavaScript stack overflow';
  if (/cannot (?:read|set) propert(?:y|ies) of undefined|undefined is not an object/i.test(text)) return 'Undefined property access';
  if (/cannot (?:read|set) propert(?:y|ies) of null|null is not an object/i.test(text)) return 'Null property access';
  if (/ is not a function(?:[. ]|$)/i.test(text)) return 'Non-callable value invoked';
  if (/ is not defined[.!]?$|^Can.t find variable:/i.test(text)) return 'JavaScript identifier unavailable';
  if (/loading (?:css )?chunk .+ failed|chunkloaderror|failed to fetch dynamically imported module|importing a module script failed/i.test(text)) return 'Application chunk unavailable';
  if (/RefererNotAllowedMapError/.test(text)) return 'Google Maps referrer rejected';
  if (/InvalidKeyMapError|MissingKeyMapError/.test(text)) return 'Google Maps API key unavailable';
  if (/ApiNotActivatedMapError/.test(text)) return 'Google Maps API not enabled';
  if (/BillingNotEnabledMapError/.test(text)) return 'Google Maps billing unavailable';
  if (/cannot add.*callbacks.*after.*subscribe/i.test(text)) return 'Realtime channel listener registered after subscription';
  if (/API key not found|com.google.android.geo.API_KEY/i.test(text)) return 'Native Google Maps API key missing';
  if (/foreign key constraint|23503/i.test(text)) return 'Database relationship unavailable';
  if (/network request failed|failed to fetch|networkerror/i.test(text)) return 'Network request unavailable';
  if (/timeout|timed out/i.test(text)) return 'Operation timed out';
  if (/invalid session|jwt expired|auth session missing/i.test(text)) return 'Authentication session unavailable';
  return 'Application operation failed';
}

export const diagnosticMessages = new Set([
  'Native abort',
  'Native media toolkit initialization failed',
  'Photo decode failed',
  'Photo export failed',
  'Photo storage unavailable',
  'Device location unavailable',
  'Memory allocation failed',
  'Operation cancelled',
  'Media decoder unavailable',
  'Native view insertion failed',
  'JavaScript stack overflow',
  'Undefined property access',
  'Null property access',
  'Non-callable value invoked',
  'JavaScript identifier unavailable',
  'Application chunk unavailable',
  'Google Maps referrer rejected',
  'Google Maps API key unavailable',
  'Google Maps API not enabled',
  'Google Maps billing unavailable',
  'Realtime channel listener registered after subscription',
  'Native Google Maps API key missing',
  'Database relationship unavailable',
  'Network request unavailable',
  'Operation timed out',
  'Authentication session unavailable',
  'Application operation failed',
]);
