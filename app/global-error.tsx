'use client';
// Last-resort error screen when the root layout itself fails. It cannot rely on the
// site's stylesheets, so it carries its own minimal styling.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
 return <html lang="en"><body style={{margin:0,minHeight:'100vh',display:'grid',placeItems:'center',background:'#faf7f2',color:'#22372c',fontFamily:'system-ui,sans-serif',padding:24}}>
  <main style={{maxWidth:520,textAlign:'center'}}><h1 style={{fontWeight:600,fontSize:32}}>Something went wrong.</h1><p style={{lineHeight:1.6}}>plsteach.me could not load. Please try again in a moment.{error.digest ? ` (Reference ${error.digest})` : ''}</p>
  <button onClick={reset} style={{background:'#bb4827',color:'#fffaf4',border:0,borderRadius:7,padding:'13px 22px',fontSize:16,fontWeight:600,cursor:'pointer'}}>Try again</button></main></body></html>;
}
