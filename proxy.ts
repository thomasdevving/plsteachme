import { NextRequest, NextResponse } from 'next/server';
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const original = url.pathname;
  url.pathname = url.pathname.replace(/^\/(?:en|nl)(?=\/|$)/, '') || '/';
  url.pathname = ({ '/organisaties': '/organizations', '/bedankt': '/thanks' } as Record<string,string>)[url.pathname] || url.pathname;
  if (url.pathname !== original) return NextResponse.redirect(url, 308);
  url.pathname = `/en${url.pathname === '/' ? '' : url.pathname}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-plsteach-locale', 'en');
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}
export const config = { matcher: ['/((?!api|_next|fonts/|brand/|tie.svg|icon.svg|robots.txt|sitemap.xml).*)'] };
