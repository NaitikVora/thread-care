const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const signature = state => JSON.stringify([state.profile,state.routines,state.active,state.intention,state.objects,state.requests]);
const labels = {intention:'Save this thought',object:'Save this location',start:'Start this routine',pause:'Pause the routine',resume:'Resume the routine',next:'Confirm this step is done',help:'Create a local help request','routine-create':'Review routine'};

export function setupAI(app) {
  let connection = {configured:false,model:'gpt-4.1-mini',source:null,available:false};
  let busy = false, photo = null, proposals = [], proposalSignature = '', summary = '', draft = null, lastError = '';
  let verified = false;
  async function request(route, body) {
    let response;
    try {
      response = await fetch(route, { method:body===undefined?'GET':'POST', credentials:'same-origin', headers:body===undefined?{}:{'content-type':'application/json','x-thread-request':'1'}, ...(body===undefined?{}:{body:JSON.stringify(body)}), signal:AbortSignal.timeout(40000) });
    } catch { throw new Error('The AI server could not be reached. Check your connection and try again.'); }
    let value;
    try { value = await response.json(); } catch { throw new Error('The AI backend is not available. Start the updated app server.'); }
    if (!response.ok) {
      if (value.error?.code === 'not_connected' || value.error?.code === 'invalid_api_key') { connection.configured=false; verified=false; renderStatus(); }
      throw new Error(value.error?.message || 'The AI request failed.');
    }
    return value;
  }
  async function refresh() {
    try { connection={...await request('/api/status'),available:true}; }
    catch { connection={...connection,configured:false,available:false}; }
    renderStatus();
    if (!$('view-connection').hidden) renderConnection();
  }
  function renderStatus() {
    $('ai-status').textContent=connection.configured?'AI connected':'Connect AI';
    $('ai-status').classList.toggle('connected',connection.configured);
    $('ai-mode-note').textContent=connection.configured?'OpenAI · '+connection.model+' · changes need your review':'Basic mode · connect an API key for AI features';
  }
  function setBusy(value, label='Thinking…') {
    busy=value;
    $('ai-thinking').hidden=!value;
    $('ai-thinking').textContent=label;
    $('chat-form').querySelector('[type="submit"]').disabled=value;
    $('chat-form').setAttribute('aria-busy',String(value));
    document.querySelectorAll('[data-ai-task]').forEach(el=>el.disabled=value);
  }
  function showError(error) {
    lastError=error.message;
    $('ai-error').hidden=false;
    $('ai-error-text').textContent=lastError;
    app.notify(lastError);
  }
  function clearError() { lastError='';$('ai-error').hidden=true; }
  function renderConnection() {
    const status=connection.configured?(verified?'Connection tested successfully':'Key configured'):(connection.available?'No API key connected':'AI backend unavailable');
    $('view-connection').innerHTML='<div class="connection-grid"><section class="card form-card"><span class="small-label">OPENAI CONNECTION</span><h2>Give your companion AI</h2><p>Connect your own OpenAI API key for natural conversation, photo questions, and routine drafting.</p><div class="connection-state '+(connection.configured?'ready':'')+'" role="status"><strong>'+escape(status)+'</strong><span>'+escape(connection.configured?connection.model+' · '+(connection.source==='server'?'server environment key':'encrypted session key'):'Your routines and saved memories still work in basic mode.')+'</span></div><form id="ai-connect-form"><label for="ai-key">OpenAI API key</label><input id="ai-key" name="apiKey" type="password" required maxlength="512" autocomplete="off" spellcheck="false" placeholder="sk-…"><label for="ai-model">Model</label><input id="ai-model" name="model" value="'+escape(connection.model)+'" required maxlength="100" autocomplete="off"><p class="privacy-note">Use a model with Responses and structured-output support. The default also accepts photos.</p><button class="primary" type="submit" data-ai-task>Connect &amp; test</button></form><div class="button-row connection-actions">'+(connection.configured?'<button class="secondary" id="test-ai" data-ai-task>Test connection</button>':'')+(connection.source==='session'?'<button class="secondary" id="disconnect-ai" data-ai-task>Disconnect session key</button>':'')+'</div><p id="connection-feedback" class="privacy-note" role="status"></p></section><section class="card form-card"><h2>Your key, your control</h2><ul class="feature-list"><li><strong>Server-side requests</strong><span>The app backend sends requests to OpenAI. Your key is never returned to app JavaScript after connection.</span></li><li><strong>One-hour encrypted session</strong><span>Your entered key is sealed into an HttpOnly cookie. It is not saved in localStorage or the repository. Disconnect removes this browser’s cookie.</span></li><li><strong>Only when you ask</strong><span>Sending an AI request shares your message, recent conversation, saved context, and any attached photo with OpenAI.</span></li><li><strong>Your API billing</strong><span>Connection tests and AI requests use your OpenAI API project. A ChatGPT subscription does not supply an API key.</span></li></ul><p class="privacy-note">A server key can also be configured with OPENAI_API_KEY. A session key overrides it; disconnecting returns to the server key if one exists.</p><a class="text-button" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">Manage OpenAI API keys ↗</a></section></div>';
    if (busy) document.querySelectorAll('[data-ai-task]').forEach(el=>el.disabled=true);
  }
  function describeAction(action) {
    if(action.type==='intention')return action.text;
    if(action.type==='object')return action.name+' — '+action.location;
    if(action.type==='routine-create')return action.title+' · '+action.steps.length+' steps';
    if(action.type==='start')return app.getState().routines.find(r=>r.id===action.id)?.title||action.id;
    if(action.type==='help')return 'This request stays in Care circle on this browser. No call or message will be sent.';
    return action.type==='next'?'Only confirm if you have finished the current instruction.':'Update your current routine.';
  }
  function renderProposals() {
    $('ai-proposals').hidden=!proposals.length;
    $('ai-proposals').innerHTML=proposals.length?'<p class="proposal-label">Suggested changes · nothing saved yet</p>'+proposals.map((a,i)=>'<article class="proposal"><p>'+escape(describeAction(a))+'</p><div class="button-row"><button class="primary" data-apply-ai="'+i+'">'+labels[a.type]+'</button><button class="text-button" data-dismiss-ai="'+i+'">Dismiss</button></div></article>').join(''):'';
  }
  function careTools() {
    $('view-care').querySelector('.care-grid')?.insertAdjacentHTML('beforeend','<section class="card form-card full-row ai-care-tools"><span class="small-label">AI ASSISTANCE</span><h2>Build on what feels familiar</h2><p>Describe a simple activity. Review the suggested steps before adding it to your routines.</p><form id="ai-routine-form"><label for="ai-routine-description">What would you like help with?</label><textarea id="ai-routine-description" maxlength="1000" required placeholder="Help Alex get ready for a family visit: choose a cardigan, find the photo album, and meet Maya in the living room."></textarea><button class="primary" data-ai-task type="submit">Draft a routine</button></form><div class="summary-section"><h3>A handoff from the activity log</h3><p>Summarize recorded events and unresolved requests. The summary cannot verify what happened outside this app.</p><button class="secondary" data-ai-task id="generate-summary">Generate caregiver summary</button><div id="care-summary" class="summary-output" '+(summary?'':'hidden')+'>'+escape(summary)+'</div></div></section>');
    if(busy)document.querySelectorAll('[data-ai-task]').forEach(el=>el.disabled=true);
  }
  function openDraft(action) {
    draft=structuredClone(action);
    $('draft-title').value=draft.title;
    $('draft-steps').value=draft.steps.join('\n');
    $('routine-draft-dialog').showModal();
  }
  function renderPhoto() {
    $('photo-preview').hidden=!photo;
    if(photo){$('photo-thumbnail').src=photo.data;$('photo-name').textContent=photo.name;}
    else{$('photo-thumbnail').removeAttribute('src');$('photo-input').value='';}
  }
  async function sendChat(text) {
    if(!connection.configured) { if(photo){app.notify('Connect an API key before asking about a photo.');app.switchView('connection');return true;}return false; }
    if(busy){app.notify('Please wait for the current reply.');return true;}
    clearError();proposals=[];renderProposals();
    const context=app.getState(), fingerprint=signature(context), selectedPhoto=photo;
    app.onMessage('user',text+(selectedPhoto?' [Photo attached]':''));
    setBusy(true);
    try {
      const result=await request('/api/chat',{message:text,context,purpose:'chat',...(selectedPhoto?{image:selectedPhoto.data}:{})});
      app.onMessage('assistant',result.reply);
      if(signature(app.getState())===fingerprint){proposals=result.actions;proposalSignature=fingerprint;renderProposals();}
      else if(result.actions.length)app.notify('Your saved details changed while AI was replying. Ask again before applying changes.');
      photo=null;renderPhoto();app.speak(result.reply);
    } catch(error){showError(error);app.onMessage('assistant','AI could not complete this request. '+error.message);}
    finally{setBusy(false);}
    return true;
  }
  async function generate(purpose,message) {
    if(!connection.configured){app.notify('Connect your API key to use this feature.');app.switchView('connection');return;}
    if(busy)return;
    clearError();setBusy(true,purpose==='routine'?'Drafting your routine…':'Preparing the caregiver summary…');
    try {
      const result=await request('/api/chat',{message,purpose,context:app.getState()});
      if(purpose==='routine')openDraft(result.actions[0]);
      else{summary=result.reply;const output=$('care-summary');if(output){output.textContent=summary;output.hidden=false;}}
    }catch(error){showError(error);}
    finally{setBusy(false);}
  }
  document.addEventListener('submit',async event=>{
    if(event.target.id==='ai-connect-form'){
      event.preventDefault();if(busy)return;
      const apiKey=$('ai-key').value,model=$('ai-model').value;
      $('ai-key').value='';clearError();setBusy(true,'Testing your AI connection…');
      try{const result=await request('/api/connect',{apiKey,model});connection={...result,available:true};verified=true;renderStatus();renderConnection();app.notify('Connected to OpenAI. You can now chat naturally.');}
      catch(error){showError(error);if($('connection-feedback'))$('connection-feedback').textContent=error.message;}
      finally{setBusy(false);}
    }
    if(event.target.id==='ai-routine-form'){event.preventDefault();await generate('routine',$('ai-routine-description').value);}
    if(event.target.id==='routine-draft-form'){
      event.preventDefault();
      const steps=$('draft-steps').value.split('\n').map(s=>s.trim()).filter(Boolean);
      if(steps.some(s=>s.length>180)){app.notify('Keep each step under 180 characters.');return;}
      const result=app.onAction({type:'routine-create',title:$('draft-title').value,steps});
      if(result){draft=null;proposals=proposals.filter(a=>a.type!=='routine-create');renderProposals();$('routine-draft-dialog').close();app.notify('Routine saved. It is now available in Companion.');}
    }
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='ai-status')app.switchView('connection');
    if(button.id==='dismiss-ai-error')clearError();
    if(button.id==='test-ai'){
      if(busy)return;setBusy(true,'Testing the connection…');clearError();
      try{await request('/api/test',{});verified=true;renderConnection();app.notify('OpenAI responded successfully.');}
      catch(error){verified=false;showError(error);}
      finally{setBusy(false);}
    }
    if(button.id==='disconnect-ai'){
      if(busy)return;setBusy(true);
      try{await request('/api/disconnect',{});verified=false;proposals=[];renderProposals();await refresh();app.notify(connection.configured?'Session key removed. The server key is still configured.':'API key disconnected. Basic features are still available.');}
      catch(error){showError(error);}
      finally{setBusy(false);}
    }
    if(button.hasAttribute('data-apply-ai')){
      const index=Number(button.dataset.applyAi),action=proposals[index];
      if(!action)return;
      if(signature(app.getState())!==proposalSignature){proposals=[];renderProposals();app.notify('Your activity changed. Ask again for an up-to-date suggestion.');return;}
      if(action.type==='routine-create'){openDraft(action);return;}
      const result=app.onAction(action);
      if(result){proposals.splice(index,1);proposalSignature=signature(app.getState());renderProposals();app.notify(result.reply);}
    }
    if(button.hasAttribute('data-dismiss-ai')){proposals.splice(Number(button.dataset.dismissAi),1);renderProposals();}
    if(button.id==='generate-summary')await generate('summary','Prepare a concise caregiver handoff using only the recorded events and unresolved requests. State where the records are incomplete.');
    if(button.id==='attach-photo'){
      if(!connection.configured){app.notify('Connect your API key to ask about a photo.');app.switchView('connection');return;}
      $('photo-input').click();
    }
    if(button.id==='remove-photo'){photo=null;renderPhoto();}
  });
  $('photo-input').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){app.notify('Choose a JPG, PNG, or WebP image under 4 MB.');event.target.value='';return;}
    try{
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      photo={data,name:file.name};renderPhoto();
      if(!$('chat-input').value)$('chat-input').value='What can you tell me about this photo?';
      $('chat-input').focus();
    }catch{app.notify('The image could not be opened.');}
  });
  refresh();
  return {sendChat,renderStatus,renderConnection,careTools,refresh,isBusy:()=>busy,hasPhoto:()=>!!photo};
}
