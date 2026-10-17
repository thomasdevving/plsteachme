// @vitest-environment jsdom
import { beforeEach,afterEach,expect,it,vi } from 'vitest';
const database=vi.hoisted(()=>({clear:vi.fn()}));
vi.mock('idb-keyval',()=>({createStore:()=>({}),clear:database.clear,get:vi.fn(),set:vi.fn(),del:vi.fn(),entries:vi.fn(),update:vi.fn()}));
import { deleteMyData } from '../lib/storage/store';
const keys=['plsteach.learning.v1','plsteach.published-progress.v1.example.1','plsteach:attribution','plsteach.auth.v1','plsteach.me:lesson:tie-four-in-hand','plsteach-motion-paused'];
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.resetAllMocks();database.clear.mockResolvedValue(undefined);for(const area of [localStorage,sessionStorage]){for(const key of keys)area.setItem(key,'fixture');area.setItem('unrelated-preference','keep');}});
afterEach(()=>vi.restoreAllMocks());
it('clears all app progress, preferences and evaluation data while retaining unrelated data',async()=>{
 const events=vi.spyOn(window,'dispatchEvent');document.documentElement.dataset.motionPaused='true';
 await deleteMyData();expect(database.clear).toHaveBeenCalledOnce();
 for(const area of [localStorage,sessionStorage]){expect(Object.keys(area)).toEqual(['unrelated-preference']);expect(area.getItem('unrelated-preference')).toBe('keep');}
 expect(document.documentElement.dataset.motionPaused).toBe('false');
 expect(events.mock.calls.map(([event])=>event.type)).toEqual(['plsteach-progress-change','plsteach:motion-preference']);
});
it('still clears browser progress if IndexedDB fails and reports partial deletion',async()=>{
 database.clear.mockRejectedValue(new Error('unavailable'));
 await expect(deleteMyData()).rejects.toThrow('Some local data could not be deleted');
 expect(Object.keys(localStorage)).toEqual(['unrelated-preference']);expect(Object.keys(sessionStorage)).toEqual(['unrelated-preference']);
});
it('still clears local storage when access to session storage is blocked',async()=>{
 vi.spyOn(window,'sessionStorage','get').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
 await expect(deleteMyData()).rejects.toThrow('Some local data could not be deleted');
 expect(Object.keys(localStorage)).toEqual(['unrelated-preference']);expect(database.clear).toHaveBeenCalledOnce();
});
