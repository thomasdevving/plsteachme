import { BRAND } from '@/lib/config';

// Terms of use for the public test phase. Plain language; keep in step with the privacy page.
const sections: { title: string; body: string[] }[] = [
  { title: 'About these terms', body: [
    `${BRAND} is in a public test phase. These terms apply when you use the website, follow a lesson, create an account or post something. By creating an account you accept them.`,
    'During the test phase the service is free. Features may change, pause or stop, and paid plans are not available yet.',
  ] },
  { title: 'Who can use it', body: [
    'You need to be 16 or older to create an account and to use camera coaching. Younger learners can follow the illustrated lessons together with a parent or guardian.',
  ] },
  { title: 'Safety comes first', body: [
    'Lessons explain everyday skills such as shaving, ironing, cooking, drilling or bike care. They are general guidance, not professional training or supervision. You decide whether a task is safe for you, use tools and heat with care, follow the safety notes in each lesson and stop if you are unsure, hurt or something does not look right.',
    'Do not use the lessons for work that legally or practically needs a professional, such as gas, mains electricity, structural repairs, medical care or anything involving a risk you cannot judge yourself.',
    'Camera coaching is automated. It compares still images with what a step should look like and can be wrong. "Looks right" means the visible checkpoint matched; it is not a safety check, certification or guarantee of the result.',
  ] },
  { title: 'Your free coaching session', body: [
    'Each person gets one free camera-coaching session: one lesson, usable for two hours and with a limited number of checks. One free session applies per email address, also if you delete and recreate your account.',
    'To keep the service available for everyone, coaching may pause when demand is high, and we may limit or stop access in case of misuse.',
  ] },
  { title: 'Your account', body: [
    'Use an email address you control, keep sign-in links to yourself and tell us if you think someone else used your account. You can delete your account at any time from your account page.',
  ] },
  { title: 'What you post', body: [
    'Skill requests, support, teacher applications, demonstrations, lessons and organization content stay yours. You give us permission to store and show them as the feature describes (for example, a skill request on the public board, or a published lesson for learners). Teachers grant the publication permissions they choose in the teacher studio.',
    'Only post what you have the right to share. Do not post personal details of yourself or others, images of other people without their permission, advertising or spam, or anything illegal, hateful, sexual, violent or dangerous. Lessons must not encourage unsafe practices.',
    'Reviewers may hide or remove content that breaks these rules, and we may suspend accounts that repeatedly do so. Report a problem through the contact address below.',
  ] },
  { title: 'Fair use', body: [
    'Do not try to get around limits (such as the free session or rate limits), use scripts or bots, overload the service, extract the coaching prompts or models, or use the service to build a competing dataset.',
  ] },
  { title: 'Availability and liability', body: [
    'We work to keep the service available and accurate, but during the test phase it is provided as it is, without guarantees that it is uninterrupted, error-free or suitable for a particular purpose.',
    'As far as the law allows, we are not liable for damage resulting from following a lesson, from automated feedback or from the service being unavailable. Nothing in these terms limits liability that cannot be limited by law, such as for intent or gross negligence, and your rights as a consumer remain.',
  ] },
  { title: 'Changes and applicable law', body: [
    'We may update these terms as the service develops. For important changes we will tell you on the website or by email before they take effect. Dutch law applies; mandatory consumer protection of your country of residence stays in force.',
  ] },
];

export function TermsPage({ contact }: { contact?: string }) {
  return <article className="legal-page container">
    <h1>Terms of use</h1>
    <p className="draft-note">Last updated 22 October 2026. Also read the <a href="/privacy">privacy statement</a>.</p>
    {sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.body.map(text => <p key={text.slice(0, 40)}>{text}</p>)}</section>)}
    <section><h2>Contact</h2><p>{contact ? <>Questions or a problem to report? Email <a href={`mailto:${contact}`}>{contact}</a>.</> : 'Questions or a problem to report? Contact details will be added here shortly.'}</p></section>
  </article>;
}
