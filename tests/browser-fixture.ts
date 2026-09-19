// Controlled browser QA server. NEVER imported by production code.
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createApp} from '../apps/api/src/app';
import {openDatabase} from '../apps/api/src/db';
import {LocalImageStorage} from '../apps/api/src/storage';
const dir=await mkdtemp(path.join(tmpdir(),'thread-browser-qa-')),db=await openDatabase('memory://');
const app=await createApp({db,storage:new LocalImageStorage(path.join(dir,'images')),env:{SESSION_SECRET:'browser-fixture-only-secret-not-real-123456789'},staticDir:path.resolve('build/web'),fetcher:async(url,init)=>{
  if(String(url).includes('/transcriptions'))return new Response(JSON.stringify({text:'This is a controlled transcription fixture.'}));
  const body=JSON.parse(String(init?.body));let reply='Controlled QA connection response.',actions:any[]=[];
  if(Array.isArray(body.input)){
    const user=body.input.filter((x:any)=>x.role==='user').at(-1);const message=Array.isArray(user?.content)?user.content.find((x:any)=>x.type==='input_text')?.text||'':String(user?.content||'');
    const context=JSON.parse(body.input[0].content);
    if(message.includes('simulate error'))return new Response('{}',{status:429});
    if(message.includes('slow reply'))await new Promise((resolve,reject)=>{const t=setTimeout(resolve,6000);init?.signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'));});});
    if(context.purpose==='routine'){reply='Controlled QA routine draft. Review the steps before saving.';actions=[{type:'routine-create',title:'Family visit',steps:['Choose your cardigan.','Find the photo album.','Meet Maya in the living room.']}];}
    else if(context.purpose==='summary')reply='Controlled QA handoff: this summary is based on the supplied recorded events. No external message was sent.';
    else if(message.toLowerCase().includes('cardigan')){reply='Controlled QA suggestion: I can save this thought after you confirm.';actions=[{type:'intention',text:'Get my blue cardigan'}];}
    else if(user.content.some((x:any)=>x.type==='input_image'))reply='Controlled QA image reply. The uploaded test image was received. This is not a live vision assessment.';
    else if(context.retrievedNotes.length)reply='Controlled QA grounded answer: '+context.retrievedNotes.map((n:any)=>n.title+': '+n.content).join(' ');
    else reply='Controlled QA answer. This fixture does not contact OpenAI.';
  }
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply,actions})}]}]}));
}});
await app.listen({host:'127.0.0.1',port:4174});console.log('CONTROLLED QA ONLY: http://localhost:4174');
async function close(){await app.close();await db.close();await rm(dir,{recursive:true,force:true});process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
