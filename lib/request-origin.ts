import { SITE_URL } from './config';

/** Next may use the bind address internally; Host is the browser-facing authority. */
export function requestOrigin(request:Request):string {
  const internal=new URL(request.url),host=request.headers.get('host');
  if(host)try {
    const candidate=new URL(`${internal.protocol}//${host}`);
    if(!candidate.username && !candidate.password && candidate.host===host && candidate.pathname==='/' && !candidate.search && !candidate.hash) {
      const configured=new URL(SITE_URL);
      return configured.host===host?configured.origin:candidate.origin;
    }
  }catch { /* A malformed host must not become a redirect destination. */ }
  return internal.origin;
}

export function isSameOrigin(request:Request):boolean {
  const origin=request.headers.get('origin');
  return Boolean(origin && [new URL(request.url).origin,requestOrigin(request),SITE_URL].includes(origin)) && request.headers.get('sec-fetch-site')!=='cross-site';
}
