import type { Frame, Box } from './object-tracker';
export function scanQuality(frame:Frame,box:Box) {
 let sum=0,square=0,n=0;
 for(let y=Math.max(0,Math.floor(box.y));y<Math.min(frame.height,box.y+box.h);y+=2)for(let x=Math.max(0,Math.floor(box.x));x<Math.min(frame.width,box.x+box.w);x+=2){const i=(y*frame.width+x)*4,value=(frame.data[i]+frame.data[i+1]+frame.data[i+2])/3;sum+=value;square+=value*value;n++;}
 const mean=n?sum/n:0,contrast=Math.sqrt(Math.max(0,n?square/n-mean*mean:0));return mean>25&&mean<248&&contrast>3;
}
export function scanMotion(a:Frame,b:Frame,box:Box) {
 if(a.width!==b.width||a.height!==b.height)return 1;
 let total=0,n=0;for(let y=Math.max(0,Math.floor(box.y));y<Math.min(a.height,box.y+box.h);y+=2)for(let x=Math.max(0,Math.floor(box.x));x<Math.min(a.width,box.x+box.w);x+=2){const i=(y*a.width+x)*4;for(let c=0;c<3;c++){total+=Math.abs(a.data[i+c]-b.data[i+c]);n++;}}
 return n?total/(n*255):1;
}
