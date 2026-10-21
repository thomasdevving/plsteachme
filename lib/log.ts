// Structured server logs (one JSON line each), visible in Cloudflare Workers Logs.
// Never pass personal data, images, prompts or tokens in `fields`.
export function logError(event: string, fields: Record<string, unknown> = {}, error?: unknown) {
  const detail = error instanceof Error ? { error: error.name, message: error.message.slice(0, 300) }
    : error && typeof error === 'object' && 'message' in error ? { message: String((error as { message: unknown }).message).slice(0, 300) } : {};
  console.error(JSON.stringify({ level: 'error', event, ...fields, ...detail, at: new Date().toISOString() }));
}
/**
 * Logs an AI provider failure by category only (quota, rate_limited, timeout, failed)
 * and status code: provider messages are not logged, as they may echo request content.
 */
export function logAiFailure(route: string, error: unknown, timedOut = false) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  const status = error && typeof error === 'object' && 'statusCode' in error ? Number((error as { statusCode: unknown }).statusCode) || undefined : undefined;
  const kind = timedOut || /abort|timeout/i.test(text) ? 'timeout' : /insufficient_quota|billing|exceeded your current quota/i.test(text) ? 'quota' : status === 429 || /rate.?limit/i.test(text) ? 'rate_limited' : 'failed';
  console.error(JSON.stringify({ level: 'error', event: `ai.${kind}`, route, status, at: new Date().toISOString() }));
}
