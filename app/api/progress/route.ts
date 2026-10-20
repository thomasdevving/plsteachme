import { NextRequest } from 'next/server';
import { handle, handleBody } from '@/lib/api-route';
import { listProgress, progressSaveSchema, saveProgress } from '@/lib/account-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET() {return handle(listProgress);}
export function POST(request:NextRequest) {return handleBody(request,progressSaveSchema,24_000,saveProgress);}
