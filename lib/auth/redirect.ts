/** Only return to public app destinations; never trust an OAuth query string. */
import { isSameOrigin } from '../request-origin';
export function safeNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\/(?:account|coach|subscriptions|learn|community|teach|training|reset-password)(?:[/?#]|$)/.test(value) ||
    /[\\\r\n]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://plsteach.me");
    return url.origin === "https://plsteach.me" &&
      /^\/(?:account|coach|subscriptions|learn|community|teach|training|reset-password)(?:[/?#]|$)/.test(url.pathname)
      ? url.pathname + url.search + url.hash
      : "/account";
  } catch {
    return "/account";
  }
}
export function sameOrigin(request: Request) {
  return isSameOrigin(request);
}
