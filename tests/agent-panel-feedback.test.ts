import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeNotice,conversationFeedback,failureFeedback,type ConversationMessage} from '../src/model-integration/panel-feedback';

test('read-only failure has an explanation and recovery in the conversation without inventing a Codex reply',()=>{
  const text=failureFeedback(undefined,'read');
  assert.match(text,/could not complete/);assert.match(text,/read only/);assert.match(text,/investigation/);assert.match(text,/disconnect/i);
  const transcript=bridgeNotice([{id:'user',role:'user',text:'Change labels'}],'failure',text);
  assert.equal(transcript[1].role,'bridge');assert.equal(transcript[0].text,'Change labels');
  assert.match(failureFeedback('The runtime denied the request.','read'),/^The runtime denied the request\./);
});
test('duplicate failure statuses update one notice but later requests retain their own feedback',()=>{
  const original:ConversationMessage[]=[{id:'answer',role:'assistant',text:'Previous actual reply'}];
  const once=bridgeNotice(original,'request-a','First error');const updated=bridgeNotice(once,'request-a','Detailed error');const next=bridgeNotice(updated,'request-b','Another error');
  assert.equal(updated.length,2);assert.equal(updated[1].text,'Detailed error');assert.equal(next.length,3);assert.equal(next[0].text,'Previous actual reply');
});
test('unknown control outcomes do not claim the model was unchanged and new conversations explain permissions',()=>{
  const text=failureFeedback('Operation timed out.','control');assert.match(text,/current state before trying/);assert.match(text,/Nothing will be retried automatically/);assert.doesNotMatch(text,/no (?:files|settings|state|changes) (?:were|was)/i);
  assert.match(conversationFeedback(false),/new conversation/);assert.match(conversationFeedback(false),/read only/);assert.match(conversationFeedback(true),/approval/);
});

test('resumption explains fresh permissions without claiming a new thread or restored model state',()=>{
  const text=conversationFeedback(false,true);assert.match(text,/resumed/);assert.match(text,/current permissions/);assert.match(text,/state was not restored/);assert.doesNotMatch(text,/new conversation/);
});
