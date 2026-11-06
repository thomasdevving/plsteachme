import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const source=vi.hoisted(()=>({create:vi.fn(),detect:vi.fn()}));
vi.mock('../lib/vision/mediapipe',()=>({createLandmarker:source.create}));
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();source.detect.mockReset();source.create.mockReset();source.detect.mockReturnValue({time:0,pose:[],hands:[],luminance:100,ambiguous:false});source.create.mockResolvedValue({detect:source.detect,close:vi.fn()});});
afterEach(()=>vi.useRealTimers());
const video=()=>({readyState:4,paused:false,videoWidth:640,videoHeight:480} as HTMLVideoElement);
it('shares one video inference between consumers and stops when the last consumer leaves',async()=>{
 const {startLandmarkLoop}=await import('../lib/vision/landmark-loop');const v=video(),a=vi.fn(),b=vi.fn();
 const stopA=startLandmarkLoop(v,a,100),stopB=startLandmarkLoop(v,b,100);
 await vi.advanceTimersByTimeAsync(1);
 expect(source.create).toHaveBeenCalledTimes(1);expect(source.detect).toHaveBeenCalledTimes(1);expect(a).toHaveBeenCalledTimes(1);expect(b).toHaveBeenCalledTimes(1);
 stopA();await vi.advanceTimersByTimeAsync(110);expect(a).toHaveBeenCalledTimes(1);expect(b).toHaveBeenCalledTimes(2);
 stopB();const count=source.detect.mock.calls.length;await vi.advanceTimersByTimeAsync(1000);expect(source.detect).toHaveBeenCalledTimes(count);
});
it('can retry a failed model load while another subscriber is still attached',async()=>{
 source.create.mockRejectedValueOnce(new Error('unavailable'));
 const {startLandmarkLoop}=await import('../lib/vision/landmark-loop');const v=video(),failed=vi.fn(),a=vi.fn(),b=vi.fn();
 const stopA=startLandmarkLoop(v,a,100,failed);await vi.advanceTimersByTimeAsync(1);expect(failed).toHaveBeenCalledTimes(1);
 const stopB=startLandmarkLoop(v,b,100);await vi.advanceTimersByTimeAsync(1);
 expect(source.create).toHaveBeenCalledTimes(2);expect(a).toHaveBeenCalledTimes(1);expect(b).toHaveBeenCalledTimes(1);stopA();stopB();
});

it('does not infer the same stalled video frame repeatedly',async()=>{
 const {startLandmarkLoop}=await import('../lib/vision/landmark-loop');const v=video();Object.defineProperty(v,'currentTime',{value:0,writable:true});const listener=vi.fn();
 const stop=startLandmarkLoop(v,listener,100);await vi.advanceTimersByTimeAsync(501);expect(source.detect).toHaveBeenCalledTimes(1);
 v.currentTime=.2;await vi.advanceTimersByTimeAsync(101);expect(source.detect).toHaveBeenCalledTimes(2);stop();
});
