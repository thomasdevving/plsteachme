'use client';
import { Button, Card, Chip, FormField } from './ui';
import { BRAND } from '@/lib/config';
// Development-only; route is excluded in production by pageFromSlug.
export function Styleguide() { return <div className="container styleguide"><h1>{BRAND} · component library</h1>{['light','dark'].map(theme => <section key={theme} data-theme={theme}><h2>{theme === 'light' ? 'Light' : 'Dark'}</h2><p>Patient guidance, one step at a time.</p><div className="hero-actions"><Button>Primary button</Button><Button variant="secondary">Secondary button</Button><Button disabled>Disabled</Button></div><Card><h3>Card</h3><p>A warm, quiet surface for useful content.</p></Card><Chip selected={false} onClick={() => {}}>Skill chip</Chip><FormField label="Email address" id={`example-${theme}`}><input id={`example-${theme}`} type="email" placeholder="you@example.com"/></FormField></section>)}</div>; }
