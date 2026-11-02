import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parse } from '@/lib/http';
import { db, hash, mockMode } from '@/lib/storage';
import { unsubscribeId, validUnsubscribeToken } from '@/lib/waitlist-mail';
const schema=z.object({token:z.string().length(80)}).strict();
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
// Mail scanners may GET links. Only an explicit POST can remove an entry.
export function GET() {return reply({error:'Use the removal button in your email.'},405);}
async function oneClickBody(request:Request) {
  const reader=request.body?.getReader();if(!reader)return false;
  const chunks:Uint8Array[]=[];let size=0;
  const timer=setTimeout(()=>{void reader.cancel().catch(()=>{});},5000);
  try {
    while(true) {
      const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;if(size>128){await reader.cancel();return false;}
      chunks.push(part.value);
    }
    const values=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    return [...values].length===1 && values.get('List-Unsubscribe')==='One-Click';
  } catch {return false;} finally {clearTimeout(timer);reader.releaseLock();}
}
export async function POST(request:NextRequest) {
  let proof:string;
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/x-www-form-urlencoded') {
    // RFC 8058: mailbox providers POST this body without a browser Origin.
    if(!await oneClickBody(request))return reply({error:'invalid'},400);
    proof=request.nextUrl.searchParams.get('token')||'';
  } else {
    const result=await parse(request,schema);if('response' in result)return result.response;
    proof=result.data.token;
  }
  const id=unsubscribeId(proof);if(!id)return reply({error:'invalid'},400);
  if(mockMode)return reply({error:'unavailable'},503);
  try {
    const client=db();
    const found=await client.from('waitlist').select('id,session_hash').eq('id',id).maybeSingle();
    if(found.error)throw new Error('storage');
    if(!found.data)return reply({removed:true}); // Already removed; idempotent.
    if(!validUnsubscribeToken(proof,found.data))return reply({error:'invalid'},400);
    const removed=await client.from('waitlist').delete().eq('id',id).eq('session_hash',found.data.session_hash);
    if(removed.error)throw new Error('storage');
    const response=reply({removed:true});
    const current=request.cookies.get('pt-signup')?.value;
    if(current && hash(current)===found.data.session_hash)response.cookies.delete('pt-signup');
    return response;
  } catch {return reply({error:'unavailable'},503);}
}
