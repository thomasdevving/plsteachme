import type { LandmarkFrame, Point } from './prechecks';
export const bodyConnections=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]] as const;
export function drawableJoint(point?:Point) {return !!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&(point.visibility??0)>=.55&&point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1;}
export function visibleBody(frame:LandmarkFrame) {
 if(frame.ambiguous)return {lines:[] as {from:Point;to:Point}[],ready:false};
 const lines=bodyConnections.flatMap(([a,b])=>drawableJoint(frame.pose[a])&&drawableJoint(frame.pose[b])?[{from:frame.pose[a],to:frame.pose[b]}]:[]);
 return {lines,ready:[11,12,23,24,25,26].every(index=>drawableJoint(frame.pose[index]))};
}
