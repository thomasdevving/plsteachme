const buckets = new Map<string, { count: number; until: number }>();
export function allow(key: string, now = Date.now()) {
  for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket) { if (buckets.size >= 10000) return false; buckets.set(key, { count: 1, until: now + 600000 }); return true; }
  if (bucket.count >= 10) return false;
  bucket.count++; return true;
}
