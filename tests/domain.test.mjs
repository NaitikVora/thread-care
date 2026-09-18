import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,restoreState,transition,replyTo,recall,routineContext} from '../dist/domain.js';
const at='2026-09-18T16:00:00.000Z';
test('an interrupted routine preserves its exact unconfirmed step',()=>{
  let s=transition(createState(),{type:'start',id:'walk'},at).state;
  s=transition(s,{type:'next'},at).state;
  s=transition(s,{type:'pause'},at).state;
  assert.equal(s.active.step,1);assert.match(recall(s),/comfortable shoes/);assert.match(recall(s),/paused/);
  assert.equal(transition(s,{type:'next'},at).state.active.step,1);
  assert.equal(transition(s,{type:'resume'},at).state.active.status,'active');
  assert.equal(routineContext(s).step,'Put on your comfortable shoes.');
});
test('only explicit confirmations advance or complete a routine',()=>{
  let s=transition(createState(),{type:'start',id:'table'},at).state;
  s=replyTo(s,'What was I doing?',at).state;assert.equal(s.active.step,0);
  for(let i=0;i<4;i++)s=transition(s,{type:'next'},at).state;
  assert.equal(s.active.status,'completed');assert.equal(s.intention,null);
  assert.equal(s.events.filter(e=>e.title==='Step confirmed').length,4);
  assert.equal(transition(s,{type:'next'},at).state.events.length,s.events.length);
});
test('new intentions survive completion of unrelated routines',()=>{
  let s=transition(createState(),{type:'start',id:'walk'},at).state;
  s=replyTo(s,'Remember to call my sister',at).state;
  for(let i=0;i<4;i++)s=transition(s,{type:'next'},at).state;
  assert.equal(s.intention.text,'call my sister');
});
test('object memory reports source and uncertainty',()=>{
  let s=replyTo(createState(),'I put my keys on the hall table',at).state;
  assert.equal(s.objects[0].location,'on the hall table');
  const reply=replyTo(s,'Where are my keys?',at).reply;
  assert.match(reply,/You told me/);assert.match(reply,/hall table/);assert.match(reply,/haven’t checked/);
  assert.match(replyTo(s,'Where is my wallet?',at).reply,/don’t have a saved location/);
  s=replyTo(s,'Remember my keys are in the drawer',at).state;
  assert.equal(s.objects.length,1);assert.equal(s.objects[0].location,'in the drawer');
});
test('intention commands retain the wearer’s words',()=>{
  const s=replyTo(createState(),"I'm going to get my blue cardigan",at).state;
  assert.equal(s.intention.text,'get my blue cardigan');assert.match(recall(s),/blue cardigan/);
});
test('help is local, deduplicated, contextual, and resolvable',()=>{
  let s=transition(createState(),{type:'start',id:'walk'},at).state;
  const result=replyTo(s,'I need help',at);s=result.state;
  assert.match(result.reply,/does not send messages/);assert.match(s.requests[0].context,/cardigan/);
  s=replyTo(s,'I need help',at).state;assert.equal(s.requests.length,1);
  s=transition(s,{type:'request-status',id:s.requests[0].id,status:'acknowledged'},at).state;
  assert.equal(s.requests[0].status,'acknowledged');
  s=transition(s,{type:'request-status',id:s.requests[0].id,status:'resolved'},at).state;
  assert.throws(()=>transition(s,{type:'request-status',id:s.requests[0].id,status:'acknowledged'},at));
  s=replyTo(s,'I need help',at).state;assert.equal(s.requests.length,2);
});
test('visits distinguish absent, future, and stale plans',()=>{
  let s=createState();assert.match(replyTo(s,'When is my next visit?',at).reply,/No next visit/);
  s=transition(s,{type:'profile',name:'Alex',caregiver:'Maya',visitAt:'2026-09-19T16:00:00Z'},at).state;
  assert.match(replyTo(s,'When is Maya coming?',at).reply,/planned for/);
  assert.match(replyTo(s,'When is Maya coming?','2026-09-20T16:00:00Z').reply,/don’t know whether it happened/);
});
test('routine edits cannot invalidate an in-progress routine',()=>{
  let s=transition(createState(),{type:'start',id:'walk'},at).state;
  assert.throws(()=>transition(s,{type:'routine-edit',id:'walk',steps:['New step']},at));
  assert.throws(()=>transition(s,{type:'routine-edit',id:'plants',steps:[]},at));
  s=transition(s,{type:'routine-edit',id:'plants',steps:['Get the can.','Put it away.']},at).state;
  assert.equal(s.routines[2].steps.length,2);assert.equal(s.active.routineId,'walk');
});
test('state roundtrip preserves progress, notes, and requests',()=>{
  let s=transition(createState(),{type:'start',id:'walk'},at).state;
  s=replyTo(s,'I put my keys in the bowl',at).state;s=replyTo(s,'I need help',at).state;
  assert.deepEqual(restoreState(JSON.stringify(s)),s);
});
test('restoration rejects malformed JSON and recovers invalid fields',()=>{
  assert.throws(()=>restoreState('{broken'));assert.throws(()=>restoreState('null'));assert.throws(()=>restoreState('{"version":2}'));
  const s=createState();s.active={routineId:'walk',step:999,status:'active'};s.objects=[null,{name:'Keys',location:'somewhere',at:'not a date'}];s.messages=[null];s.profile.visitAt='not a date';
  const recovered=restoreState(JSON.stringify(s));assert.equal(recovered.active,null);assert.equal(recovered.objects.length,0);assert.equal(recovered.profile.visitAt,'');assert.equal(recovered.messages.length,1);
});
test('actions do not mutate their input',()=>{
  const s=createState(),copy=structuredClone(s);transition(s,{type:'start',id:'walk'},at);replyTo(s,'Remember to get my coat',at);assert.deepEqual(s,copy);
});
test('medical requests never advance routines or invent an answer',()=>{
  const s=transition(createState(),{type:'start',id:'walk'},at).state;
  const response=replyTo(s,'Should I take another pill?',at);assert.match(response.reply,/can’t make medical decisions/);assert.equal(response.state.active.step,0);
});
test('unknown requests disclose supported commands',()=>{
  assert.match(replyTo(createState(),'What is the weather?',at).reply,/simple commands/);
});
