import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireVisibleForActivation} from '../companion/readiness';
test('activation preflight rejects background rendering before scientific state or build selection changes',()=>{
 assert.doesNotThrow(()=>requireVisibleForActivation('visible'));
 assert.throws(()=>requireVisibleForActivation('hidden'),/No build was changed/);
});
