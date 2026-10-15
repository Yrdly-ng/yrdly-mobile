export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Only a rejected session may be retried; unknown payment outcomes never are. */
export function createApiClient(
  origin: string,
  getHeaders: (forceRefresh: boolean) => Promise<HeadersInit>,
  fetcher: typeof fetch = fetch
) {
  async function request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: object,
    signal?: AbortSignal
  ): Promise<T> {
    if (!path.startsWith('/api/') || path.includes('://')) throw new Error('Invalid API path');
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetcher(`${origin.replace(/\/+$/, '')}${path}`, {
        method,
        headers: await getHeaders(attempt === 1),
        ...(body ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
        ...(method === 'GET' ? { cache: 'no-store' as const } : {}),
      });
      if (response.status === 401 && attempt === 0) continue;
      if (!response.headers.get('content-type')?.includes('application/json')) {
        // An HTML error page can contain session or infrastructure details.
        throw new ApiError('The service is unavailable. Please try again later.', response.status);
      }
      const json = await response.json();
      if (!response.ok) {
        throw new ApiError(
          json.message || json.error || `Request failed (${response.status})`,
          response.status,
          json.error
        );
      }
      return json as T;
    }
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }
  return {
    get<T = any>(path: string) {
      return request<T>('GET', path);
    },
    post<T = any>(path: string, body: object, signal?: AbortSignal) {
      return request<T>('POST', path, body, signal);
    },
    patch<T = any>(path: string, body: object, signal?: AbortSignal) {
      return request<T>('PATCH', path, body, signal);
    },
  };
}
