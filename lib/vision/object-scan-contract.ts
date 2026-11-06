import { z } from 'zod';
import { focusBoxSchema, type FocusBox } from './coaching-focus';
export const objectScanFields={frames:z.array(z.string().max(270000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)).length(2),guide:focusBoxSchema};
export const objectScanResultSchema=z.object({recognized:z.boolean(),box:focusBoxSchema.nullable(),guidance:z.string().max(220)}).strict();
export type ObjectScanResult=z.infer<typeof objectScanResultSchema>;
/** A loose framing check, not exact silhouette matching. Designs and proportions vary. */
export function inObjectGuide(box:FocusBox,guide:FocusBox) {
 const cx=box.x+box.w/2,cy=box.y+box.h/2;
 const overlap=Math.max(0,Math.min(box.x+box.w,guide.x+guide.w)-Math.max(box.x,guide.x))*Math.max(0,Math.min(box.y+box.h,guide.y+guide.h)-Math.max(box.y,guide.y));
 return cx>=guide.x-guide.w*.2&&cx<=guide.x+guide.w*1.2&&cy>=guide.y-guide.h*.2&&cy<=guide.y+guide.h*1.2&&overlap/(box.w*box.h)>=.4&&box.w*box.h>=guide.w*guide.h*.06;
}
