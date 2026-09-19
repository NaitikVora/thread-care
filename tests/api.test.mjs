import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi,readSession,sealSession,validateResult,sanitizeContext,RESPONSE_SCHEMA} from '../backend/api.mjs';
import {createState,transition,restoreState} from '../dist/domain.js';
const SECRET='test-only-encryption-secret-not-a-real-key-123456';
const KEY='sk-test-only-not-a-real-provider-key-123456789';
const env={SESSION_SECRET:SECRET,OPENAI_API_KEY:KEY,OPENAI_MODEL:'gpt-4.1-mini'};
const origin='https://thread.example';
let tick=Date.parse('2026-09-19T01:00:00Z');
const at=()=>tick+=61000;
const request=(route,body,headers={})=>new Request(origin+route,{method:body===undefined?'GET':'POST',headers:body===undefined?headers:{origin,'content-type':'application/json','x-thread-request':'1',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
const modelReply=(reply='I can save that for you.',actions=[])=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply,actions})}]}]}),{status:200});
test('status never returns a provider key or session secret',async()=>{
  const response=await handleApi(request('/api/status'),env);
  const text=await response.text();assert.equal(response.status,200);assert.equal(text.includes(KEY),false);assert.equal(text.includes(SECRET),false);assert.equal(JSON.parse(text).source,'server');
});
test('missing credentials fail before any provider call',async()=>{
  const response=await handleApi(request('/api/chat',{message:'Hello',context:createState()}),{SESSION_SECRET:SECRET},{fetcher:()=>{throw new Error('must not call provider');},now:at()});
  assert.equal(response.status,401);assert.equal((await response.json()).error.code,'not_connected');
});
test('connect tests the key, encrypts it, and exposes only connection status',async()=>{
  const now=at();let called=0;
  const response=await handleApi(request('/api/connect',{apiKey:KEY,model:'gpt-4.1-mini'}),{SESSION_SECRET:SECRET},{now,fetcher:async(url,options)=>{called++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.authorization,'Bearer '+KEY);assert.equal(JSON.parse(options.body).store,false);return modelReply('connected');}});
  assert.equal(response.status,200);assert.equal(called,1);
  const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Secure/);assert.equal(cookie.includes(KEY),false);
  const result=await response.text();assert.equal(result.includes(KEY),false);
  const stored=await readSession(request('/api/status',undefined,{cookie}),{SESSION_SECRET:SECRET},now);assert.equal(stored.apiKey,KEY);
  const next=await handleApi(request('/api/status',undefined,{cookie}),{SESSION_SECRET:SECRET},{now});assert.equal((await next.json()).source,'session');
});
test('invalid provider key does not create a session or echo upstream errors',async()=>{
  const response=await handleApi(request('/api/connect',{apiKey:KEY}),{SESSION_SECRET:SECRET},{now:at(),fetcher:async()=>new Response(JSON.stringify({error:{message:KEY}}),{status:401})});
  assert.equal(response.status,401);assert.equal(response.headers.has('set-cookie'),false);assert.equal((await response.text()).includes(KEY),false);
});
test('tampered, expired, or differently encrypted sessions are rejected',async()=>{
  const now=at(),sealed=await sealSession({apiKey:KEY,model:'gpt-4.1-mini',id:'abc',expiresAt:now+1000},SECRET);
  const req=request('/api/status',undefined,{cookie:'thread_ai_session='+sealed});
  assert.equal(await readSession(req,{SESSION_SECRET:SECRET},now+1001),null);
  assert.equal(await readSession(req,{SESSION_SECRET:SECRET+'different'},now),null);
  assert.equal(await readSession(request('/api/status',undefined,{cookie:'thread_ai_session='+sealed+'tampered'}),{SESSION_SECRET:SECRET},now),null);
});
test('disconnect clears only the session and reports an environment fallback',async()=>{
  const response=await handleApi(request('/api/disconnect',{}),env);
  assert.match(response.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await response.json()).serverKeyRemains,true);
});
test('cross-origin and non-JSON mutations are rejected',async()=>{
  const cross=await handleApi(request('/api/connect',{apiKey:KEY},{origin:'https://attacker.example'}),env);assert.equal(cross.status,403);
  const noHeader=await handleApi(new Request(origin+'/api/chat',{method:'POST',body:'{}',headers:{'content-type':'text/plain'}}),env);assert.equal(noHeader.status,403);
});
test('chat sends bounded context and returns proposals without applying them',async()=>{
  const state=createState();const before=structuredClone(state);
  const response=await handleApi(request('/api/chat',{message:'Please remember my blue cardigan',context:state}),env,{now:at(),fetcher:async(url,options)=>{
    const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);assert.equal(body.max_output_tokens,1600);assert.equal(body.model,'gpt-4.1-mini');
    assert.ok(body.input.some(m=>m.role==='developer'&&m.content.includes('Current app records')));
    return modelReply('Review the thought below.',[{type:'intention',text:'Get my blue cardigan'}]);
  }});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.actions[0].type,'intention');assert.deepEqual(state,before);
  const applied=transition(state,result.actions[0]);assert.equal(applied.state.intention.text,'Get my blue cardigan');
});
test('custom routines are editable proposals and survive reload after approval',()=>{
  const state=createState();const result=validateResult({reply:'Here is a draft.',actions:[{type:'routine-create',title:'Family visit',steps:['Choose your cardigan.','Find your photo album.']}]},state,'routine');
  const next=transition(state,result.actions[0]).state;assert.equal(next.routines.length,4);
  const restored=restoreState(JSON.stringify(next));assert.equal(restored.routines[3].title,'Family visit');assert.deepEqual(restored.routines[3].steps,result.actions[0].steps);
});
test('unknown actions and unknown routine references are rejected',()=>{
  assert.throws(()=>validateResult({reply:'x',actions:[{type:'delete_all'}]},createState(),'chat'));
  assert.throws(()=>validateResult({reply:'x',actions:[{type:'start',id:'invented'}]},createState(),'chat'));
  assert.throws(()=>validateResult({reply:'x',actions:[{type:'help',secretCommand:'yes'}]},createState(),'chat'));
  assert.throws(()=>validateResult({reply:'x',actions:[{type:'intention',text:'a'.repeat(241)}]},createState(),'chat'));
});
test('summaries cannot mutate data and drafts must contain a routine',()=>{
  assert.throws(()=>validateResult({reply:'x',actions:[{type:'help'}]},createState(),'summary'));
  assert.throws(()=>validateResult({reply:'x',actions:[]},createState(),'routine'));
  assert.throws(()=>sanitizeContext({}));
});
test('a selected photo is sent only as explicit image content',async()=>{
  const image='data:image/png;base64,iVBORw0KGgo=';
  const response=await handleApi(request('/api/chat',{message:'What is shown?',context:createState(),image}),env,{now:at(),fetcher:async(url,options)=>{
    const body=JSON.parse(options.body),last=body.input.at(-1);assert.equal(last.content[1].type,'input_image');assert.equal(last.content[1].image_url,image);return modelReply('I can describe the photo.');
  }});
  assert.equal(response.status,200);
  const invalid=await handleApi(request('/api/chat',{message:'Photo',context:createState(),image:'https://private.example/secret'}),env,{now:at(),fetcher:()=>{throw new Error('must not fetch');}});assert.equal(invalid.status,400);
});
test('API quota, timeout, malformed output, and refusals are handled explicitly',async()=>{
  const body={message:'Hello',context:createState()};
  let response=await handleApi(request('/api/chat',body),env,{now:at(),fetcher:async()=>new Response('{}',{status:429})});assert.equal(response.status,429);
  response=await handleApi(request('/api/chat',body),env,{now:at(),fetcher:async()=>{throw new DOMException('timeout','TimeoutError');}});assert.equal(response.status,504);
  response=await handleApi(request('/api/chat',body),env,{now:at(),fetcher:async()=>new Response(JSON.stringify({status:'completed',output:[]}))});assert.equal(response.status,502);
  response=await handleApi(request('/api/chat',body),env,{now:at(),fetcher:async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'refused'}]}]}))});assert.equal(response.status,200);assert.deepEqual((await response.json()).actions,[]);
});
test('every structured-output action forbids additional properties',()=>{
  assert.equal(RESPONSE_SCHEMA.additionalProperties,false);
  for(const action of RESPONSE_SCHEMA.properties.actions.items.anyOf){assert.equal(action.additionalProperties,false);assert.deepEqual(action.required,Object.keys(action.properties));}
});
