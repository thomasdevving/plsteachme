'use client';
import { useLayoutEffect, useRef } from 'react';
import type { SkillId } from '@/lib/config';
import { modules } from '@/lib/modules';
import { TieMotion } from './tie-motion';

const ink = '#52614f';
const orange = '#bb4827';
const paper = '#faf7f2';

function Water({ x = 95, y = 110 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`} stroke="#526d80" fill="#dbe6e7"><path d="M0 0Q-20 24 0 29Q20 24 0 0Z"/><path d="M28 24Q15 41 28 44Q41 41 28 24Z"/></g>;
}
function Tick({ x = 315, y = 100 }: { x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}><circle r="24" fill="#d9e3cf"/><path d="m-12 0 8 8 16-17" stroke={ink} strokeWidth="4"/></g>;
}
function Razor({ trimmer = false }: { trimmer?: boolean }) {
  return <g fill={paper} stroke={orange} strokeWidth="3"><rect x="-15" y="0" width="30" height="75" rx="9"/><rect x="-27" y="-17" width="54" height="23" rx="4"/>{trimmer ? <path d="M-21-16v-12m8 12v-12m8 12v-12m8 12v-12m8 12v-12m8 12v-12"/> : <path d="M-20-9h40M-20-3h40"/>}<circle cy="50" r="4"/></g>;
}
function Face({ step, beard }: { step: number; beard: boolean }) {
  const shaving = !beard;
  return <>
    <path d="M148 85Q149 50 210 50Q271 50 272 85L268 182Q255 232 210 240Q165 232 152 182Z" fill="#ead9c3"/>
    <path d="M172 100h18m40 0h18m-38 15-8 38h17m-27 27q18 10 36 0"/>
    {(beard || step < 5) && <path d={beard && step > 3 ? 'M155 146Q175 164 191 159Q210 150 229 159Q245 164 265 146L261 185Q245 219 210 225Q175 219 159 185Z' : 'M153 146Q175 164 191 159Q210 150 229 159Q245 164 267 146L263 195Q245 239 210 249Q175 239 157 195Z'} fill={beard ? ink : '#8e967f'} stroke="none"/>}
    {shaving && step >= 2 && step <= 4 && <path d={step === 3 ? 'M220 159Q246 172 264 151L259 191Q246 220 218 231Z' : 'M156 151Q181 174 210 159Q240 174 264 151L260 193Q245 231 210 238Q175 231 160 193Z'} fill={paper} stroke="none"/>}
    {((shaving && [1,4,5].includes(step)) || (beard && step === 0)) && <Water/>}
    {beard && step === 1 && <g className="lesson-moving" transform="translate(152 153)"><rect width="28" height="70" rx="3" fill={paper} stroke={orange}/><path d="M6 10h22M6 20h22M6 30h22M6 40h22M6 50h22M6 60h22" stroke={orange}/></g>}
    {((shaving && [0,3,6].includes(step)) || (beard && step >= 2 && step <= 5)) && <g transform={`translate(${step === 4 && beard ? 260 : step === 3 ? 170 : 310} ${step === 3 ? 164 : 145})`}><g className="lesson-moving"><Razor trimmer={beard}/></g></g>}
    {shaving && step === 2 && <g className="lesson-moving" transform="translate(105 155)"><rect width="30" height="65" rx="8" fill={paper} stroke={orange}/><path d="M10 0v-12h20" stroke={orange}/></g>}
    {(step === 6 || (shaving && step === 5)) && <Tick/>}
    {beard && step === 2 && <path d="M290 115h40m-35-8v16m10-16v16m10-16v16m10-16v16" stroke={orange} strokeWidth="3"/>}
  </>;
}
function Ironing({ step }: { step: number }) {
  const areas = ['M162 91h96v53h-96Z','M80 245h260','M170 95h80v40h-80Z','M92 180h34v42H92Zm202 0h34v42h-34Z','M100 123l42-22 15 91-40 22Zm220 0-42-22-15 91 40 22Z','M157 142h106v96H157Z','M150 238h120'];
  return <>
    <path d="m163 91-45 24-31 76 38 15 28-50v87h114v-87l28 50 38-15-31-76-45-24-47 18Z" fill={paper}/><path d="m163 91 30 45 17-27 17 27 30-45M210 139v96"/>
    <path d="M80 250h260M130 250l45 50m115-50-45 50"/>
    <path d={areas[step]} fill={step === 1 || step === 6 ? 'none' : '#edd0ba'} stroke={orange} strokeDasharray="5 5"/>
    {step === 0 ? <g transform="translate(270 60)"><path d="M0 0h60v60H0Z" fill={paper}/><path d="M9 38h41L43 24H24L9 38Zm15-14v-8h15l4 8" stroke={orange}/></g> : step === 6 ? <><path d="M200 60q0-22 13-15q13 8-3 19v10l65 22H145l65-22" stroke={orange}/><Tick/></> : <g transform={`translate(${step === 4 ? 90 : 170} ${step === 2 ? 85 : step === 3 ? 170 : 190})`}><g className="lesson-moving" fill={orange} stroke={orange}><path d="M0 40h90L80 14H34Q10 14 0 40Z"/><path d="M34 14V0h35l11 14" fill="none"/><path d="M0 43h90" strokeWidth="4"/></g></g>}
  </>;
}
function ButtonScene({ step }: { step: number }) {
  return <>
    <rect x="85" y="65" width="250" height="210" rx="12" fill={paper}/><path d="M115 65v210m-13-190v170" strokeDasharray="5 6"/>
    <circle cx="210" cy="165" r="58" fill="#e2d4bc"/><circle cx="210" cy="165" r="48" stroke="#a99c84"/>
    {[[-16,-16],[16,-16],[-16,16],[16,16]].map(([x,y])=><circle key={`${x}-${y}`} cx={210+x} cy={165+y} r="5" fill={ink}/>)}
    {step >= 3 && <path d="m194 149 32 32" stroke={orange} strokeWidth="6"/>}{step >= 4 && <path d="m226 149-32 32" stroke={orange} strokeWidth="6"/>}
    {step === 0 && <path d="M140 165h-30m9-8-9 8 9 8" stroke={orange}/>}
    {step >= 1 && step <= 5 && <g transform={`translate(${step === 2 ? 194 : 290} ${step === 2 ? 149 : 110})`}><g className="lesson-moving"><path d="M0 0 32-55Q39-62 36-49Z" fill={paper}/><path d={step === 5 ? 'M36-54Q80-15 45 20Q10 35 15 5Q18-10 45 20' : 'M36-54Q88-40 52 15Q25 55-22 36'} fill="none" stroke={orange}/></g></g>}
    {step === 6 && <Tick/>}
  </>;
}
function DrillScene({ step }: { step: number }) {
  return <>
    <path d="M70 255h280m-250 0v45m220-45v45"/><rect x="95" y="220" width="230" height="28" rx="2" fill="#cfb28c"/><path d="M111 228h45m105 10h42" stroke="#9e7f5a"/>
    {step >= 1 && <path d="M105 208v65h30v-13m170-52v65h-30v-13" strokeWidth="7"/>}
    {step < 6 && <g transform={`translate(210 ${step === 4 ? 130 : 90})`}><g className="lesson-moving"><g transform="rotate(90)"><path d="M-30-18h65v42H0v58h-28v-65h-12Z" fill={orange} stroke={orange}/><path d="M35-10h20v26H35Z" fill={ink}/>{step >= 2 && <path d="M55 3h45m-35-4 8 8m3-8 8 8m3-8 8 8" strokeWidth="3"/>}</g></g></g>}
    {step >= 3 && <path d="m203 210 14 14m0-14-14 14" stroke={orange}/>}
    {step === 3 && <g transform="translate(80 90)"><rect width="35" height="22" rx="6"/><rect x="42" width="35" height="22" rx="6"/><path d="M35 8h7m-42 0-10-7m87 7 10-7"/></g>}
    {step >= 5 && <ellipse cx="210" cy="220" rx="7" ry="3" fill={ink}/>}
    {step === 6 && <Tick/>}
  </>;
}
function Laundry({ step }: { step: number }) {
  if (step >= 5) return <><path d="M90 110h240m-220 0-30 155m230-155 30 155"/><path d="M120 110v100h60V110m60 0v100h60V110" fill={step === 5 ? '#d9e3cf' : paper}/>{step === 6 && <><rect x="145" y="235" width="130" height="15" rx="4" fill="#edd0ba"/><rect x="145" y="252" width="130" height="15" rx="4" fill="#d9e3cf"/><Tick/></>}</>;
  return <>
    <rect x="145" y="65" width="195" height="205" rx="12" fill={paper}/><path d="M145 107h195"/><circle cx="300" cy="86" r="9" fill={step === 4 ? orange : paper}/><path d="M165 83h48"/>
    <circle cx="242" cy="185" r="61" fill="#dae1d1"/><circle cx="242" cy="185" r="49"/>
    {step >= 3 && <g className="lesson-moving"><path d="M209 164h40v21h-40Zm21 26h40v22h-40Z" fill="#d2ad91"/>{step === 4 && <path d="M208 210q-24-35 12-57m-9 2 9-2-1 10" stroke={orange}/>}</g>}
    {step === 0 && <g transform="translate(80 105)"><path d="M0 0h45v65H0Z" fill={paper}/><path d="M10 25v18h25V25m-25 7q6 5 12 0t13 0" stroke={orange}/></g>}
    {step === 1 && <g className="lesson-moving" transform="translate(75 145)"><rect width="42" height="75" rx="6" fill="#edd0ba"/><path d="M8 0v-15h26V0M8 34h26m-20 14h14" stroke={orange}/></g>}
    {step === 2 && <g transform="translate(60 130)"><path d="M0 0h60v90H0Z" fill="#edd0ba"/><path d="M10 18h40v30L30 60 10 48ZM30 65v20" stroke={orange}/></g>}
  </>;
}
function Cooking({ step }: { step: number }) {
  return <>
    <path d="M65 270h290"/><path d="M130 180h160q-8 75-80 75t-80-75Z" fill={paper}/>
    {step >= 2 && <ellipse cx="210" cy="187" rx="66" ry="10" fill="#d3b77c" stroke="none"/>}
    {step === 0 && <g transform="translate(65 70)"><rect width="70" height="90" rx="4" fill={paper}/><path d="M15 20h40m-40 18h40m-40 18h25" stroke={orange}/></g>}
    {step === 1 && <Water x={175} y={105}/>}
    {step === 2 && <g className="lesson-moving" transform="translate(140 100)"><path d="M0 0h45v45H0Zm45 10h12v20H45" fill="#edd0ba"/><path d="M8 15h12m-12 12h12"/></g>}
    {step === 3 && <><path d="M130 168h160m-95-7v-7h30v7" stroke={orange} strokeWidth="5"/><g className="lesson-moving" transform="translate(300 110)"><path d="M0 0h45v60H0l-15-20 15-10m8-30v-12h28V0" fill="#edd0ba"/><path d="M10 13v30"/></g></>}
    {step >= 4 && <g className={step === 4 ? 'lesson-moving' : undefined} fill="#859d73" stroke={ink}>{[0,1,2,3,4].map(i=><circle key={i} cx={(step === 4 ? 90 : 166)+i*22} cy={step === 4 ? 120+(i%2)*25 : 180+(i%2)*8} r="8"/>)}<path d="m270 135 18-10 15 24-18 10Z" fill={orange}/></g>}
    {step === 5 && <g className="lesson-moving"><path d="m240 110-24 72m20-81-8 23m16-20-8 23m16-20-8 23" strokeWidth="4"/></g>}
    {step === 6 && <Tick/>}
  </>;
}
function BikeScene({ step }: { step: number }) {
  const focus = [{x:110,y:215},{x:70,y:200},{x:70,y:200},{x:110,y:215},{x:285,y:120},{x:185,y:220},{x:230,y:105}][step];
  return <>
    <circle cx="110" cy="215" r="62" fill={paper}/><circle cx="305" cy="215" r="62" fill={paper}/><circle cx="110" cy="215" r="51"/><circle cx="305" cy="215" r="51"/>
    <path d="m110 215 52-100 43 100H110l102-75h57l36 75m-100 0 64-75-15-45h30m-138 20h34m-17 0 8 20" strokeWidth="5"/><circle cx="205" cy="215" r="12"/><path d="m205 215 18 17h15m-38-26-13-15"/>
    <circle cx={focus.x} cy={focus.y} r="32" fill="none" stroke={orange} strokeWidth="3" strokeDasharray="5 6"/>
    {[1,2].includes(step) && <g transform="translate(55 155)"><path d="M0 0v100m-20 0h40m-20-85Q55 0 55 60" stroke={orange}/><g className="lesson-moving"><path d="M0 0v-30m-20 0h40" stroke={orange} strokeWidth="5"/></g></g>}
    {step === 4 && <path className="lesson-moving" d="m288 98-12 13m-2 70h30m-20-8-10 8 10 8" stroke={orange} strokeWidth="4"/>}
    {step === 5 && <path d="M110 208h95m-95 14h95" stroke={orange} strokeWidth="3"/>}
    {step === 6 && <Tick x={330} y={85}/>}
  </>;
}

export function LessonArtwork({ skill, step, replay }: { skill: SkillId; step: number; replay: number }) {
  if (skill === 'tie') return <TieMotion step={step} replay={replay}/>;
  return <SkillMotion key={skill} skill={skill} step={step} replay={replay}/>;
}

function SkillMotion({ skill, step, replay }: { skill: Exclude<SkillId,'tie'>; step: number; replay: number }) {
  const svg = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const node = svg.current;
    if (!node) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const animations: Animation[] = [];
    if (!preference.matches) {
      const scene = node.querySelector('.lesson-scene');
      if (scene) animations.push(scene.animate([{opacity:.4},{opacity:1}],{duration:1100,easing:'ease-out'}));
      node.querySelectorAll('.lesson-moving').forEach(element => {
        animations.push(element.animate([{transform:'translateY(-18px)'},{transform:'translateY(0)'}], {duration:1100,easing:'cubic-bezier(.45,0,.2,1)'}));
      });
    }
    let visible = false;
    const sync = () => animations.forEach(animation => {
      if (preference.matches) animation.finish();
      else if (animation.playState !== 'finished') visible && !document.hidden ? animation.play() : animation.pause();
    });
    sync();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(node);
    document.addEventListener('visibilitychange',sync);
    preference.addEventListener('change',sync);
    return () => { animations.forEach(animation=>animation.cancel()); observer.disconnect(); document.removeEventListener('visibilitychange',sync); preference.removeEventListener('change',sync); };
  },[step,replay]);
  return <svg ref={svg} className="skill-motion" data-skill={skill} data-step={step+1} viewBox="0 0 420 340" role="img" aria-label={`Step ${step+1}: ${modules[skill].steps[step].title}`} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <g className="lesson-scene">{skill === 'shaving' ? <Face step={step} beard={false}/> : skill === 'beard' ? <Face step={step} beard/> : skill === 'ironing' ? <Ironing step={step}/> : skill === 'button' ? <ButtonScene step={step}/> : skill === 'drill' ? <DrillScene step={step}/> : skill === 'laundry' ? <Laundry step={step}/> : skill === 'cooking' ? <Cooking step={step}/> : <BikeScene step={step}/>}</g>
  </svg>;
}

