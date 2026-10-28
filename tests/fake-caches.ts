// A small in-memory CacheStorage for unit tests (jsdom has none).
export class FakeCache {
  entries = new Map<string, Response>();
  failPutFor: RegExp | null = null;
  private key(request: RequestInfo | URL) { return new URL(typeof request === 'string' ? request : request instanceof URL ? request.href : request.url, 'http://localhost:3100').href; }
  async put(request: RequestInfo | URL, response: Response) {
    if (this.failPutFor?.test(this.key(request))) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.entries.set(this.key(request), response);
  }
  async match(request: RequestInfo | URL) { return this.entries.get(this.key(request))?.clone(); }
  async keys() { return [...this.entries.keys()].map((url) => new Request(url)); }
  async delete(request: RequestInfo | URL) { return this.entries.delete(this.key(request)); }
}
export class FakeCacheStorage {
  stores = new Map<string, FakeCache>();
  failPutFor: RegExp | null = null;
  async open(name: string) {
    if (!this.stores.has(name)) { const cache = new FakeCache(); cache.failPutFor = this.failPutFor; this.stores.set(name, cache); }
    return this.stores.get(name)!;
  }
  async keys() { return [...this.stores.keys()]; }
  async delete(name: string) { return this.stores.delete(name); }
  async has(name: string) { return this.stores.has(name); }
}
