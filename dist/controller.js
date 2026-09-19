import {setupAI} from './ai-client.js';
import {STORAGE_KEY, createState, restoreState, transition, replyTo, recall, routineContext} from './domain.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m-12.8 0L7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',cup:'M4 4h12v10a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V4Zm12 1h2a4 4 0 0 1 0 8h-2M3 22h16',leaf:'M20 3C7 2 2 9 6 15s14 2 14-12ZM4 21 15 10',arrow:'M5 12h14m-5-5 5 5-5 5',check:'m5 12 4 4 10-10',pause:'M8 5v14M16 5v14',bookmark:'M6 3h12v18l-6-4-6 4V3Z',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'};
const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(icons[name]||icons.bookmark)+'"/></svg>';
const time=value=>new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
const date=value=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
let ai;
let state=createState(), view='companion', toastTimer, recognition=null, listening=false;
try{state=restoreState(localStorage.getItem(STORAGE_KEY));}catch(error){$('storage-warning').hidden=false;$('storage-warning').textContent='Saved data could not be loaded. A fresh session is ready; your next change will save it.';}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{$('storage-warning').hidden=false;$('storage-warning').textContent='This browser can’t save your changes. You can continue, but changes may be lost when you close or reload this page.';}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function say(text){if(!state.sound||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.rate=.88;utterance.lang=navigator.language||'en-US';utterance.onerror=event=>{if(!['interrupted','canceled'].includes(event.error))toast('Spoken playback is unavailable. Your reply is shown in the conversation.');};window.speechSynthesis.speak(utterance);}
function addReply(text){if(!text)return;state.messages.push({role:'assistant',text});state.messages=state.messages.slice(-40);}
function act(action,announce=true){try{const result=transition(state,action);state=result.state;if(announce)addReply(result.reply);persist();render();if(announce)say(result.reply);return result;}catch(error){toast(error.message);return null;}}
async function send(text){if(!text.trim())return;if(await ai.sendChat(text))return;try{const result=replyTo(state,text);state=result.state;persist();render();say(result.reply);}catch(error){toast(error.message);}}
function render(){
  $('profile-name').textContent=state.profile.name;$('profile-initial').textContent=state.profile.name.charAt(0).toUpperCase();
  const count=state.requests.filter(r=>r.status==='open').length;$('help-count').textContent=count;$('help-count').hidden=!count;
  $('sound-toggle').setAttribute('aria-pressed',String(state.sound));$('sound-toggle').setAttribute('aria-label',state.sound?'Turn spoken replies off':'Turn spoken replies on');$('sound-toggle').lastElementChild.textContent=state.sound?'Sound on':'Sound off';
  $('current-intention').textContent=state.intention?state.intention.text+' · Saved at '+time(state.intention.at):'Save what you’re about to do, so it’s here when you need it.';
  $('messages').replaceChildren(...state.messages.map(m=>{const el=document.createElement('div');el.className='message '+m.role;el.textContent=m.text;return el;}));$('messages').scrollTop=$('messages').scrollHeight;
  renderDisplay();
  $('routine-list').innerHTML=state.routines.map(r=>'<button class="routine-card'+(state.active?.routineId===r.id?' routine-saved':'')+'" data-start="'+r.id+'"><span class="routine-icon">'+icon(r.icon)+'</span><div><h3>'+escape(r.title)+'</h3><p>'+r.steps.length+' steps · '+escape(r.description)+'</p></div><span class="end-arrow">'+icon('arrow')+'</span></button>').join('');
  if(view==='care')renderCare();
  if(view==='activity')renderActivity();
  if(view==='connection')ai?.renderConnection();
  ai?.renderStatus();
}
function renderDisplay(){
  const c=routineContext(state);
  if(!c){$('glasses-content').innerHTML='<div class="routine-kicker">A FAMILIAR ROUTINE</div><span class="display-icon">'+icon('sun')+'</span><h2>One step<br>at a time.</h2><p>Choose a routine below.<br>We’ll take it from there.</p>';$('routine-controls').innerHTML='<button class="primary light" data-start="walk">Start a routine '+icon('arrow')+'</button>';return;}
  const completed=c.status==='completed',paused=c.status==='paused';
  $('glasses-content').innerHTML='<div class="routine-kicker">'+escape(c.routine.title)+'</div><span class="display-icon">'+icon(completed?'check':paused?'pause':c.routine.icon)+'</span><h2>'+escape(completed?'A little progress. All yours.':paused?'Take your time.':c.step)+'</h2><p>'+(completed?'You confirmed every step.':paused?'Your place is saved. Come back when you’re ready.':'Step '+(state.active.step+1)+' of '+c.routine.steps.length)+'</p><div class="step-progress" aria-label="'+(completed?'Completed':(state.active.step+' of '+c.routine.steps.length+' steps completed'))+'">'+c.routine.steps.map((_,i)=>'<span class="'+(completed||i<state.active.step?'done':'')+'"></span>').join('')+'</div>';
  $('routine-controls').innerHTML=completed?'<button class="primary light" data-start="'+c.routine.id+'">Start again '+icon('arrow')+'</button>':paused?'<button class="primary light" data-action="resume">I’m ready '+icon('arrow')+'</button>':'<button class="secondary dark-secondary" data-action="pause">Pause</button><button class="primary light" data-action="next">I’ve done this '+icon('check')+'</button>';
}
function switchView(next){if(!['companion','care','activity','connection'].includes(next))return;view=next;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+next);document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===next);if(el.dataset.view===next)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});$('page-title').textContent=({companion:'Your companion',care:'Your care circle',activity:'Little moments, remembered',connection:'Your AI connection'})[next];render();}
function renderCare(){
  const p=state.profile;
  const localDate=p.visitAt?new Date(Date.parse(p.visitAt)-new Date(p.visitAt).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  $('view-care').innerHTML='<div class="care-grid"><section class="card form-card"><h2>A familiar face</h2><p>Personalize the companion with names and a simple plan.</p><form id="profile-form"><label for="person-name">Companion’s name</label><input id="person-name" name="name" required maxlength="60" value="'+escape(p.name)+'"><label for="caregiver-name">Caregiver’s name</label><input id="caregiver-name" name="caregiver" required maxlength="60" value="'+escape(p.caregiver)+'"><label for="visit-at">Next planned visit</label><input id="visit-at" name="visitAt" type="datetime-local" value="'+localDate+'"><label for="reassurance">A reassuring message</label><textarea id="reassurance" name="reassurance" maxlength="400" placeholder="A short, familiar message they can ask to hear.">'+escape(p.reassurance)+'</textarea><button class="primary" type="submit">Save care details '+icon('check')+'</button></form></section><section class="card form-card"><h2>A little help</h2><p>Requests include the current thought and routine step.</p><p class="privacy-note">Local demo only. Requests appear here and in other tabs on this browser. No calls or messages are sent.</p><div id="requests">'+(state.requests.length?state.requests.map(r=>'<article class="request"><div class="request-top"><strong>Help request</strong><span class="status '+(r.status==='open'?'open':'')+'">'+escape(r.status==='open'?'Needs attention':r.status==='acknowledged'?'Acknowledged':'Resolved')+'</span></div><p>'+escape(r.context)+'</p><p class="timeline-meta">'+date(r.at)+' at '+time(r.at)+'</p>'+(r.status==='open'?'<button class="secondary" data-request="'+escape(r.id)+'" data-status="acknowledged">Acknowledge request</button>':r.status==='acknowledged'?'<button class="secondary" data-request="'+escape(r.id)+'" data-status="resolved">Mark resolved</button>':'')+'</article>').join(''):'<div class="empty-state">'+icon('heart')+'<p>No requests right now.</p></div>')+'</div></section><section class="card form-card full-row"><h2>Make a routine familiar</h2><p>Use short instructions in the order that works for your household.</p><form id="routine-form"><label for="routine-select">Routine</label><select id="routine-select">'+state.routines.map(r=>'<option value="'+r.id+'">'+escape(r.title)+'</option>').join('')+'</select><label for="routine-steps">Steps · one per line</label><textarea id="routine-steps" required rows="5" maxlength="2200">'+escape(state.routines[0].steps.join('\n'))+'</textarea><p class="privacy-note">Up to 12 steps, 180 characters each. An active routine must be finished before its steps can be changed.</p><button class="primary" type="submit">Save routine '+icon('check')+'</button></form></section></div>';
}
function renderActivity(){
  const memories=(state.intention?[{name:'Your current thought',location:state.intention.text,at:state.intention.at,intention:true}]:[]).concat(state.objects);
  $('view-activity').innerHTML='<div class="activity-heading"><p>Saved on this device. Each memory keeps its source.</p><button class="secondary" id="reset-button">Reset demo</button></div><div class="memory-list">'+memories.map(m=>'<article class="memory-card"><span class="source-tag">You told Thread</span><strong>'+escape(m.name)+'</strong><p>'+escape(m.location)+'</p><p class="timeline-meta">'+date(m.at)+' · '+time(m.at)+'</p>'+(m.intention?'<button class="text-button" id="forget-intention">Clear this thought</button>':'')+'</article>').join('')+'</div><section class="card timeline">'+(state.events.length?state.events.map(e=>'<article class="timeline-item"><span class="timeline-icon">'+icon(e.type==='help'?'heart':e.type==='routine'?'check':'bookmark')+'</span><div><h3>'+escape(e.title)+'</h3><p>'+escape(e.detail)+'</p><div class="timeline-meta">'+escape(e.source)+'</div></div><time datetime="'+escape(e.at)+'">'+date(e.at)+' · '+time(e.at)+'</time></article>').join(''):'<div class="empty-state"><span class="blank-icon">'+icon('bookmark')+'</span><p>Your story starts here.</p><p>Start a routine or save a thought to see it in your timeline.</p></div>')+'</section>';
}
const baseRenderCare=renderCare;
renderCare=function(){baseRenderCare();ai?.careTools();};
function openMemory(){$('memory-form').reset();updateMemoryFields();$('memory-dialog').showModal();}
function updateMemoryFields(){const object=$('memory-type').value==='object';$('object-fields').hidden=!object;$('intention-fields').hidden=object;$('intention-input').required=!object;$('object-input').required=object;$('location-input').required=object;}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.view)switchView(button.dataset.view);
  if(button.dataset.start){act({type:'start',id:button.dataset.start});$('routine-controls').querySelector('.primary')?.focus();}
  if(button.dataset.action){act({type:button.dataset.action});$('routine-controls').querySelector('.primary')?.focus();}
  if(button.dataset.prompt)send(button.dataset.prompt);
  if(button.hasAttribute('data-close-dialog'))button.closest('dialog').close();
  if(button.dataset.request){const result=act({type:'request-status',id:button.dataset.request,status:button.dataset.status},false);if(result)toast(result.reply);}
  if(button.id==='open-memory')openMemory();
  if(button.id==='about-button')$('about-dialog').showModal();
  if(button.id==='reset-button')$('reset-dialog').showModal();
  if(button.id==='forget-intention')act({type:'forget-intention'},false);
  if(button.id==='confirm-reset'){recognition?.abort();window.speechSynthesis?.cancel();state=createState();persist();$('reset-dialog').close();switchView('companion');toast('Sample profile restored.');}
  if(button.id==='sound-toggle'){if(!('speechSynthesis'in window)){toast('Spoken replies are not supported in this browser.');return;}act({type:'sound',enabled:!state.sound},false);if(state.sound)say('Spoken replies are on.');else window.speechSynthesis.cancel();}
  if(button.id==='mic-button')toggleVoice();
});
$('chat-form').addEventListener('submit',event=>{event.preventDefault();if(ai.isBusy()){toast('Please wait for the current reply.');return;}const text=$('chat-input').value;$('chat-input').value='';send(text);$('chat-input').focus();});
$('memory-type').addEventListener('change',updateMemoryFields);
$('memory-form').addEventListener('submit',event=>{event.preventDefault();const action=$('memory-type').value==='object'?{type:'object',name:$('object-input').value,location:$('location-input').value}:{type:'intention',text:$('intention-input').value};const result=act(action);if(result){$('memory-dialog').close();toast('Saved with your words and the time.');}});
document.addEventListener('submit',event=>{
  if(event.target.id==='profile-form'){event.preventDefault();const form=new FormData(event.target);const local=form.get('visitAt');const result=act({type:'profile',name:form.get('name'),caregiver:form.get('caregiver'),visitAt:local?new Date(local).toISOString():'',reassurance:form.get('reassurance')},false);if(result)toast(result.reply);}
  if(event.target.id==='routine-form'){event.preventDefault();const lines=$('routine-steps').value.split('\n').map(s=>s.trim()).filter(Boolean);if(lines.some(s=>s.length>180)){toast('Keep each step to 180 characters or fewer.');return;}const result=act({type:'routine-edit',id:$('routine-select').value,steps:lines},false);if(result)toast(result.reply);}
});
document.addEventListener('change',event=>{if(event.target.id==='routine-select')$('routine-steps').value=state.routines.find(r=>r.id===event.target.value).steps.join('\n');});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){try{state=restoreState(event.newValue);render();toast('Updated from another tab on this device.');}catch{toast('Changes from another tab could not be loaded.');}}});
window.addEventListener('pagehide',()=>{recognition?.abort();window.speechSynthesis?.cancel();});
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!Recognition){$('mic-button').disabled=true;$('mic-button').title='Voice input is unavailable in this browser. You can type instead.';$('voice-note').textContent='Type to chat · voice input unavailable in this browser';}
function toggleVoice(){
  if(listening){recognition?.stop();return;}
  if(!Recognition){toast('Voice input is unavailable. Please type your message.');return;}
  window.speechSynthesis?.cancel();
  try{
    recognition=new Recognition();recognition.lang=navigator.language||'en-US';recognition.interimResults=false;recognition.continuous=false;
    recognition.onstart=()=>{listening=true;$('mic-button').classList.add('mic-active');$('mic-button').setAttribute('aria-label','Stop voice input');$('voice-note').textContent='Listening… press the microphone to stop.';};
    recognition.onresult=event=>{const transcript=event.results[0][0].transcript;$('chat-input').value=transcript;toast('Voice captured. Review your words, then press Send.');};
    recognition.onerror=event=>{const message=event.error==='not-allowed'?'Microphone access was denied. You can type your message.':event.error==='no-speech'?'No speech was detected. Try again or type your message.':event.error==='network'?'The browser speech service could not connect. You can type instead.':'Voice input stopped. You can type instead.';if(event.error!=='aborted')toast(message);};
    recognition.onend=()=>{listening=false;$('mic-button').classList.remove('mic-active');$('mic-button').setAttribute('aria-label','Start voice input');$('voice-note').textContent='Voice uses your browser’s speech service';};
    recognition.start();
  }catch{listening=false;toast('Voice input could not start. You can type your message.');}
}
$('date-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
ai=setupAI({getState:()=>structuredClone(state),onMessage:(role,text)=>{state.messages.push({role,text});state.messages=state.messages.slice(-40);persist();render();},onAction:action=>act(action),notify:toast,speak:say,switchView});
updateMemoryFields();render();
// Tools share the same state and actions as the visible interface.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tool={name:'thread_get_current_activity',title:'Read current activity',description:'Read the saved intention and the current routine step in this device-local prototype. Makes no changes.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object.');return {intention:state.intention?.text||null,routine:state.active,summary:recall(state),openRequests:state.requests.filter(r=>r.status==='open').length};}};
  try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
