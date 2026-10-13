import type { ComponentProps, ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
export function Button({ children, variant = 'primary', ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) { return <button className={`button ${variant}`} {...props}>{children}</button>; }
export function ButtonLink({ children, href, secondary = false }: { children: ReactNode; href: string; secondary?: boolean }) { return <a className={`button ${secondary ? 'secondary' : 'primary'}`} href={href}>{children}<ArrowUpRight size={18} aria-hidden="true"/></a>; }
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <article className={`card ${className}`}>{children}</article>; }
export function Section({ children, id, className = '', labelledBy }: { children: ReactNode; id?: string; className?: string; labelledBy?: string }) { return <section id={id} aria-labelledby={labelledBy} className={`section ${className}`}><div className="container">{children}</div></section>; }
export function FormField({ label, id, children, error }: { label: string; id: string; children: ReactNode; error?: string }) { return <div className="field"><label htmlFor={id}>{label}</label>{children}{error && <span className="field-error" id={`${id}-error`}>{error}</span>}</div>; }
export function Chip({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) { return <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>{children}</button>; }
