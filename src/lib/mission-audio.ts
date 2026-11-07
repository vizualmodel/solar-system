import {missionById,type MissionState} from './mission';
export interface MissionAudioElement {volume:number;muted:boolean;playbackRate:number;paused:boolean;ended:boolean;onerror:OnErrorEventHandler;play():Promise<void>;pause():void;}
/** One recording for the whole mission, independent of how many cameras are open. */
export class MissionAudioPlayer{
 private audio?:MissionAudioElement;private chapter=-1;private elapsed=0;private pending=false;private generation=0;
 constructor(private create:(url:string)=>MissionAudioElement,private error:(text:string)=>void){}
 sync(m:MissionState){
  const cue=missionById.get(m.id)!.chapters[m.chapter].media?.find(c=>c.kind==='audio');
  if(m.chapter!==this.chapter||m.elapsed<this.elapsed-.1){this.dispose();this.chapter=m.chapter;this.error('');if(cue){this.audio=this.create(cue.url);this.audio.onerror=()=>this.error('Recording unavailable');}}
  this.elapsed=m.elapsed;const a=this.audio;if(!a)return;a.volume=m.audioVolume??.7;a.muted=!m.audioEnabled;a.playbackRate=1;
  // Muting silences the recording without losing its place in the running story.
  if(m.playing){if(a.paused&&!a.ended&&!this.pending){this.pending=true;const generation=this.generation;void a.play().catch(()=>{if(this.generation===generation)this.error('Recording playback blocked by browser');}).finally(()=>{if(this.generation===generation)this.pending=false;});}}else a.pause();
 }
 dispose(){this.generation++;this.audio?.pause();if(this.audio)this.audio.onerror=null;this.audio=undefined;this.pending=false;}
}
