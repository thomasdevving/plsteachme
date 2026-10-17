'use client';
import { Play, ArrowUpRight } from 'lucide-react';
import { DEMO_URL, VIDEO_URL } from '@/lib/config';
import type { Copy } from '@/lib/i18n';
import { track } from '@/lib/analytics';
export function Demo({ c }: { c: Pick<Copy,'demo'> }) {
  return <div className="demo-layout"><div className="demo-video">{VIDEO_URL ? <video controls playsInline preload="none" poster="/tie.svg" aria-label={c.demo.videoLabel} onPlay={() => track('demo_video_play')}><source src={VIDEO_URL}/></video> : <div className="demo-poster"><img src="/tie.svg" alt="" width="420" height="340"/><button className="play-mark" type="button" disabled aria-label={c.demo.missingVideo}><Play size={25} aria-hidden="true"/></button><p>{c.demo.poster}</p><small>{c.demo.missingVideo}</small></div>}</div><div className="demo-explanation"><h2>{c.demo.title}</h2><p className="lead">{c.demo.intro}</p>{DEMO_URL ? <a className="button primary" href={DEMO_URL} target="_blank" rel="noopener noreferrer" onClick={() => track('cta_demo_click')}>{c.demo.try}<ArrowUpRight size={18} aria-hidden="true"/></a> : <a className="button primary" href="/demo#lessons">{c.demo.try}<ArrowUpRight size={18} aria-hidden="true"/></a>}<p className="small muted">{c.demo.phone}</p></div></div>;
}
