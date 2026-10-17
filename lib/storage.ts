import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';
import { authConfig } from './auth/config';
import { serviceFetch } from './network';
const supabaseUrl = authConfig().url;
export const mockMode = !supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
export function db() {
  if (mockMode) throw new Error('Storage not configured');
  return createClient(supabaseUrl!, process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: { persistSession: false, autoRefreshToken: false }, db: { timeout: 15_000, retry: false }, global: { fetch: serviceFetch } });
}
export const token = () => randomBytes(24).toString('base64url');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function record(table: string, data: Record<string, unknown>) {
  // Mock mode deliberately logs no personal data and retains nothing.
  if (mockMode) { console.info(`[mock] ${table}: submission validated; no personal data saved`); return; }
  const { error } = await db().from(table).insert(data);
  if (error) throw new Error('Storage write failed');
}
export async function under16Count() {
  if (mockMode) { console.info('[mock] anonymous under-16 count; no personal data saved'); return; }
  const { error } = await db().rpc('increment_under16');
  if (error) throw new Error('Aggregate write failed');
}
