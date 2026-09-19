export const STORAGE_KEY = 'thread-care:v1';
export const DEFAULT_ROUTINES = [
  {id:'walk', title:'Get ready for a walk', icon:'sun', description:'A little fresh air', steps:['Get your cardigan or light jacket.','Put on your comfortable shoes.','Take your keys.','Check in with your walking companion.']},
  {id:'table', title:'Set the table', icon:'cup', description:'Make room for a good meal', steps:['Place a plate at each seat.','Put a napkin beside each plate.','Add the cutlery.','Place a glass beside each plate.']},
  {id:'plants', title:'Care for your plants', icon:'leaf', description:'A moment with something green', steps:['Find your small watering can.','Check which plants need water with your caregiver.','Water the plants you agreed on.','Return the watering can to its usual spot.']}
];
const clean = (value,max=240) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const validDate = value => typeof value==='string' && Number.isFinite(Date.parse(value));
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const objectKey = value => clean(value,80).toLowerCase().replace(/^(my|the|a|an)\s+/,'').replace(/[?.!]+$/,'').trim();
export function createState() {
  return {version:1,profile:{name:'Alex Morgan',caregiver:'Maya',visitAt:'',reassurance:''},routines:structuredClone(DEFAULT_ROUTINES),active:null,intention:null,objects:[],requests:[],events:[],messages:[{role:'assistant',text:'Hi Alex. I can help you pick up where you left off. Choose a routine, or tell me what you’d like to remember.'}],sound:false};
}
export function restoreState(raw) {
  const base=createState();
  if(!raw) return base;
  const x=JSON.parse(raw);
  if(!x || x.version!==1 || typeof x.profile!=='object' || !Array.isArray(x.routines)) throw new Error('Unsupported saved data');
  base.profile={name:clean(x.profile.name,60)||base.profile.name,caregiver:clean(x.profile.caregiver,60)||base.profile.caregiver,visitAt:validDate(x.profile.visitAt)?x.profile.visitAt:'',reassurance:clean(x.profile.reassurance,400)};
  base.routines=DEFAULT_ROUTINES.map(def=>{const r=x.routines.find(r=>r?.id===def.id); const steps=Array.isArray(r?.steps)?r.steps.map(v=>clean(v,180)).filter(Boolean).slice(0,12):[];return {...def,steps:steps.length?steps:def.steps};});
  const custom=x.routines.filter(r=>r && typeof r.id==='string' && /^custom-[a-zA-Z0-9-]{1,80}$/.test(r.id)).slice(0,17);
  for(const r of custom){const steps=Array.isArray(r.steps)?r.steps.map(v=>clean(v,180)).filter(Boolean).slice(0,12):[];if(clean(r.title,60)&&steps.length&&!base.routines.some(v=>v.id===r.id))base.routines.push({id:r.id,title:clean(r.title,60),icon:'bookmark',description:'Your custom routine',steps});}
  const a=x.active, routine=base.routines.find(r=>r.id===a?.routineId);
  if(routine && Number.isInteger(a.step) && a.step>=0 && a.step<routine.steps.length && ['active','paused','completed'].includes(a.status)) base.active={routineId:routine.id,step:a.step,status:a.status};
  if(clean(x.intention?.text) && validDate(x.intention.at)) base.intention={text:clean(x.intention.text),at:x.intention.at,source:'You told Thread',routineId:base.routines.some(r=>r.id===x.intention.routineId)?x.intention.routineId:null};
  if(Array.isArray(x.objects)) base.objects=x.objects.filter(o=>clean(o?.name,80)&&clean(o?.location,180)&&validDate(o?.at)).slice(0,40).map(o=>({name:clean(o.name,80),location:clean(o.location,180),at:o.at,source:'You told Thread'}));
  if(Array.isArray(x.requests)) base.requests=x.requests.filter(r=>typeof r?.id==='string'&&validDate(r?.at)&&['open','acknowledged','resolved'].includes(r?.status)).slice(0,40).map(r=>({id:clean(r.id,100),at:r.at,status:r.status,context:clean(r.context,500)}));
  if(Array.isArray(x.events)) base.events=x.events.filter(e=>typeof e?.id==='string'&&validDate(e?.at)&&clean(e?.title,100)).slice(0,150).map(e=>({id:clean(e.id,100),at:e.at,title:clean(e.title,100),detail:clean(e.detail,500),source:clean(e.source,80),type:clean(e.type,30)}));
  if(Array.isArray(x.messages)) {const msgs=x.messages.filter(m=>['user','assistant'].includes(m?.role)&&clean(m?.text,1000)).slice(-40).map(m=>({role:m.role,text:clean(m.text,1000)}));if(msgs.length)base.messages=msgs;}
  base.sound=x.sound===true;
  return base;
}
function event(s,title,detail,type,at,source='You confirmed') {s.events.unshift({id:uid(),title,detail,type,at,source});s.events=s.events.slice(0,150);}
export function routineContext(s) {const r=s.routines.find(r=>r.id===s.active?.routineId);return r ? {...s.active,routine:r,step:r.steps[s.active.step]}:null;}
export function transition(previous,action,at=new Date().toISOString()) {
  const s=structuredClone(previous); let reply='';
  switch(action.type){
    case 'start': {const r=s.routines.find(r=>r.id===action.id);if(!r)throw new Error('Choose an available routine.');s.active={routineId:r.id,step:0,status:'active'};s.intention={text:r.title,at,source:'You told Thread',routineId:r.id};reply=r.steps[0];event(s,'Routine started',r.title,'routine',at);break;}
    case 'next': {const c=routineContext(s);if(!c || c.status==='completed'){reply='Choose a routine when you’re ready.';break;}if(c.status==='paused'){reply='Your routine is paused. Say “resume” when you’re ready.';break;}event(s,'Step confirmed',c.step,'routine',at);if(s.active.step===c.routine.steps.length-1){s.active.status='completed';if(s.intention?.routineId===c.routine.id)s.intention=null;reply='All done. Take a moment for yourself.';event(s,'Routine completed',c.routine.title,'routine',at);}else{ s.active.step++;reply=c.routine.steps[s.active.step];}break;}
    case 'pause': {if(s.active?.status==='active'){s.active.status='paused';reply='Take your time. I’ll keep your place.';event(s,'Routine paused',routineContext(s).routine.title,'routine',at);}else reply='There’s no running routine to pause.';break;}
    case 'resume': {if(s.active?.status==='paused'){s.active.status='active';reply=`Let’s pick up here: ${routineContext(s).step}`;event(s,'Routine resumed',routineContext(s).routine.title,'routine',at);}else reply=s.active?.status==='active'?routineContext(s).step:'Choose a routine when you’re ready.';break;}
    case 'intention': {const text=clean(action.text);if(!text)throw new Error('Add a thought to remember.');s.intention={text,at,source:'You told Thread',routineId:null};reply=`I’ll remember: ${text}`;event(s,'Thought saved',text,'memory',at,'You told Thread');break;}
    case 'object': {const name=clean(action.name,80),location=clean(action.location,180);if(!objectKey(name)||!location)throw new Error('Add an object and where you put it.');s.objects=s.objects.filter(o=>objectKey(o.name)!==objectKey(name));s.objects.unshift({name,location,at,source:'You told Thread'});s.objects=s.objects.slice(0,40);reply=`You told me: “${name} — ${location}.” I’ve saved that location.`;event(s,'Object location saved',`${name}: ${location}`,'memory',at,'You told Thread');break;}
    case 'forget-object': {const key=objectKey(action.name);s.objects=s.objects.filter(o=>objectKey(o.name)!==key);reply='Object note deleted.';event(s,'Object note deleted',clean(action.name,80),'memory',at);break;}
    case 'forget-intention': {s.intention=null;reply='Your saved thought has been cleared.';event(s,'Thought cleared','The active intention was removed.','memory',at);break;}
    case 'help': {const existing=s.requests.find(r=>r.status!=='resolved');if(existing){reply=`Your local request is ${existing.status==='open'?'waiting in Care circle':'acknowledged in Care circle'}. This prototype hasn’t called or messaged anyone.`;break;}const c=routineContext(s);const context=[s.intention?`Intention: ${s.intention.text}`:'',c&&c.status!=='completed'?`${c.routine.title} — step ${s.active.step+1}: ${c.step}`:''].filter(Boolean).join('. ')||'General assistance requested.';s.requests.unshift({id:uid(),at,status:'open',context});s.requests=s.requests.slice(0,40);reply=`I’ve added a request for ${s.profile.caregiver} in Care circle on this device. This prototype does not send messages or make calls.`;event(s,'Help requested',context,'help',at);break;}
    case 'request-status': {const r=s.requests.find(r=>r.id===action.id);if(!r || !['acknowledged','resolved'].includes(action.status))throw new Error('This request is not available.');if(r.status==='resolved'||(r.status==='acknowledged'&&action.status==='acknowledged'))throw new Error('This request is already updated.');r.status=action.status;reply=action.status==='resolved'?'Request marked as resolved.':'Request acknowledged.';event(s,reply,r.context,'help',at,'Caregiver entered');break;}
    case 'profile': {const name=clean(action.name,60),caregiver=clean(action.caregiver,60);if(!name||!caregiver)throw new Error('Add both names.');if(action.visitAt&&!validDate(action.visitAt))throw new Error('Choose a valid visit time.');s.profile={name,caregiver,visitAt:action.visitAt||'',reassurance:clean(action.reassurance,400)};reply='Care details saved.';event(s,'Care details updated','Names, visit, and reassurance were reviewed.','care',at,'Caregiver entered');break;}
    case 'routine-edit': {const r=s.routines.find(r=>r.id===action.id);const steps=Array.isArray(action.steps)?action.steps.map(v=>clean(v,180)).filter(Boolean):[];if(!r||!steps.length||steps.length>12)throw new Error('Use between 1 and 12 steps.');if(s.active?.routineId===r.id&&s.active.status!=='completed')throw new Error('Finish this routine or start a different one before editing its steps.');r.steps=steps;if(s.active?.routineId===r.id)s.active=null;reply='Routine saved.';event(s,'Routine updated',r.title,'care',at,'Caregiver entered');break;}
    case 'routine-create': {const title=clean(action.title,60);const steps=Array.isArray(action.steps)?action.steps.map(v=>clean(v,180)).filter(Boolean):[];if(!title||!steps.length||steps.length>12)throw new Error('Add a title and between 1 and 12 steps.');if(s.routines.length>=20)throw new Error('You can save up to 20 routines in this MVP.');const routine={id:'custom-'+uid(),title,steps,icon:'bookmark',description:'Your custom routine'};s.routines.push(routine);reply='Your routine is saved and ready to start.';event(s,'Custom routine saved',title,'care',at,'Reviewed and saved by you');break;}
    case 'sound': {s.sound=action.enabled===true;break;}
    default: throw new Error('Unknown action.');
  }
  return {state:s,reply};
}
export function recall(s) {const c=routineContext(s);if(c&&c.status!=='completed')return `${s.intention&&!s.intention.routineId?`You told me: ${s.intention.text}. `:''}You were working on “${c.routine.title}”. Your next unconfirmed step is: ${c.step}${c.status==='paused'?' Your routine is paused.':''}`;if(s.intention)return `You told me you wanted to: ${s.intention.text}.`;return 'You haven’t saved an intention yet. Tell me “Remember to get my cardigan,” or choose a routine.';}
export function replyTo(previous,input,at=new Date().toISOString()) {
  const text=clean(input,500); if(!text)throw new Error('Enter a message.');
  const normalized=text.toLowerCase().replace(/[’‘]/g,"'").replace(/[.!?]+$/,'').trim();
  let result={state:structuredClone(previous),reply:''};let match;
  if(/\b(medication|medicine|pills?|dosage|dose|chest pain|emergency)\b/.test(normalized)) result.reply='I can help with familiar routines and saved notes, but I can’t make medical decisions or provide emergency help. Please contact your caregiver or local emergency services directly if you need urgent help.';
  else if(/^(what (was|am) i doing|where (was|am) i|what('?s| is) next|remind me|what was my (plan|intention))/.test(normalized))result.reply=recall(previous);
  else if(/^(i need help|help( me)?|call( my)? (caregiver|family)|contact( my)? caregiver|ask for help)$/.test(normalized))result=transition(previous,{type:'help'},at);
  else if(/^(pause|stop|take a break|i need a break)$/.test(normalized))result=transition(previous,{type:'pause'},at);
  else if(/^(resume|continue|i('?m| am) ready|let'?s continue)$/.test(normalized))result=transition(previous,{type:'resume'},at);
  else if(/^(next|done|i('?m| am) done|finished|i did it|next step|complete step)$/.test(normalized))result=transition(previous,{type:'next'},at);
  else if(/^(repeat|say (that|it) again)$/.test(normalized))result.reply=[...previous.messages].reverse().find(m=>m.role==='assistant')?.text||recall(previous);
  else if(/\b(visit|coming|come over)\b/.test(normalized)){const visit=previous.profile.visitAt;if(!visit)result.reply='No next visit is saved yet. Your caregiver can add one in Care circle.';else{const formatted=new Date(visit).toLocaleString(undefined,{weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});result.reply=Date.parse(visit)<Date.parse(at)?`The saved visit with ${previous.profile.caregiver} was scheduled for ${formatted}. I don’t know whether it happened. Care circle needs an updated visit.`:`${previous.profile.caregiver}’s next visit is planned for ${formatted}, according to Care circle.`;}}
  else if((match=text.match(/^(?:remember\s+(?:that\s+)?)?(?:i\s+(?:put|left|placed)\s+|(?:my\s+))(.+?)\s+(?:(?:is|are)\s+)?(in\s+.+|on\s+.+|by\s+.+|under\s+.+|near\s+.+)$/i))){result=transition(previous,{type:'object',name:match[1].replace(/\s+(is|are)$/i,''),location:match[2].replace(/[.!]+$/,'')},at);}
  else if((match=text.match(/^(?:where (?:are|is)|where did i (?:put|leave))\s+(.+?)[?!.]*$/i))){const key=objectKey(match[1]);const item=previous.objects.find(o=>objectKey(o.name)===key);result.reply=item?`You told me: “${item.name} — ${item.location}” on ${new Date(item.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}. I haven’t checked whether that location is still current.`:`I don’t have a saved location for ${clean(match[1],80).replace(/[?.!]+$/,'')}. Tell me where you put it, and I can remember.`;}
  else if((match=text.match(/^(?:remember (?:to |that )?|i(?:'m| am) (?:going to|about to)|my plan is to)\s*(.+)$/i))){result=transition(previous,{type:'intention',text:match[1]},at);}
  else if(/\b(start|begin)\b/.test(normalized)){const id=/walk|cardigan/.test(normalized)?'walk':/table|meal/.test(normalized)?'table':/plant|water/.test(normalized)?'plants':null;result=id?transition(previous,{type:'start',id},at):{state:structuredClone(previous),reply:'You can start “Get ready for a walk”, “Set the table”, or “Care for your plants”.'};}
  else if(/\b(worried|anxious|scared|reassure)\b/.test(normalized))result.reply=previous.profile.reassurance?`Your caregiver left this message: “${previous.profile.reassurance}”`:'Let’s take a moment. Would you like to add a help request in Care circle? You can say “I need help”.';
  else if(/^(hi|hello|hey|thank you|thanks)$/.test(normalized))result.reply=`I’m here, ${previous.profile.name.split(' ')[0]}. We can take one step at a time.`;
  else result.reply='I work with a few simple commands in this prototype. Try “Remember to get my cardigan”, “What was I doing?”, “I put my keys on the hall table”, “Where are my keys?”, or “I need help”.';
  result.state.messages.push({role:'user',text},{role:'assistant',text:result.reply});result.state.messages=result.state.messages.slice(-40);return result;
}
