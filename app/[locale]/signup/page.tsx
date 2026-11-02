import { AuthShell } from '@/components/auth-shell';
import { WaitlistForm } from '@/components/forms';
import { WaitlistCount } from '@/components/waitlist-count';
import { getCopy } from '@/lib/i18n';
import { mockMode } from '@/lib/storage';
export const dynamic='force-dynamic';
export const metadata = {
  title:'Join the waitlist',
  robots:{index:false,follow:false}
};
export default function Signup() {
  const c=getCopy('en');
  const copy={...c,form:{...c.form,submit:'Join the waitlist',consent:'I’d like waitlist updates and agree to the',privacy:'privacy statement.',mock:'This is a preview; your waitlist entry will not be saved. Joining does not create an account.',note:'Joining the waitlist does not create an account or grant immediate access. No spam; unsubscribe anytime.'}};
  return <AuthShell waitlist>
    <div className="auth-form-area waitlist-signup">
      <h1>Join the waitlist.</h1>
      <p className="auth-intro">We’re still testing plsteach.me. Leave your email and we’ll let you know when access opens.</p>
      <WaitlistCount/>
      <WaitlistForm c={copy} locale="en" mock={mockMode} compact/>
      <p className="auth-switch">Already have an account? <a href="/login">Log in</a></p>
    </div>
  </AuthShell>;
}
