// Speeds are expressed in simulated days per real second.
export const MINUTE_PER_SECOND=1/1440;
export const REAL_TIME=1/86400;
export const playbackSpeeds=[-100,-10,-1,REAL_TIME,MINUTE_PER_SECOND,0.0416666667,1,10,30,100,365];
export function speedLabel(speed:number){return speed===MINUTE_PER_SECOND?'1 min / sec':Math.abs(speed-REAL_TIME)<1e-15?'Real time':speed===0.0416666667?'1 hour / sec':`${speed} days / sec`;}
