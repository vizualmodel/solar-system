import { controlSchemas } from './control-schema';
import type { ApplicationTool } from '@vizualmodel/companion/contracts';
import { scenarioTool } from '@vizualmodel/companion/scenarios';
import { isSimulationObservation } from './simulation-protocol';
const validateResult = (value: unknown) => { if (!isSimulationObservation(value)) throw new Error('Invalid simulation acknowledgement.'); return value; };
const descriptions:Record<keyof typeof controlSchemas,string> = {
 get_simulation_state:'Read acknowledged simulation state and workspace identity. detail=full includes all simulation state and workspace UI settings.',
 set_simulation_time:'Set ISO simulation time with timezone, preserving playback and respecting FROM/TO.',
 timeline:'Configure time, playing, speed (days per second) and FROM/TO together; step seconds or jump to start/end. Range changes clamp the date like the UI.',
 camera:'Configure camera focus/preset, tracking, position/target in Y-up AU, or alignment/surface mode with geographic observer. Defaults to active view. Tracking changes preserve viewpoint. Surface/alignment use true scale and Earth tracking.',
 scene:'Configure one view’s visibility, layers, eclipse shadows and display scales with a settings payload.',
 satellites:'Configure satellite visibility/magnification or cached populationGroups (geo, leo, starlink, navigation, gps); populationSelection selects a NORAD ID for its orbit/card. Filters combine without duplicates. closeUp=iss prepares true-size tracking at real-time speed, paused ready for Play.',
 views:'Select, split, close or arrange views. Supply viewId or use active; row is side by side. Maximum six views; final view cannot close.',
 session:'Rename, save in browser, export JSON in result, import validated simulation state (paused), start new session, or apply a preset. New returns previousSimulationState. Scenarios are reusable prompts managed with the scenarios tool. Presets: overview, earth, inner, spain-eclipse.',
 workspace:'Open/close settings, charts, companion and about; choose settings tab and expand/collapse named sections. Does not answer Codex approvals.',
 charts:'Configure distance pair and panel; optionally jump to next closest approach within FROM/TO and pause.'
};
export const tools:ApplicationTool[] = [...Object.entries(controlSchemas).map(([name,inputSchema])=>({
 name,description:descriptions[name as keyof typeof descriptions],inputSchema,
 annotations:{readOnlyHint:name==='get_simulation_state',destructiveHint:false,openWorldHint:false},validateResult,
 summarize:(value:any)=>`${name}: ${value.time}; ${value.playing?'playing':'paused'}; ${value.viewCount} views.`
})),scenarioTool];
