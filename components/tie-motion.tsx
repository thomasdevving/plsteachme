'use client';
import { useLayoutEffect, useRef } from 'react';

// Front view: orange is the wide end, cream is the narrow end.
// Every ribbon uses the same path topology for continuous state-to-state motion.
const poses = [
  { label:'Start with the wide end longer', wide:'M180 90C165 132 150 210 142 280L158 300L178 282C179 220 193 130 200 100Z', band:'M190 130C200 132 216 132 230 130L230 132L190 132Z', guide:'M126 183L126 278m-7-8 7 8 7-8', knot:false },
  { label:'Cross the wide end over the narrow end', wide:'M180 90C187 130 250 152 270 240L257 265L239 246C236 172 181 151 163 105Z', band:'M190 130C200 132 216 132 230 130L230 132L190 132Z', guide:'M147 174Q204 139 268 190m-11-1 11 1-3-11', knot:false },
  { label:'Wrap the wide end behind the narrow end', wide:'M230 135C260 170 190 182 156 245L135 267L123 239C152 171 223 154 210 128Z', band:'M190 130C200 132 216 132 230 130L230 132L190 132Z', guide:'M270 174Q212 205 142 183m10-4-10 4 7 9', knot:false },
  { label:'Bring the wide end across the front', wide:'M178 148C202 130 260 140 270 235L256 261L236 241C240 170 202 169 181 171Z', band:'M178 144C197 134 220 136 243 143L239 168L181 168Z', guide:'M143 186Q210 156 279 188m-11 1 11-1-4-10', knot:true },
  { label:'Lift the wide end through the neck loop', wide:'M211 137C229 107 239 77 236 35L219 17L202 36C211 65 218 107 190 140Z', band:'M178 144C197 134 220 136 243 143L239 168L181 168Z', guide:'M262 151Q275 98 254 57m-3 11 3-11 10 4', knot:true },
  { label:'Pass the wide end down through the front loop', wide:'M223 129C233 158 231 224 228 278L210 299L192 279C200 222 209 158 201 137Z', band:'M178 144C197 134 220 136 243 143L230 173L192 173Z', guide:'M260 168L260 263m-7-8 7 8 7-8', knot:true },
  { label:'Slide the knot up gently', wide:'M223 113C231 152 231 224 228 278L210 299L192 279C200 222 204 153 201 113Z', band:'M185 101C200 95 219 97 235 103L225 132L197 132Z', guide:'M260 155L260 109m-7 8 7-8 7 8', knot:true }
];
export function TieMotion({ step, replay }: { step: number; replay: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const wide = useRef<SVGPathElement>(null);
  const band = useRef<SVGPathElement>(null);
  const last = useRef(Math.max(0, step - 1));
  const pose = poses[step];
  useLayoutEffect(() => {
    const node = svg.current;
    if (!node) return;
    const from = poses[last.current === step ? Math.max(0, step - 1) : last.current];
    last.current = step;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const animations: Animation[] = [];
    if (!preference.matches) {
      for (const [element, start, end] of [[wide.current, from.wide, pose.wide], [band.current, from.band, pose.band]] as const) {
        if (element) animations.push(element.animate([{d:`path('${start}')`},{d:`path('${end}')`}],{duration:1100,easing:'cubic-bezier(.45,0,.2,1)'}));
      }
    }
    let visible = false;
    const sync = () => animations.forEach(animation => {
      if (preference.matches) animation.finish();
      else if (animation.playState !== 'finished') visible && !document.hidden ? animation.play() : animation.pause();
    });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    preference.addEventListener('change', sync);
    return () => { animations.forEach(animation => animation.cancel()); observer.disconnect(); document.removeEventListener('visibilitychange',sync); preference.removeEventListener('change',sync); };
  }, [step, replay, pose]);
  return <svg ref={svg} className="tie-motion" data-step={step + 1} viewBox="0 0 420 340" role="img" aria-label={`Step ${step + 1}: ${pose.label}`}>
    <g fill="none" stroke="#909d85" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M161 40 162 71Q130 86 88 105Q65 116 60 151L47 319M258 40 257 71Q291 86 331 105Q355 116 361 151L374 319"/><path d="M162 71 139 92 166 126 192 91M257 71 279 92 253 126 226 91M162 71Q207 98 257 71"/></g>
    <path d="M209 161V316" stroke="#c9d0bd" strokeWidth="2" strokeDasharray="3 7"/>
    <path d="M227 91C225 140 225 193 230 245L217 260L205 245C211 191 210 140 209 96Z" fill="#ded5c3" stroke="#52614f"/>
    <path ref={wide} className="tie-wide-end" d={pose.wide} fill="#bb4827"/>
    {step === 2 && <path d="m214 129 12 4-3 31-13-1Z" fill="#ded5c3" stroke="#52614f"/>}
    <path ref={band} className="tie-front-band" d={pose.band} fill="#bb4827" opacity={pose.knot ? 1 : 0}/>
    {pose.knot && <path d={step === 6 ? 'M198 109Q211 104 223 109' : 'M190 151Q212 143 233 151'} fill="none" stroke="#8c331e" strokeWidth="2"/>}
    <path className="tie-step-guide" d={pose.guide} fill="none" stroke="#7b442f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
