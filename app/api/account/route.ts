import { NextRequest } from 'next/server';
import { handleBody } from '@/lib/api-route';
import { accountActionSchema, deleteAccount } from '@/lib/account-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function POST(request:NextRequest) {return handleBody(request,accountActionSchema,1_000,()=>deleteAccount());}
