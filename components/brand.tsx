import Image from 'next/image';
/** One optical lockup: the guiding hands sit at the same scale as the lettering. */
export function BrandMark() {
  return <span className="brand-lockup"><span className="brand-symbol" aria-hidden="true"><Image className="brand-logo" src="/brand/hands-filled.png" width={44} height={44} loading="eager" alt=""/></span><span className="brand-name"><span className="brand-teach">plsteach</span><span className="brand-me">.me</span></span></span>;
}
