/** Only return to public app destinations; never trust an OAuth query string. */
export function safeNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\/(?:account|coach|subscriptions)(?:[/?#]|$)/.test(value) ||
    /[\\\r\n]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://plsteach.me");
    return url.origin === "https://plsteach.me" &&
      /^\/(?:account|coach|subscriptions)(?:[/?#]|$)/.test(url.pathname)
      ? url.pathname + url.search + url.hash
      : "/account";
  } catch {
    return "/account";
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (
    origin === new URL(request.url).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
