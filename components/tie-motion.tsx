/** A simplified wrap, drawn as geometry so the fabric itself can move. */
export function TieMotion() {
  return <svg className="tie-motion" viewBox="0 0 420 340" role="img" aria-label="A simplified animated example of wrapping the wide end of a tie">
    <g fill="none" stroke="#909d85" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M161 40 162 71Q130 86 88 105Q65 116 60 151L47 319M258 40 257 71Q291 86 331 105Q355 116 361 151L374 319"/><path d="M162 71 139 92 166 126 192 91M257 71 279 92 253 126 226 91M162 71Q207 98 257 71"/></g>
    <path d="M209 161V316" stroke="#c9d0bd" strokeWidth="2" strokeDasharray="3 7"/>
    <path d="m204 108 9 149 14 15 12-18-9-143" fill="#ded5c3" stroke="#52614f"/>
    <path className="tie-wide-end" d="M202 126C192 155 183 202 164 257L183 281L205 261C208 209 219 164 221 135Z" fill="#bb4827"/>
    <path d="m208 111 31 17-9 23-34-18Z" fill="#bb4827"/>
    <path className="tie-guide" d="M269 165Q223 205 158 186m11-7-11 7 10 8" fill="none" stroke="#7b442f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1"/>
  </svg>;
}
