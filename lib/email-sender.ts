import 'server-only';
import { z } from 'zod';
/** Keep application mail on the verified brand domain, regardless of a personal display name. */
export function brandedEmailSender(value='contact@plsteach.me'):string|null {
  const configured=value.trim();
  const email=(/^[^<>]*<([^<>]+)>$/.exec(configured)?.[1]||configured).trim().toLowerCase();
  if(!z.email().safeParse(email).success || email.split('@')[1]!=='plsteach.me')return null;
  return `plsteach.me <${email}>`;
}
