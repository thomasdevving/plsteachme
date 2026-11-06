import type { SkillId } from '../config';
export const cameraGuidanceModes=['scene','tie','razor','body'] as const;
export type CameraGuidance=typeof cameraGuidanceModes[number];
export type GuidedObject='tie'|'razor';
export const cameraGuidanceLabels:Record<CameraGuidance,string>={scene:'Full camera view',tie:'Tie outline + recognition',razor:'Razor outline + recognition',body:'Body movement + joint lines'};
export const builtinCameraGuidance:Record<SkillId,CameraGuidance>={tie:'tie',shaving:'razor',beard:'scene',ironing:'scene',button:'scene',drill:'scene',laundry:'scene',cooking:'scene',bike:'scene'};
export const guidedObject=(mode:CameraGuidance|undefined):GuidedObject|null=>mode==='tie'||mode==='razor'?mode:null;
