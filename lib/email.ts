import 'server-only';
import { BRAND } from './config';

// Transactional email through Resend. Without RESEND_API_KEY and a verified
// EMAIL_FROM sender, nothing is sent and callers fall back to showing links.
type Message = { to: string; subject: string; text: string };
const sender = () => (process.env.EMAIL_FROM || process.env.CONFIRMATION_EMAIL_FROM || '').trim();
export function emailConfigured() { return Boolean(process.env.RESEND_API_KEY?.trim() && sender()); }

/** Sends up to 100 messages in one request. Returns whether they were accepted. */
export async function sendEmails(messages: Message[]): Promise<boolean> {
  if (!emailConfigured() || !messages.length) return false;
  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(0, 100).map((message) => ({ from: sender(), to: [message.to], subject: message.subject, text: `${message.text}\n\n— ${BRAND}` }))),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch { return false; }
}
