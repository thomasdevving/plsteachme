/** Announced in the browser when a request fails before reaching the server. */
export const NETWORK_FAILURE_EVENT = 'plsteach:network-failure';

/** Bound both the request and response body while retaining caller cancellation. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 20_000,
): Promise<Response> {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (input instanceof Request) signals.push(input.signal);
  if (init.signal) signals.push(init.signal);
  return fetch(input, { ...init, signal: AbortSignal.any(signals) }).catch((error: unknown) => {
    // A failed connection (not a caller cancellation) lets the app recheck whether it is offline.
    if (typeof window !== 'undefined' && !init.signal?.aborted && error instanceof Error && error.name !== 'AbortError')
      window.dispatchEvent(new Event(NETWORK_FAILURE_EVENT));
    throw error;
  });
}

/** Leave time for the app to return a recoverable error before its client times out. */
export const serviceFetch: typeof fetch = (input, init) =>
  fetchWithTimeout(input, init, 15_000);
