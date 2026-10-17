import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { type Page } from '@/lib/config';
import { getCopy } from '@/lib/i18n';
export async function GET(req: NextRequest) {
  const c = getCopy(req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'nl');
  const raw = req.nextUrl.searchParams.get('page'); const page: Page = raw === 'organizations' || raw === 'demo' || raw === 'privacy' || raw === 'thanks' || raw === 'learn' || raw === 'community' || raw === 'teach' ? raw : 'home';
  const title = { home:c.hero.title, organizations:c.org.title, demo:c.demo.videoLabel, privacy:c.legal.title, thanks:c.thanks.title,learn:'Your next practical skill.',community:'Skills shaped by you.',teach:'Share what you know.' }[page];
  return new ImageResponse(<div style={{background:'#faf7f2',color:'#22372c',width:'100%',height:'100%',display:'flex',padding:'70px',flexDirection:'column',justifyContent:'space-between'}}><div style={{display:'flex',fontSize:36,fontWeight:700}}><span>plsteach</span><span style={{color:'#bb4827'}}>.me</span></div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:60}}><div style={{fontSize:68,lineHeight:1.1,maxWidth:800,letterSpacing:-2}}>{title}</div><svg width="120" height="230" viewBox="0 0 64 100" fill="none" stroke="#bb4827" strokeWidth="3"><path d="M18 5h28l-6 18H24L18 5Zm6 18-9 59 17 13 17-13-9-59"/><path d="m22 37 22 20M19 59l26 20"/></svg></div><div style={{display:'flex',fontSize:25,color:'#5e685e'}}>{c.hero.early} · {c.hero.sub}</div></div>, { width:1200, height:630, headers:{ 'Cache-Control':'public, max-age=86400' } });
}
