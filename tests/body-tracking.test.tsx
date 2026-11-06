// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { LandmarkFrame } from '../lib/vision/prechecks';
const state=vi.hoisted(()=>({start:vi.fn(),stop:vi.fn()}));
vi.mock('@/lib/vision/landmark-loop',()=>({startLandmarkLoop:state.start}));
import { BodyTracking } from '../components/body-tracking';
const ctx={setTransform:vi.fn(),clearRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),arc:vi.fn(),fill:vi.fn()};
beforeEach(()=>{vi.stubGlobal('React',React);vi.clearAllMocks();state.start.mockReturnValue(state.stop);vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('draws only visible body landmarks and clears them when tracking stops',()=>{
 const video=document.createElement('video'),canvas=document.createElement('canvas');Object.defineProperty(video,'videoWidth',{value:640});Object.defineProperty(video,'videoHeight',{value:480});Object.defineProperty(canvas,'clientWidth',{value:800});Object.defineProperty(canvas,'clientHeight',{value:400});
 const props={video:{current:video},overlay:{current:canvas},active:true,mirrored:true};const view=render(<BodyTracking {...props}/>);
 const frame:LandmarkFrame={time:0,pose:Array.from({length:33},()=>({x:.3,y:.4,visibility:.9})),hands:[],luminance:100,ambiguous:false,aspect:4/3};
 act(()=>state.start.mock.calls[0][1]([],frame));expect(ctx.stroke.mock.calls.length).toBeGreaterThan(10);expect(screen.getByRole('status').textContent).toContain('You can move naturally');
 const strokes=ctx.stroke.mock.calls.length;act(()=>state.start.mock.calls[0][1]([],{...frame,ambiguous:true}));expect(ctx.stroke).toHaveBeenCalledTimes(strokes);expect(screen.getByRole('status').textContent).toContain('one person');
 view.rerender(<BodyTracking {...props} active={false}/>);expect(state.stop).toHaveBeenCalled();expect(ctx.clearRect).toHaveBeenCalled();
});
