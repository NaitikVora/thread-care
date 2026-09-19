// Browser QA fixture only. No network requests or real credentials are used.
import { createServer } from '../server.mjs';
const server=createServer({SESSION_SECRET:'fixture-only-not-production-encryption-key-12345'},{
  fetcher:async(_url,options)=>{
    const body=JSON.parse(options.body);
    let result={reply:'Connected to the browser QA fixture.',actions:[]};
    if(Array.isArray(body.input)){
      const text=body.input.at(-1)?.content?.find?.(p=>p.type==='input_text')?.text||'';
      const purpose=body.input[0].content;
      if(purpose.includes('Purpose: routine'))result={reply:'Review this routine before saving.',actions:[{type:'routine-create',title:'Family visit',steps:['Choose your cardigan.','Find the family photo album.','Meet Maya in the living room.']}]};
      else if(purpose.includes('Purpose: summary'))result={reply:'Recorded handoff: Alex has a saved activity. This fixture summary uses only the supplied app records.',actions:[]};
      else if(text.toLowerCase().includes('cardigan'))result={reply:'I can keep that thought for you. Please review it below.',actions:[{type:'intention',text:'Get my blue cardigan'}]};
      else if(text.includes('error'))return new Response('{}',{status:429});
      else result={reply:'This is a controlled test response, not a live AI answer.',actions:[]};
    }
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]}));
  }
});
server.listen(4174,'127.0.0.1',()=>console.log('Thread QA fixture: http://127.0.0.1:4174'));
