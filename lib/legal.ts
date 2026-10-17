import 'server-only';

/** Public operator details; never use authentication or billing credentials here. */
export function legalContact() {
  const candidate = process.env.CONTACT_EMAIL?.trim() || '';
  return {
    name: process.env.OPERATOR_NAME?.trim() || 'Thomas Nguyen',
    email: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate) ? candidate : '',
    country: 'Netherlands',
  };
}
