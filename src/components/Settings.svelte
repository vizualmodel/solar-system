<script lang="ts">
 import { X,Eye,Camera } from 'lucide-svelte';
 import SettingsSection from './SettingsSection.svelte';
 import SatelliteSettings from './SatelliteSettings.svelte';
 import ObjectInfoButton from './ObjectInfoButton.svelte';
 import { simulationState,updateView } from '../lib/store';
 import { workspaceUi } from '../lib/workspace-ui';
 import { bodies,byId,displayBodies } from '../lib/catalog';
 import { focus } from '../lib/focus';
 import { changeTracking } from '../lib/presentation';
 import type { Vec3 } from '../lib/ephemeris';
 let {onclose,positions}:{onclose:()=>void;positions:Record<string,Vec3>}=$props();
 const view=$derived($simulationState.views.find(v=>v.id===$simulationState.active)!);
 const focusId=$derived(view.satelliteFocus??view.focus);

 const patch=(p:Parameters<typeof updateView>[1])=>updateView(view.id,p);
 function toggle(id:string){patch({visible:view.visible.includes(id)?view.visible.filter(x=>x!==id):[...view.visible,id]});}
</script>
<aside class="panel settings-panel">
 <div class="panel-heading"><div><span class="eyebrow">YOUR OBSERVATORY</span><h2>View settings</h2></div><button aria-label="Close settings" onclick={onclose}><X size={18}/></button></div>
 <div class="selected-view"><span class="live-dot"></span>VIEW {String($simulationState.views.findIndex(v=>v.id===view.id)+1).padStart(2,'0')}<span>{byId[focusId].name==='Sun'?'Solar system':byId[focusId].name}</span></div>
 <div class="tabs"><button class:selected={$workspaceUi.tab==='scene'} onclick={()=>$workspaceUi.tab='scene'}><Eye size={14}/> Display</button><button class:selected={$workspaceUi.tab==='camera'} onclick={()=>$workspaceUi.tab='camera'}><Camera size={14}/> Camera</button></div>
 {#if $workspaceUi.tab==='scene'}
 {#if view.cameraMode==='surface'}<SettingsSection id="landscape" title="Ground observer"><label class="switch-row"><span>Local landscape</span><input type="checkbox" checked={view.localLandscape!==false} onchange={e=>patch({localLandscape:e.currentTarget.checked})}/></label><p class="hint">Illustrative rural scenery around the telescope: grassland, trees and distant houses.</p></SettingsSection>{/if}
 <SettingsSection id="satellites" title="Satellites"><SatelliteSettings {view}/></SettingsSection>
 <SettingsSection id="eclipse" title="Eclipse artifacts"><label class="switch-row"><span>Moon umbra & Earth shadow</span><input type="checkbox" checked={view.moonUmbra} onchange={e=>patch({moonUmbra:e.currentTarget.checked})}/></label><label class="switch-row"><span>Moon penumbra & partial shadow</span><input type="checkbox" checked={view.moonPenumbra} onchange={e=>patch({moonPenumbra:e.currentTarget.checked})}/></label><p class="hint">Blue umbra and faint grey penumbra. The penumbra widens beyond the Moon; its display extends past Earth. True eclipse geometry requires body magnification and Moon orbit spread at ×1. Beyond the umbra tip, no total shadow reaches Earth.</p></SettingsSection>
 <SettingsSection id="layers" title="Scene layers">{#each [['orbits','Orbital paths'],['labels','Body labels'],['stars','Star field'],['constellations','Constellation lines']] as [key,label]}<label class="switch-row"><span>{label}</span><input type="checkbox" checked={view[key as 'orbits'|'labels'|'stars'|'constellations']} onchange={e=>patch({[key]:e.currentTarget.checked})}/></label>{/each}<p class="hint">NASA sky maps · constellation lines can be shown with or without the stars.</p></SettingsSection>
 <SettingsSection id="scale" title="Scale"><label class="range-label" for="body-size">Body magnification <strong>×{view.size}</strong></label><input id="body-size" type="range" min="1" max="200" step="1" value={view.size} oninput={e=>patch({size:+e.currentTarget.value})}/><div class="range-ends"><span>True size</span><span>Enhanced</span></div><label class="range-label" for="moon-distance">Moon orbit spread <strong>×{view.moonScale}</strong></label><input id="moon-distance" type="range" min="1" max="100" value={view.moonScale} oninput={e=>patch({moonScale:+e.currentTarget.value})}/><p class="hint">Display scales only. Physical positions and distance measurements stay unchanged.</p></SettingsSection>
 <SettingsSection id="bodies" title="Celestial bodies"><div class="body-actions"><button class="text-button" onclick={()=>patch({visible:bodies.map(b=>b.id)})}>Show all</button></div>{#each bodies.filter(b=>!b.parent||b.parent==='sun') as body}<div class="body-row"><label><input type="checkbox" checked={view.visible.includes(body.id)} onchange={()=>toggle(body.id)}/><span class="planet-swatch" style:background={body.color}></span>{body.name}</label><div class="object-actions"><button title={`Focus on ${body.name}`} onclick={()=>focus(view.id,body.id)} aria-label={`Focus on ${body.name}`}><Camera size={13}/></button><ObjectInfoButton id={body.id}/></div></div>{#each bodies.filter(b=>b.parent===body.id&&b.parent!=='sun') as moon}<div class="moon-body-row"><label class="moon-row"><input type="checkbox" checked={view.visible.includes(moon.id)} onchange={()=>toggle(moon.id)}/>{moon.name}</label><ObjectInfoButton id={moon.id}/></div>{/each}{/each}</SettingsSection>
 {:else}
 <SettingsSection id="interest" title="Point of interest"><select aria-label="Camera focus" value={focusId} onchange={e=>focus(view.id,e.currentTarget.value)}>{#each displayBodies as b}<option value={b.id} disabled={b.kind==='satellite'&&!positions[b.id]}>{b.name}</option>{/each}</select><div class="button-pair"><button onclick={()=>focus(view.id,focusId,'system')}>System view</button><button onclick={()=>focus(view.id,focusId,'portrait')}>Close-up</button></div><label class="switch-row"><span>Follow selected body</span><input type="checkbox" checked={view.follow} disabled={!positions[focusId]} onchange={()=>patch(changeTracking(view,positions))}/></label><p class="hint">Tracking keeps your camera offset from the selected body as time moves. Fixed cameras use the Sun as their origin.</p></SettingsSection>
 <SettingsSection id="perspective" title="Perspective"><div class="button-pair"><button onclick={()=>{const d=Math.hypot(...view.camera);patch({camera:[0,d,0.000001],target:[0,0,0]});}}>Top-down</button><button onclick={()=>{const d=Math.hypot(...view.camera);patch({camera:[0,d*0.55,d*0.85],target:[0,0,0]});}}>Inclined</button></div><dl class="control-guide"><dt>Orbit</dt><dd>Drag</dd><dt>Zoom</dt><dd>Scroll / pinch</dd><dt>Pan</dt><dd>Right drag</dd><dt>Focus</dt><dd>Click a body label</dd></dl></SettingsSection>
 {/if}
 <div class="panel-footer">Settings apply to this view only.</div>
</aside>

<style>
 .object-actions{display:flex;align-items:center;flex-shrink:0;}
 .moon-body-row{display:flex;align-items:center;justify-content:space-between;}
 .body-actions{display:flex;justify-content:flex-end;margin-bottom:12px;}
</style>
