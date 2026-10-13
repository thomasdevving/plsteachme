import { describe, it, expect } from 'vitest';
import { waitlistSchema, attributionSchema, voteSchema, orgSchema, followupSchema } from '../lib/validation';
import { allow } from '../lib/rate-limit';
import { pageFromSlug, pathFor, skillIds } from '../lib/config';
const attribution = { language:'nl' as const, utm_source:'tiktok', referral:'abc123', landing_path:'/' };
const signup = { age:'18-24', email:'USER@example.com', consent:true, skills:['tie'], attribution };
describe('privacy and form boundary', () => {
 it('accepts every displayed module in a signup and rejects unknown votes', () => { expect(waitlistSchema.safeParse({...signup,skills:[...skillIds,'other']}).success).toBe(true); for(const skill of skillIds) expect(voteSchema.safeParse({skill,over16:true}).success).toBe(true); expect(voteSchema.safeParse({skill:'unknown',over16:true}).success).toBe(false); });
 it('strips ALL identifying data from the under-16 path, including malicious extra fields', () => { const result = waitlistSchema.parse({ ...signup, age:'under16', other:'sensitive', attribution:{...attribution,utm_source:'child'} }); expect(result).toEqual({age:'under16',website:''}); expect(JSON.stringify(result)).not.toContain('example.com'); });
 it('requires consent and a valid age for adult signup', () => { expect(waitlistSchema.safeParse({...signup,consent:false}).success).toBe(false); expect(waitlistSchema.safeParse({...signup,age:'15'}).success).toBe(false); });
 it('rejects malformed email, unbounded input and unknown skills', () => { expect(waitlistSchema.safeParse({...signup,email:'bad'}).success).toBe(false); expect(waitlistSchema.safeParse({...signup,other:'x'.repeat(501)}).success).toBe(false); expect(waitlistSchema.safeParse({...signup,skills:['unknown']}).success).toBe(false); });
 it('normalizes email and retains bounded attribution', () => { const data = waitlistSchema.parse(signup); expect('email' in data && data.email).toBe('user@example.com'); expect('attribution' in data && data.attribution.utm_source).toBe('tiktok'); });
 it('rejects arbitrary referral text and non-consenting votes', () => { expect(attributionSchema.safeParse({...attribution,referral:'<script>'}).success).toBe(false); expect(voteSchema.safeParse({skill:'tie',over16:false}).success).toBe(false); });
 it('requires complete pilot details and consent', () => { expect(orgSchema.safeParse({name:'Thomas',organization:'School',email:'teacher@example.com',consent:true,attribution}).success).toBe(false); });
 it('bounds follow-up input', () => { expect(followupSchema.safeParse({answer:''}).success).toBe(false); expect(followupSchema.safeParse({answer:'x'.repeat(1001)}).success).toBe(false); });
});
describe('rate limiting and routing', () => {
 it('allows ten requests then denies, and resets after ten minutes', () => { const key='test-bucket'; for(let i=0;i<10;i++) expect(allow(key,1000)).toBe(true); expect(allow(key,1000)).toBe(false); expect(allow(key,601001)).toBe(true); });
 it('maps all translated routes and rejects unexpected pages', () => { for (const locale of ['nl','en'] as const) for (const page of ['home','organizations','demo','privacy','thanks'] as const) { const path=pathFor(locale,page).replace(/^\/en/, ''); expect(pageFromSlug(locale,path.split('/').filter(Boolean))).toBe(page); } expect(pageFromSlug('nl',['missing'])).toBe(null); });
});
