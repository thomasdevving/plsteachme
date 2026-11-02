import { ConfirmationShell } from '@/components/confirmation-shell';
import { WaitlistUnsubscribe } from '@/components/waitlist-unsubscribe';
export const metadata={title:'Leave the waitlist',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function Unsubscribe() {return <ConfirmationShell><WaitlistUnsubscribe/></ConfirmationShell>;}
