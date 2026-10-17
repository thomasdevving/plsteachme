import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' }] }, ...['/teach','/en/teach','/nl/teach'].map(source=>({source,headers:[{key:'Permissions-Policy',value:'camera=(self), microphone=(self), geolocation=()'}]}))]; } };
export default config;
