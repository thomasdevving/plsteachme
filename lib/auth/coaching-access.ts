import 'server-only';
import type { User } from '@supabase/supabase-js';

/** Only Supabase-admin-managed metadata from a verified getUser() result may grant access. */
export function hasUnlimitedCoaching(user: Pick<User,'app_metadata'|'is_anonymous'> | null): boolean {
  return Boolean(user && !user.is_anonymous && user.app_metadata?.coaching_access === 'unlimited');
}
