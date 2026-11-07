<script lang="ts">
 import {simulationState} from '../lib/store';
 import {missionCaption,missionById,missionElapsed,formatMissionElapsed} from '../lib/mission';
 import {missionTelemetry} from '../lib/mission-telemetry';
 import type {MissionContext} from '../lib/mission-flight';
 let {context}:{context:MissionContext}=$props();
 const m=$derived($simulationState.mission!);
 const chapter=$derived(missionById.get(m.id)!.chapters[m.chapter]);
 const t=$derived(missionTelemetry(context,m));
 const number=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:1,minimumFractionDigits:1});
</script>
<section class="dashboard" aria-label="Apollo flight dashboard">
 <div class="instrument"><span>EARTH RELATIVE VELOCITY</span><svg viewBox="0 0 180 105" role="img" aria-label={`Earth relative speed ${number(t.speed)} kilometres per second`}><path d="M20 88 A70 70 0 0 1 160 88" fill="none" stroke="#a49d85" stroke-width="2"/>{#each [0,2,4,6,8,10,12] as n}<g transform={`rotate(${n/12*180-90} 90 88)`}><path d="M90 18v9" stroke="#e4d9be"/><text x="90" y="40" text-anchor="middle" fill="#cec6b1" font-size="9">{n}</text></g>{/each}<path d="M90 91V24" stroke="#f3ebe0" stroke-width="2" transform={`rotate(${Math.min(1,t.speed/12)*180-90} 90 88)`}/><circle cx="90" cy="88" r="5" fill="#b9b6a8"/></svg><strong>{number(t.speed)} <small>KM/S</small></strong></div>
 <div class="readouts"><span>MISSION ELAPSED TIME</span><output>{formatMissionElapsed(missionElapsed(m))}</output><div><label>EARTH ALTITUDE<output>{number(t.earthAltitude)} <small>KM</small></output></label><label>MOON ALTITUDE<output>{number(t.moonAltitude)} <small>KM</small></output></label></div><small>RECONSTRUCTED FLIGHT · ESTIMATED READINGS</small></div>
 <div class="caption" aria-label="Mission caption"><span>FLIGHT DIRECTOR · CHAPTER {m.chapter+1}</span><h2>{chapter.title}</h2><p>{missionCaption(m)}</p><small>Apollo-inspired instruments · distances above spherical surfaces</small></div>
</section>
<style>
 .dashboard{display:flex;flex-shrink:0;gap:22px;padding:12px 20px;background:linear-gradient(#252927,#151a19);border:2px solid #5c6259;border-radius:5px;color:#e4decc;box-shadow:inset 0 0 12px #0008;font-family:monospace}.instrument{width:160px;flex-shrink:0;text-align:center;background:#111613;border:5px solid #343b35;border-radius:14px;padding:8px}.instrument span,.readouts>span,.caption>span{font-size:9px;letter-spacing:1.5px}.instrument svg{width:140px;display:block;margin:auto}.instrument strong{font-size:19px;font-weight:400}.instrument small,output small{font-size:10px}.readouts{min-width:235px;display:flex;flex-direction:column;justify-content:center;gap:8px}.readouts output{display:block;color:#b8f2b6;background:#08120c;padding:7px;border:1px solid #62705b;font-size:22px;letter-spacing:2px}.readouts>div{display:flex;gap:10px}.readouts label{font-size:8px;flex:1}.readouts label output{font-size:14px;letter-spacing:0;margin-top:5px}.readouts>small,.caption>small{font-size:8px;color:#9aa396}.caption{max-width:800px;align-self:center}.caption h2{font:500 19px system-ui;margin:8px 0}.caption p{font:13px/1.6 system-ui;margin:8px 0}.caption>span{color:#d6b886}@media(max-width:1000px){.instrument{display:none}.dashboard{gap:15px;padding:12px}.readouts{min-width:210px}.caption p{font-size:11px}}@media(max-height:700px){.dashboard{padding:8px 14px}.instrument{display:none}.caption h2{font-size:15px}.caption p{font-size:11px;margin:4px 0}}
</style>
