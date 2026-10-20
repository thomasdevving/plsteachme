import { NextRequest } from 'next/server';
import { handle, handleBody } from '@/lib/api-route';
import { learningEventSchema, learningInsights, recordLearningEvents } from '@/lib/account-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:NextRequest) {
 const days=Math.min(365,Math.max(1,Number(request.nextUrl.searchParams.get('days'))||30));
 return handle(()=>learningInsights(days));
}
export function POST(request:NextRequest) {return handleBody(request,learningEventSchema,8_000,input=>recordLearningEvents(request,input));}
