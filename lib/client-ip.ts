// The visitor's address for rate limiting. On Cloudflare, cf-connecting-ip is set
// by the edge and cannot be supplied by the client; x-forwarded-for is only a
// fallback for local development and other hosts.
export function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
