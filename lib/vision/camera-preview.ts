import type { FocusBox } from './coaching-focus';
/** Coordinates in the complete raw image; preview mirroring never changes API coordinates. */
export function previewGeometry(videoWidth:number,videoHeight:number,width:number,height:number) {
 const scale=Math.min(width/videoWidth,height/videoHeight);
 return {left:(width-videoWidth*scale)/2,top:(height-videoHeight*scale)/2,width:videoWidth*scale,height:videoHeight*scale};
}
export function previewPoint(x:number,y:number,g:ReturnType<typeof previewGeometry>,mirrored:boolean) {return {x:g.left+(mirrored?1-x:x)*g.width,y:g.top+y*g.height};}
export function captureCameraFrame(video:HTMLVideoElement) {
 if(video.readyState<2||!video.videoWidth||!video.videoHeight)throw new Error('frame');
 const scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
 const context=canvas.getContext('2d');if(!context)throw new Error('frame');
 context.drawImage(video,0,0,canvas.width,canvas.height);
 const image=canvas.toDataURL('image/jpeg',.65);canvas.width=0;canvas.height=0;return image;
}
export function objectGuide(kind:'tie'|'razor'):FocusBox {return kind==='tie'?{x:.36,y:.12,w:.28,h:.76}:{x:.32,y:.18,w:.36,h:.64};}
export const objectOutlines={tie:[[.35,0],[.65,0],[.70,.10],[.58,.22],[.76,.86],[.5,1],[.24,.86],[.42,.22],[.30,.10]],razor:[[.08,.05],[.92,.05],[.92,.25],[.62,.25],[.56,.95],[.44,.95],[.38,.25],[.08,.25]]} as const;
