import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const FETCH_WRAPPED = Symbol.for('qontri.sentry.fetchWrapped');

type WrappedFetch = typeof fetch & { [FETCH_WRAPPED]?: boolean };

let initialized = false;

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  const request = typeof input === 'object' && 'url' in input ? input : undefined;
  const url = typeof input === 'string' ? input : request?.url ?? input.toString();
  const method = init?.method ?? (request && 'method' in request ? request.method : 'GET');
  return { url, method };
}

/** Initialize Sentry and report rejected/failed fetch requests with context. */
export function initializeSentry() {
  if (initialized || !SENTRY_DSN) return;
  initialized = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: true,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });

  const currentFetch = globalThis.fetch as WrappedFetch;
  if (currentFetch[FETCH_WRAPPED]) return;

  const sentryFetch: WrappedFetch = async (input, init) => {
    const details = requestDetails(input, init);

    try {
      const response = await currentFetch(input, init);
      if (!response.ok) {
        Sentry.withScope((scope) => {
          scope.setTag('error.type', 'http');
          scope.setTag('http.status_code', String(response.status));
          scope.setContext('fetch', details);
          Sentry.captureMessage(`HTTP ${response.status} for ${details.method} ${details.url}`, 'error');
        });
      }
      return response;
    } catch (error) {
      Sentry.withScope((scope) => {
        scope.setTag('error.type', 'network');
        scope.setContext('fetch', details);
        Sentry.captureException(error);
      });
      throw error;
    }
  };

  sentryFetch[FETCH_WRAPPED] = true;
  globalThis.fetch = sentryFetch;
}
