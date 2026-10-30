import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Only call with a user validated by getUser(), never browser-supplied metadata. */
export async function needsMfa(client: SupabaseClient, user: Pick<User, 'factors'>, jwt?: string) {
  if (!user.factors?.some(factor => factor.status === 'verified')) return false;
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(jwt);
  if (error || !data) throw new Error('Could not verify session assurance');
  return data.currentLevel !== 'aal2';
}
