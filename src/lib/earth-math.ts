import {DAY} from './ephemeris';
export const EARTH_RADIUS_METRES=6371000;
export const CLOUD_RADIUS=1+12000/EARTH_RADIUS_METRES;
export const ATMOSPHERE_RADIUS=1+160000/EARTH_RADIUS_METRES;
export const EARTH_LEVELS=[64,128,256,512] as const;
export function earthDetailLevel(diameterPixels:number,previous=0){
 const thresholds=[80,600,1800];let level=previous;
 while(level<3&&diameterPixels>thresholds[level]*1.08)level++;
 while(level>0&&diameterPixels<thresholds[level-1]*0.88)level--;
 return level;
}
export function earthTextureResolution(maxTextureSize:number,deviceMemory=4,views=1){
 if(views>=4)return Math.min(2048,maxTextureSize);
 return maxTextureSize>=8192&&deviceMemory>=8&&views<=2?8192:Math.min(4096,maxTextureSize);
}
export function cloudAnimation(time:number):[number,number]{
 const days=(time-Date.UTC(2000,0,1))/DAY;
 return [((days/30)%1+1)%1,((days/12)%1+1)%1*2*Math.PI];
}
/** Positive ray/sphere interval in Earth-radius units; usable inside the shell. */
export function raySphere(origin:number[],direction:number[],radius:number):[number,number]|null{
 const b=origin.reduce((s,v,i)=>s+v*direction[i],0),c=origin.reduce((s,v)=>s+v*v,0)-radius*radius,d=b*b-c;
 if(d<0)return null;const t=Math.sqrt(d);if(-b+t<0)return null;
 return [Math.max(0,-b-t),-b+t];
}
