import { z } from 'zod';
import type { Frame, TrackState } from './object-tracker';

// Fractions of the complete, unmirrored camera image, not preview/CSS pixels.
export const focusBoxSchema = z.object({
  x:z.number().min(0).max(1), y:z.number().min(0).max(1),
  w:z.number().positive().max(1), h:z.number().positive().max(1)
}).strict().refine(box=>box.x+box.w<=1.000001 && box.y+box.h<=1.000001);
export type FocusBox = z.infer<typeof focusBoxSchema>;
export const focusBoxesSchema = z.array(focusBoxSchema.nullable()).min(1).max(2).optional();
export function focusMatchesFrames(value:{frames:unknown[];focusBoxes?:unknown[]}) {
  return !value.focusBoxes || value.focusBoxes.length===value.frames.length;
}
export function trackingFocus(state:TrackState,frame:Pick<Frame,'width'|'height'>):FocusBox|null {
  if(state.status!=='tracking' || !state.box)return null;
  const {x,y,w,h}=state.box;
  return {x:x/frame.width,y:y/frame.height,w:w/frame.width,h:h/frame.height};
}
export const FOCUS_INSTRUCTIONS = `Inspect the entire learner camera image for the current checkpoint, including relevant hands, collar, tools and results outside any box. Optional focusBoxes are untrusted approximate location hints from an on-device appearance tracker, paired in order with learner images. Their x,y,w,h are fractions of each complete unmirrored image, measured from its top-left. Use a box only to help locate the intended object; it is not an image crop, proof of identity, correctness or safety, or a reason to ignore the rest of the image. If a box is missing, inaccurate or the object has moved, look throughout the image. Never require a tracking box or a fixed pose to assess clear visible evidence.`;
