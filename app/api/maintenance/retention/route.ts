import { handle } from '@/lib/api-route';
import { runRetention } from '@/lib/account-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Called by the scheduled workflow with the MAINTENANCE_SECRET bearer token.
export function POST(request:Request) {return handle(()=>runRetention(request));}
