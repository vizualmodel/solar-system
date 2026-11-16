/** Read-only service diagnostic. Agent connection is tested through Bridge. */
import assert from 'node:assert/strict';
const origin=process.env.SOLAR_PROBE_URL||'http://127.0.0.1:5180';
const bootstrap=await fetch(origin+'/companion/bootstrap').then(response=>response.json());
const response=await fetch(origin+'/internal/status',{headers:{authorization:'Bearer '+bootstrap.token}});
assert.equal(response.status,200);const value=await response.json();
assert.equal(value.status,'Model development service ready');assert.equal(value.threadId,undefined);assert.equal(value.turnId,undefined);
console.log(JSON.stringify({application:value.application,workspace:value.workspace,build:value.build,browserReady:value.browserReady,agentConnection:'VizualModel Bridge only'}));
