import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MissionAudioPlayer,type MissionAudioElement} from '../src/lib/mission-audio';
import {startMission,seekMission,missionById,validateMissionDocument} from '../src/lib/mission';
import {defaultSimulationState} from '../src/lib/simulation-state';
class AudioStub implements MissionAudioElement{
 volume=1;muted=false;playbackRate=1;paused=true;ended=false;onerror:(()=>void)|null=null;plays=0;
 async play(){this.plays++;this.paused=false;}pause(){this.paused=true;}
}
test('archival audio is optional, pauses, uses original speech speed and resets on chapter seek',async()=>{
 const clips:AudioStub[]=[],errors:string[]=[];const player=new MissionAudioPlayer(()=>{const a=new AudioStub();clips.push(a);return a;},e=>errors.push(e));
 const m={...startMission(defaultSimulationState(),'apollo-11').mission!,playing:true};player.sync(m);assert.equal(clips.length,1);assert.equal(clips[0].plays,1);assert.equal(clips[0].muted,true);
 player.sync({...m,audioEnabled:true,rate:2,audioVolume:.4});assert.equal(clips[0].plays,1);assert.equal(clips[0].muted,false);assert.equal(clips[0].playbackRate,1);assert.equal(clips[0].volume,.4);await Promise.resolve();
 player.sync({...m,audioEnabled:false});assert.equal(clips[0].muted,true);assert.equal(clips[0].paused,false);assert.equal(clips[0].plays,1);
 player.sync({...m,audioEnabled:true});assert.equal(clips[0].muted,false);assert.equal(clips[0].plays,1);
 player.sync({...m,playing:false,audioEnabled:true});assert.equal(clips[0].paused,true);
 player.sync({...m,elapsed:20,audioEnabled:true});await Promise.resolve();player.sync({...m,elapsed:0,audioEnabled:true});assert.equal(clips.length,2);assert.equal(clips[0].paused,true);
 player.sync(seekMission(m,6));assert.equal(clips[1].paused,true);assert.equal(clips.length,2);
 player.sync({...seekMission(m,10),playing:true,audioEnabled:true});assert.equal(clips.length,3);clips[2].onerror?.();assert.equal(errors.at(-1),'Recording unavailable');player.dispose();assert.equal(clips[2].paused,true);
});
test('chapter audio cues include attribution and actual MP3 assets',()=>{
 const doc=missionById.get('apollo-11')!;for(const c of doc.chapters)for(const cue of c.media??[]){assert.equal(cue.kind,'audio');assert.ok(cue.credit.includes('NASA'));assert.ok(readFileSync(`public${cue.url}`).length>20000);}
 const invalid=structuredClone(doc);invalid.chapters[0].media![0].url='https://untrusted.invalid/file';assert.throws(()=>validateMissionDocument(invalid));
});
