const NAME_STORAGE_KEY = 'candy_last_name';

let myName = '';
let pendingAction = null;

function loadSavedName(){ try{ return localStorage.getItem(NAME_STORAGE_KEY) || ''; }catch(e){ return ''; } }

function saveNameIfOnline(){
  if(pendingAction === 'create' || pendingAction === 'join'){
    try{ localStorage.setItem(NAME_STORAGE_KEY, myName); }catch(e){}
  }
}

function buildLocalNameInputs(){
  const wrap = $('localNames');
  const build = () => {
    let n = Math.min(5, Math.max(2, parseInt($('localCount').value)||2));
    $('localCount').value = n;
    wrap.innerHTML = '';
    for(let i=0;i<n;i++){
      const div = document.createElement('div');
      div.className = 'name-item';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.placeholder = `Jugador ${i+1}`; inp.maxLength = 16;
      inp.value = i===0 ? myName : '';
      inp.id = `localName${i}`;
      div.appendChild(inp);
      wrap.appendChild(div);
    }
  };
  $('localCount').oninput = build;
  build();
}

function initMenuScreen(){
  $('btnLocal').onclick = () => { pendingAction = 'local'; $('myName').value = ''; show('screen-name'); };
  $('btnCreateRoom').onclick = () => { pendingAction = 'create'; $('myName').value = loadSavedName(); show('screen-name'); };
  $('btnJoinRoom').onclick = () => { pendingAction = 'join'; $('myName').value = loadSavedName(); show('screen-name'); };
  $('btnNameBack').onclick = () => show('screen-menu');
  $('btnNameContinue').onclick = () => {
    const v = $('myName').value.trim();
    if(!v){ $('nameMsg').textContent = 'Escribe un nombre.'; return; }
    myName = v;
    saveNameIfOnline();
    if(pendingAction === 'local'){ show('screen-local-setup'); buildLocalNameInputs(); }
    else if(pendingAction === 'create'){ startOnlineHost(); }
    else if(pendingAction === 'join'){ show('screen-join'); }
  };

  $('btnLocalBack').onclick = () => show('screen-menu');
  $('btnLocalContinue').onclick = () => {
    const n = Math.min(5, Math.max(2, parseInt($('localCount').value)||2));
    const players = [];
    for(let i=0;i<n;i++){
      const v = $(`localName${i}`).value.trim() || `Jugador ${i+1}`;
      players.push({id:'p'+i, name:v});
    }
    localMode = true;
    pendingPlayers = players;
    openConfigScreen();
  };
}
