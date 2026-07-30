/* ---------- utilidades ---------- */
const COLORS = ['#e63946','#f4a300','#ffe135','#38b000','#1e90ff','#00e5ff','#7cff6b','#ff6ec7','#a259ff'];
const $ = id => document.getElementById(id);
const show = id => { document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); $(id).classList.remove('hidden'); };
const rand = n => Math.floor(Math.random()*n);
const shuffleInPlace = arr => { for(let i=arr.length-1;i>0;i--){const j=rand(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };
const boardSizeFor = n => n + 3; // 2->5,3->6,4->7,5->8
const roomCode = () => Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rand(32)]).join('');
const maxWildcardsFor = n => n<=2 ? 2 : 3;
function rotationFrom(ids, startId){
  const idx = ids.indexOf(startId);
  return ids.slice(idx).concat(ids.slice(0,idx));
}
function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

/* ---------- notificaciones ---------- */
function showToast(text, kind){
  let layer = document.getElementById('toastLayer');
  if(!layer){
    layer = document.createElement('div');
    layer.id = 'toastLayer';
    document.body.appendChild(layer);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (kind === 'negative' ? 'negative' : 'positive');
  t.textContent = text;
  layer.appendChild(t);
  setTimeout(()=>{ t.remove(); }, 3000);
}

/* ---------- comodines ---------- */
const WILDCARDS = {
  saltar_turno:      {name:'Saltar turno',      cat:'protectores', icon:'⏭️', desc:'Salta tu turno.'},
  angel_guardian:    {name:'Ángel Guardián',    cat:'protectores', icon:'👼', desc:'Si mueres en tu próximo turno, revives.'},
  proteccion:        {name:'Protección',        cat:'protectores', icon:'🛡️', desc:'Bloquea el próximo comodín de ataque contra ti.'},
  foca_gordita:      {name:'Cerdo Gordito',     cat:'ataque',       icon:'🐷', desc:'Un rival debe comer 3 en su próximo turno. Se acumula si le cae más de uno.'},
  ruleta_rusa:       {name:'Ruleta Rusa',       cat:'ataque',       icon:'🎯', desc:'Sorteo de 3 chuches: 1 para ti, 2 para un rival.'},
  bloquea_comodines: {name:'Bloquea-Comodines', cat:'ataque',       icon:'🚫', desc:'Bloquea los comodines de un rival en su próximo turno.'},
  lupa:              {name:'Lupa',              cat:'informacion',  icon:'🔍', desc:'Revela (público) si 2 chuches están envenenadas.'},
  equilibrio:        {name:'Equilibrio',        cat:'informacion',  icon:'⚖️', desc:'Revela (público) medio tablero por filas.'},
  secretito:         {name:'Secretito',         cat:'informacion',  icon:'🤫', desc:'Ves la envenenada de un rival (solo tú).'},
  revertidor:        {name:'Revertidor',        cat:'interaccion',  icon:'🔄', desc:'Tu próxima chuche se invierte.'},
  martillo:          {name:'Martillo',          cat:'interaccion',  icon:'🔨', desc:'Destruye 2 chuches (aún debes comer).'},
  calavera:          {name:'Calavera',          cat:'interaccion',  icon:'💀', desc:'Añade una 2ª envenenada tuya.'},
  ladron:            {name:'Ladrón',            cat:'estrategico',  icon:'💰', desc:'Roba 1 comodín a un rival.'},
  reciclador:        {name:'Reciclador',        cat:'estrategico',  icon:'♻️', desc:'Al final de la tienda, coges 2 comodines extra.'},
  duplicador:        {name:'Duplicador',        cat:'estrategico',  icon:'✨', desc:'Duplica un comodín que ya tengas.'},
};
const CATS = ['protectores','ataque','informacion','interaccion','estrategico'];
const CAT_LABEL = {protectores:'🛡️ Protectores', ataque:'⚔️ Ataque', informacion:'🔎 Información', interaccion:'🎲 Interacción', estrategico:'♟️ Estratégico'};
const SIMPLE_WILDCARDS = ['saltar_turno','angel_guardian','revertidor'];
const DEFENSIBLE_WILDCARDS = ['foca_gordita','bloquea_comodines','ruleta_rusa','secretito'];

/* ---------- estado del juego ---------- */
let game = null;
let localMode = false;
let uiMode = null;      // selección de celdas/filas en curso
let lastWheelId = -1;

const SKINS = { osito:'🧸', caramelo:'🍬', piruleta:'🍭', donut:'🍩', galleta:'🍪' };
function buildPool(numPlayers, stock){
  const pool = {};
  Object.keys(WILDCARDS).forEach(id => pool[id] = stock);
  if(numPlayers <= 2){ pool.secretito = 0; pool.calavera = 0; }
  return pool;
}

function newGame(playerList, config){
  const rows = config.rows, cols = config.cols;
  const colors = Array.from({length: rows*cols}, ()=>COLORS[rand(COLORS.length)]);
  const ids = playerList.map(p=>p.id);
  const inventories = {}; ids.forEach(id=>inventories[id]=[]);
  const flags = {}; ids.forEach(id=>flags[id]={guardianArmed:false, forcedEats:0, forcedCells:[], blocked:false, revertidor:false, lives:config.lives});
  return {
    phase:'shopWheel',
    rows, cols, colors, skin: config.skin,
    players: playerList,
    poison:{}, eaten:{},
    alive: ids.slice(),
    order:[], turnIdx:0,
    maxWildcards: config.maxWildcards,
    poisonCount: config.poisonCount,
    livesConfig: config.lives,
    actionTimeSec: config.actionTimeSec,
    poisonTimeSec: config.poisonTimeSec,
    pool: buildPool(playerList.length, config.wildcardStock),
    pickOrder:[], pickIdx:0, shopStage:null,
    recycleQueue:[], recycleRemaining:0,
    inventories, flags,
    publicInfo:{}, secretVision:{}, equilibrioLog:[],
    pendingRuleta:null, pendingDefense:null,
    lastMessage:'',
    wheelId:0, wheelPurpose:null, wheelResultId:null,
    resultWinnerId:null, resultWinners:null, eliminationOrder:[],
    shopTimerEnd:0, turnTimerEnd:null, poisonTimerEnd:null,
    eventSeq:0, event:null,
  };
}
function enterPoisonPhase(){ game.phase = 'poison'; resetPoisonTimer(); }
function fireEvent(type){ game.eventSeq = (game.eventSeq||0)+1; game.event = {seq: game.eventSeq, type}; }
function nameOf(id){ const p = game.players.find(p=>p.id===id); return p ? p.name : '?'; }
function isCellPoison(c){ return Object.values(game.poison).some(cells=>cells.includes(c)); }
function currentPlayerId(){ return game.order[game.turnIdx % game.order.length]; }
function poisonRemainingAll(){
  let n=0;
  for(const pid in game.poison) for(const c of game.poison[pid]) if(game.eaten[c]===undefined) n++;
  return n;
}
function removeOne(pid, typeId){
  const inv = game.inventories[pid];
  const i = inv.indexOf(typeId);
  if(i>=0) inv.splice(i,1);
}
function pruneForcedCells(fl){
  if(fl.forcedCells && fl.forcedCells.length){
    fl.forcedCells = fl.forcedCells.filter(c => game.eaten[c] === undefined);
  }
}

/* ================= NOMBRE GUARDADO (solo online) ================= */
const NAME_STORAGE_KEY = 'candy_last_name';
function loadSavedName(){ try{ return localStorage.getItem(NAME_STORAGE_KEY) || ''; }catch(e){ return ''; } }
function saveNameIfOnline(){
  if(pendingAction === 'create' || pendingAction === 'join'){
    try{ localStorage.setItem(NAME_STORAGE_KEY, myName); }catch(e){}
  }
}

/* ================= MENU / NOMBRE ================= */
let myName = '';
let pendingAction = null;
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

/* ================= LOCAL MODE ================= */
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

/* ================= RED (PeerJS, host-autoritativo) ================= */
let peer = null, myId = null, isHost = false;
let hostConns = {};
let hostConn = null;
let lobbyPlayersList = [];

function cleanupNetwork(){
  try{ if(peer) peer.destroy(); }catch(e){}
  peer = null; hostConns = {}; hostConn = null; isHost = false;
}

function updateLeaveButtonVisibility(){
  const online = !localMode && (peer || hostConn);
  $('btnGameLeave').classList.toggle('hidden', !online);
}
$('btnGameLeave').onclick = () => leaveOnlineGame();
$('btnLobbyLeave').onclick = () => leaveOnlineGame();
function leaveOnlineGame(){
  if(localMode) return;
  cleanupNetwork();
  updateLeaveButtonVisibility();
  showToast('Has abandonado la partida.', 'negative');
  show('screen-menu');
}

function startOnlineHost(){
  isHost = true;
  const code = roomCode();
  peer = new Peer('candy-'+code, {debug:0});
  peer.on('open', id => {
    myId = id;
    lobbyPlayersList = [{id: myId, name: myName}];
    $('roomCodeDisplay').textContent = code;
    show('screen-lobby');
    $('lobbyMsg').textContent = 'Comparte el código para que se unan.';
    $('btnStartOnline').classList.remove('hidden');
    updateLeaveButtonVisibility();
    renderLobby();
  });
  peer.on('connection', conn => {
    conn.on('open', () => {});
    conn.on('data', data => handleHostData(conn, data));
    conn.on('close', () => {
      const leaving = lobbyPlayersList.find(p=>p.id===conn.peer);
      lobbyPlayersList = lobbyPlayersList.filter(p=>p.id!==conn.peer);
      delete hostConns[conn.peer];
      renderLobby();
      if(leaving){
        showToast(`${leaving.name} ha abandonado la partida.`, 'negative');
        broadcastToast(`${leaving.name} ha abandonado la partida.`, 'negative');
      }
    });
  });
  peer.on('error', err => { $('lobbyMsg').textContent = 'Error: '+err.type; });
}

function renderLobby(){
  const box = $('lobbyPlayers');
  box.innerHTML = '';
  lobbyPlayersList.forEach(p=>{
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (p.id===myId?' me':'');
    chip.textContent = p.name + (p.id===myId ? (isHost ? ' (tú, host)' : ' (tú)') : '');
    box.appendChild(chip);
  });
}

function handleHostData(conn, data){
  if(data.type === 'join'){
    if(lobbyPlayersList.length >= 5){ conn.send({type:'full'}); return; }
    hostConns[conn.peer] = conn;
    lobbyPlayersList.push({id: conn.peer, name: data.name});
    renderLobby();
    broadcastLobby();
    conn.send({type:'joined', hostName: myName});
    showToast(`${data.name} se ha unido a la partida.`, 'positive');
    broadcastToast(`${data.name} se ha unido a la partida.`, 'positive', conn.peer);
  } else if(data.type === 'action'){
    if(!game || data.action.actorId !== conn.peer) return;
    applyAction(data.action);
    afterMutation();
  }
}
function broadcastLobby(){
  for(const id in hostConns) hostConns[id].send({type:'lobby', players: lobbyPlayersList});
}
function broadcastSync(){
  for(const id in hostConns) hostConns[id].send({type:'sync', game});
}
function broadcastToast(text, kind, excludeId){
  for(const id in hostConns){ if(id !== excludeId) hostConns[id].send({type:'toast', text, kind}); }
}

$('btnStartOnline').onclick = () => {
  if(lobbyPlayersList.length < 2){ $('lobbyMsg').textContent = 'Necesitas al menos 2 jugadores.'; return; }
  pendingPlayers = lobbyPlayersList.map(p=>({id:p.id, name:p.name}));
  for(const id in hostConns) hostConns[id].send({type:'hostConfiguring'});
  openConfigScreen();
};

$('btnJoinBack').onclick = () => show('screen-menu');
$('btnDoJoin').onclick = () => {
  const code = $('joinCode').value.trim().toUpperCase();
  if(!code){ $('joinMsg').textContent = 'Escribe un código.'; return; }
  isHost = false;
  peer = new Peer(undefined, {debug:0});
  peer.on('open', id => {
    myId = id;
    hostConn = peer.connect('candy-'+code, {reliable:true});
    hostConn.on('open', () => {
      hostConn.send({type:'join', name: myName});
      show('screen-lobby');
      $('roomCodeDisplay').textContent = code;
      $('lobbyMsg').textContent = 'Esperando a que el anfitrión empiece...';
      updateLeaveButtonVisibility();
    });
    hostConn.on('data', data => handlePeerData(data));
    hostConn.on('close', () => { $('lobbyMsg').textContent = 'Conexión perdida con el anfitrión.'; });
  });
  peer.on('error', err => { $('joinMsg').textContent = 'Error: '+err.type; });
};

function handlePeerData(data){
  if(data.type === 'full'){ $('lobbyMsg').textContent = 'Sala llena (máx. 5).'; }
  else if(data.type === 'lobby'){ lobbyPlayersList = data.players; renderLobby(); }
  else if(data.type === 'hostConfiguring'){ $('lobbyMsg').textContent = 'El anfitrión está configurando la partida...'; }
  else if(data.type === 'joined'){ showToast(`Te has unido a la partida de ${data.hostName}.`, 'positive'); }
  else if(data.type === 'toast'){ showToast(data.text, data.kind); }
  else if(data.type === 'sync'){ game = data.game; renderCurrentPhase(); }
}

/* ================= CONFIGURACIÓN DE SALA ================= */
let pendingPlayers = [];
function populateTimeSelect(selId, defaultVal){
  const sel = $(selId); sel.innerHTML = '';
  const opt0 = document.createElement('option'); opt0.value = '0'; opt0.textContent = 'Sin cronómetro'; sel.appendChild(opt0);
  for(let t=10; t<=120; t+=10){ const o=document.createElement('option'); o.value=String(t); o.textContent=t+'s'; sel.appendChild(o); }
  const optInf = document.createElement('option'); optInf.value = 'inf'; optInf.textContent = '∞ Infinito'; sel.appendChild(optInf);
  sel.value = String(defaultVal);
}
function populateSkinOptions(){
  const sel = $('cfgSkin'); sel.innerHTML = '';
  Object.keys(SKINS).forEach(key=>{ const o=document.createElement('option'); o.value=key; o.textContent = `${SKINS[key]} ${key}`; sel.appendChild(o); });
  sel.value = 'osito';
  $('skinPreview').textContent = SKINS['osito'];
}
$('cfgSkin').onchange = () => { $('skinPreview').textContent = SKINS[$('cfgSkin').value] || '🧸'; };
function openConfigScreen(){
  const n = pendingPlayers.length;
  const def = boardSizeFor(n);
  $('cfgRows').value = def; $('cfgCols').value = def;
  $('cfgMaxWildcards').value = maxWildcardsFor(n);
  $('cfgPoisonCount').value = 1;
  $('cfgLives').value = 1;
  $('cfgStock').value = 1;
  $('cfgRandom').checked = false;
  populateTimeSelect('cfgActionTime', 30);
  populateTimeSelect('cfgPoisonTime', 20);
  populateSkinOptions();
  show('screen-config');
}
$('btnConfigBack').onclick = () => show(localMode ? 'screen-local-setup' : 'screen-lobby');
$('btnConfigContinue').onclick = () => {
  const parseTime = (val) => val === 'inf' ? 'inf' : clamp(parseInt(val)||0, 0, 120);
  const config = {
    rows: clamp(parseInt($('cfgRows').value)||5, 2, 10),
    cols: clamp(parseInt($('cfgCols').value)||5, 2, 10),
    maxWildcards: clamp(parseInt($('cfgMaxWildcards').value)||0, 0, 15),
    actionTimeSec: parseTime($('cfgActionTime').value),
    poisonTimeSec: parseTime($('cfgPoisonTime').value),
    poisonCount: clamp(parseInt($('cfgPoisonCount').value)||1, 1, 9),
    lives: clamp(parseInt($('cfgLives').value)||1, 1, 5),
    wildcardStock: clamp(parseInt($('cfgStock').value)||1, 1, 9),
    skin: $('cfgSkin').value || 'osito',
    randomWildcards: $('cfgRandom').checked,
  };
  finishConfigAndStart(config);
};
function finishConfigAndStart(config){
  game = newGame(pendingPlayers, config);
  if(config.maxWildcards > 0 && config.randomWildcards){
    dealWildcardsRandom();
    enterPoisonPhase();
    afterMutation();
  } else if(config.maxWildcards > 0){
    beginWheel('shop');
  } else {
    enterPoisonPhase();
    afterMutation();
  }
}
function dealWildcardsRandom(){
  const g = game;
  g.players.forEach(p=>{
    while(g.inventories[p.id].length < g.maxWildcards){
      const avail = Object.keys(WILDCARDS).filter(id=>g.pool[id]>0);
      if(!avail.length) break;
      const t = avail[rand(avail.length)];
      g.pool[t]--; g.inventories[p.id].push(t);
    }
  });
  g.players.forEach(p=>{
    if(!g.inventories[p.id].includes('reciclador')) return;
    for(let k=0;k<2;k++){
      const avail = Object.keys(WILDCARDS).filter(id=>g.pool[id]>0);
      if(!avail.length) break;
      const t = avail[rand(avail.length)];
      g.pool[t]--; g.inventories[p.id].push(t);
    }
  });
}

/* ================= DISPATCH (unifica local y online) ================= */
function dispatch(action){
  if(localMode || isHost){ applyAction(action); afterMutation(); }
  else if(hostConn){ hostConn.send({type:'action', action}); }
}
function afterMutation(){
  if(!game) return;
  if((localMode || isHost) && game.phase==='poison' && game.players.every(p=>game.poison[p.id]!==undefined)){
    beginWheel('eat');
    return;
  }
  if(!localMode && isHost) broadcastSync();
  renderCurrentPhase();
}

/* ================= RUEDA ================= */
function beginWheel(purpose){
  const g = game;
  const poolIds = purpose==='shop' ? g.players.map(p=>p.id) : g.alive;
  const resultId = poolIds[rand(poolIds.length)];
  g.wheelId = (g.wheelId||0)+1;
  g.wheelPurpose = purpose;
  g.wheelResultId = resultId;
  g.phase = purpose==='shop' ? 'shopWheel' : 'eatWheel';
  afterMutation();
}
function finalizeWheel(){
  const g = game;
  if(g.wheelPurpose === 'shop'){
    g.pickOrder = rotationFrom(g.players.map(p=>p.id), g.wheelResultId);
    g.pickIdx = 0; g.shopStage = null;
    g.phase = 'shop';
    resetShopTimer();
  } else {
    g.order = rotationFrom(g.players.map(p=>p.id), g.wheelResultId).filter(id=>g.alive.includes(id));
    g.turnIdx = 0;
    g.phase = 'game';
    resetTurnTimer();
  }
  afterMutation();
}
function runWheelAnimation(names, resultName, onDone){
  let ticks = 0; const maxTicks = 18 + rand(6);
  const interval = setInterval(()=>{
    $('wheelName').textContent = names[ticks % names.length];
    ticks++;
    if(ticks >= maxTicks){
      clearInterval(interval);
      $('wheelName').textContent = resultName;
      setTimeout(onDone, 900);
    }
  }, 110);
}
function handleWheelPhase(){
  show('screen-wheel');
  if(game.wheelId === lastWheelId) return;
  lastWheelId = game.wheelId;
  const names = game.players.map(p=>p.name);
  runWheelAnimation(names, nameOf(game.wheelResultId), () => {
    // red de seguridad: si algo falla al cerrar la rueda, no debe quedarse la pantalla congelada
    try{
      if(localMode || isHost) finalizeWheel();
    }catch(e){
      console.error(e);
      if(localMode || isHost) afterMutation();
    }
  });
}

/* ================= FASE TIENDA (comodines) ================= */
function advancePickIdx(){
  const g = game;
  const n = g.pickOrder.length;
  for(let step=0; step<n; step++){
    g.pickIdx = (g.pickIdx+1) % n;
    const pid = g.pickOrder[g.pickIdx];
    if(g.inventories[pid].length < g.maxWildcards) return;
  }
  const recyclers = g.pickOrder.filter(pid => g.inventories[pid].includes('reciclador'));
  if(recyclers.length){
    g.shopStage = 'recycle';
    g.recycleQueue = recyclers.slice();
    g.recycleRemaining = 2;
  } else {
    enterPoisonPhase();
  }
}
let shopTickHandle = null;
const SHOP_TIME_MS = 20000;
function resetShopTimer(){ game.shopTimerEnd = Date.now() + SHOP_TIME_MS; }
function ensureShopTicker(){
  if(shopTickHandle) return;
  shopTickHandle = setInterval(()=>{
    if(!game || game.phase !== 'shop'){ clearInterval(shopTickHandle); shopTickHandle = null; return; }
    updateShopTimerDisplay();
    if((localMode || isHost) && Date.now() >= game.shopTimerEnd){ autoPickForCurrent(); }
  }, 400);
}
function updateShopTimerDisplay(){
  const el = $('shopTimer');
  if(!el) return;
  const remaining = Math.max(0, Math.ceil((game.shopTimerEnd - Date.now())/1000));
  el.textContent = `⏱️ ${remaining}s`;
}
function autoPickForCurrent(){
  const g = game;
  const recycling = g.shopStage === 'recycle';
  const curId = recycling ? g.recycleQueue[0] : g.pickOrder[g.pickIdx];
  const availableTypes = Object.keys(WILDCARDS).filter(id => g.pool[id] > 0);
  if(!availableTypes.length){
    if(recycling){
      g.recycleQueue.shift();
      if(g.recycleQueue.length){ g.recycleRemaining = 2; }
      else { g.shopStage = null; enterPoisonPhase(); }
    } else {
      advancePickIdx();
    }
    if(g.phase === 'shop') resetShopTimer();
    afterMutation();
    return;
  }
  const typeId = availableTypes[rand(availableTypes.length)];
  dispatch({type:'pickWildcard', actorId:curId, typeId});
}

/* ================= CRONÓMETRO DE TURNO ================= */
// ponytail: se reinicia en cada acción exitosa (no solo al cambiar de turno) para simplificar;
// una serie de mordiscos obligatorios (Cerdo Gordito/Ruleta Rusa) por tanto siempre tiene tiempo fresco.
let turnWarnPlayed = false;
function resetTurnTimer(){
  turnWarnPlayed = false;
  if(game.actionTimeSec === 0 || game.actionTimeSec === 'inf'){ game.turnTimerEnd = null; return; }
  game.turnTimerEnd = Date.now() + game.actionTimeSec*1000;
}
let gameTickHandle = null;
function ensureGameTicker(){
  if(gameTickHandle) return;
  gameTickHandle = setInterval(()=>{
    if(!game || game.phase !== 'game'){ clearInterval(gameTickHandle); gameTickHandle = null; return; }
    updateActionTimerDisplay();
    if(game.actionTimeSec !== 0 && game.actionTimeSec !== 'inf'){
      const remaining = Math.ceil((game.turnTimerEnd - Date.now())/1000);
      if(remaining <= 5 && remaining > 0 && !turnWarnPlayed){ turnWarnPlayed = true; sfxTimeWarning(); }
      if((localMode || isHost) && Date.now() >= game.turnTimerEnd){ autoActForTimeout(); }
    }
  }, 400);
}
function updateActionTimerDisplay(){
  const el = $('actionTimerDisplay');
  if(!el || !game) return;
  if(game.actionTimeSec === 'inf'){ el.textContent = '⏱️ ∞'; return; }
  const remaining = Math.max(0, Math.ceil((game.turnTimerEnd - Date.now())/1000));
  el.textContent = `⏱️ ${remaining}s`;
}
function autoActForTimeout(){
  const g = game;
  if(g.pendingDefense){ dispatch({type:'defenseChoice', actorId:g.pendingDefense.targetId, use:false}); return; }
  if(g.pendingRuleta){ const opts=g.pendingRuleta.options; dispatch({type:'ruletaChoice', actorId:g.pendingRuleta.activatorId, cell:opts[rand(opts.length)]}); return; }
  const curId = currentPlayerId();
  const fl = g.flags[curId]; pruneForcedCells(fl);
  if(fl.forcedCells && fl.forcedCells.length){ dispatch({type:'eat', actorId:curId, cell:fl.forcedCells[0]}); return; }
  const avail = [];
  for(let i=0;i<g.colors.length;i++) if(g.eaten[i]===undefined) avail.push(i);
  if(avail.length) dispatch({type:'eat', actorId:curId, cell:avail[rand(avail.length)]});
}

/* ================= CRONÓMETRO DE VENENO ================= */
let poisonTickHandle = null;
function resetPoisonTimer(){
  if(game.poisonTimeSec === 0 || game.poisonTimeSec === 'inf'){ game.poisonTimerEnd = null; return; }
  game.poisonTimerEnd = Date.now() + game.poisonTimeSec*1000;
}
function ensurePoisonTicker(){
  if(poisonTickHandle) return;
  poisonTickHandle = setInterval(()=>{
    if(!game || game.phase !== 'poison'){ clearInterval(poisonTickHandle); poisonTickHandle = null; return; }
    updatePoisonTimerDisplay();
    if(game.poisonTimeSec !== 0 && game.poisonTimeSec !== 'inf' && (localMode || isHost) && Date.now() >= game.poisonTimerEnd){
      autoAssignPoisonForTimeout();
    }
  }, 400);
}
function updatePoisonTimerDisplay(){
  const el = $('poisonTimer');
  if(!el || !game) return;
  if(game.poisonTimeSec === 0){ el.textContent = ''; return; }
  if(game.poisonTimeSec === 'inf'){ el.textContent = '⏱️ ∞'; return; }
  const remaining = Math.max(0, Math.ceil((game.poisonTimerEnd - Date.now())/1000));
  el.textContent = `⏱️ ${remaining}s`;
}
function assignRandomPoison(pid){
  const g = game;
  const total = g.colors.length;
  const cells = [];
  while(cells.length < g.poisonCount && cells.length < total){
    const c = rand(total);
    if(!cells.includes(c)) cells.push(c);
  }
  g.poison[pid] = cells;
}
function autoAssignPoisonForTimeout(){
  const g = game;
  if(localMode){
    const pending = g.players.find(p => g.poison[p.id]===undefined);
    if(!pending) return;
    poisonPickState = null;
    assignRandomPoison(pending.id);
    resetPoisonTimer();
    afterMutation();
  } else {
    g.players.forEach(p=>{ if(g.poison[p.id]===undefined) assignRandomPoison(p.id); });
    afterMutation();
  }
}

function renderShop(){
  const g = game;
  ensureShopTicker();
  updateShopTimerDisplay();
  const recycling = g.shopStage === 'recycle';
  const curId = recycling ? g.recycleQueue[0] : g.pickOrder[g.pickIdx];
  $('shopHeader').textContent = recycling
    ? `♻️ ${nameOf(curId)} elige comodines extra (Reciclador) — ${g.recycleRemaining} restante(s)`
    : `${nameOf(curId)} elige un comodín (${g.inventories[curId].length}/${g.maxWildcards})`;
  const canAct = localMode || myId === curId;
  const wrap = $('shopShelves'); wrap.innerHTML = '';
  CATS.forEach(cat=>{
    const shelf = document.createElement('div'); shelf.className = 'shelf';
    const h = document.createElement('div'); h.className = 'shelf-title'; h.textContent = CAT_LABEL[cat];
    shelf.appendChild(h);
    const itemsWrap = document.createElement('div'); itemsWrap.className = 'shelf-items';
    Object.keys(WILDCARDS).filter(id => WILDCARDS[id].cat === cat).forEach(id=>{
      const count = g.pool[id];
      const btn = document.createElement('button');
      btn.className = 'wc-item';
      btn.title = WILDCARDS[id].desc;
      btn.innerHTML = `<span class="wc-icon">${WILDCARDS[id].icon}</span><span>${WILDCARDS[id].name}</span><span class="wc-count">x${count}</span>`;
      btn.disabled = count<=0 || !canAct;
      if(!btn.disabled) btn.onclick = () => dispatch({type:'pickWildcard', actorId:curId, typeId:id});
      itemsWrap.appendChild(btn);
    });
    shelf.appendChild(itemsWrap);
    wrap.appendChild(shelf);
  });
  const inv = $('shopInventories'); inv.innerHTML = '<b style="font-size:0.85rem;">Comodines elegidos</b>';
  g.players.forEach(p=>{
    const d = document.createElement('div'); d.className = 'inv-row';
    d.innerHTML = `<b>${p.name}</b>: ${g.inventories[p.id].map(id=>WILDCARDS[id].icon).join(' ')||'—'}`;
    inv.appendChild(d);
  });
}

/* ================= FASE VENENO ================= */
let poisonPickState = null;
function handlePoisonPick(forId, i){
  if(!poisonPickState || poisonPickState.forId !== forId) return;
  if(poisonPickState.picked.includes(i)) return;
  poisonPickState.picked.push(i);
  if(poisonPickState.picked.length >= game.poisonCount){
    const cells = poisonPickState.picked.slice();
    poisonPickState = null;
    dispatch({type:'setPoison', actorId:forId, cells});
  } else {
    renderPoisonScreen();
  }
}
function renderPoisonScreen(){
  const g = game;
  ensurePoisonTicker();
  updatePoisonTimerDisplay();
  if(localMode){
    const pending = g.players.find(p => g.poison[p.id]===undefined);
    if(!pending) return;
    if(!poisonPickState || poisonPickState.forId !== pending.id) poisonPickState = {forId: pending.id, picked: []};
    $('poisonPrompt').textContent = `Pásale el móvil a ${pending.name}. Elige ${g.poisonCount} chuche(s) envenenada(s) (${poisonPickState.picked.length}/${g.poisonCount}).`;
    renderGameBoard($('poisonBoard'), g, {
      pickedSet: new Set(poisonPickState.picked),
      onPick: (i)=> handlePoisonPick(pending.id, i)
    });
  } else {
    const already = g.poison[myId] !== undefined;
    if(already){
      $('poisonPrompt').textContent = 'Ya elegiste. Esperando a los demás...';
      renderGameBoard($('poisonBoard'), g, { minePoisonSet: new Set(g.poison[myId]) });
    } else {
      if(!poisonPickState || poisonPickState.forId !== myId) poisonPickState = {forId: myId, picked: []};
      $('poisonPrompt').textContent = `Elige ${g.poisonCount} chuche(s) envenenada(s) (${poisonPickState.picked.length}/${g.poisonCount}). Nadie más la verá.`;
      renderGameBoard($('poisonBoard'), g, {
        pickedSet: new Set(poisonPickState.picked),
        onPick: (i)=> handlePoisonPick(myId, i)
      });
    }
  }
}

/* ================= TABLERO (juego) ================= */
function renderGameBoard(container, g, opts){
  opts = opts || {};
  const skinEmoji = SKINS[g.skin] || '🧸';
  const freshBoard = container.children.length !== g.colors.length;
  if(freshBoard){
    container.style.gridTemplateColumns = `repeat(${g.cols}, minmax(28px, 42px))`;
    container.innerHTML = '';
    for(let i=0;i<g.colors.length;i++){
      const d = document.createElement('div');
      d.className = 'candy candy-enter';
      d.style.setProperty('--i', i);
      d.style.background = g.colors[i];
      container.appendChild(d);
    }
  }
  for(let i=0;i<g.colors.length;i++){
    const d = container.children[i];
    d.classList.remove('eaten','wasPoison','mine-poison','secret-vision','roulette-pick','ui-picked','forced-pick','row-highlight','info-poison','info-safe');
    const eatenInfo = g.eaten[i];
    if(eatenInfo){
      d.classList.add('eaten');
      if(eatenInfo.by === 'destroyed'){ d.textContent = '💥'; }
      else { d.textContent = skinEmoji; if(eatenInfo.poisoned) d.classList.add('wasPoison'); }
    } else {
      d.textContent = skinEmoji;
      if(g.publicInfo && g.publicInfo[i] !== undefined) d.classList.add(g.publicInfo[i] ? 'info-poison' : 'info-safe');
    }
    if(opts.minePoisonSet && opts.minePoisonSet.has(i)) d.classList.add('mine-poison');
    if(opts.secretSet && opts.secretSet.has(i)) d.classList.add('secret-vision');
    if(opts.rouletteSet && opts.rouletteSet.has(i)) d.classList.add('roulette-pick');
    if(opts.pickedSet && opts.pickedSet.has(i)) d.classList.add('ui-picked');
    if(opts.forcedSet && opts.forcedSet.has(i)) d.classList.add('forced-pick');
    if(opts.rowHighlight && opts.rowHighlight.has(Math.floor(i/g.cols))) d.classList.add('row-highlight');
    d.onclick = (!eatenInfo && opts.onPick) ? (() => opts.onPick(i)) : null;
  }
}

/* ================= PANTALLA DE JUEGO ================= */
let lastPlayedEventSeq = -1;
function playEventSound(){
  if(!game.event || game.event.seq === lastPlayedEventSeq) return;
  lastPlayedEventSeq = game.event.seq;
  if(game.event.type === 'eat-safe') sfxEatSafe();
  else if(game.event.type === 'eat-poison') sfxEatPoison();
  else if(game.event.type === 'wildcard') sfxWildcard();
  else if(game.event.type === 'pick-coin') sfxCoin();
}
function renderCurrentPhase(){
  if(!game) return;
  playEventSound();
  switch(game.phase){
    case 'shopWheel': handleWheelPhase(); break;
    case 'shop': show('screen-shop'); renderShop(); break;
    case 'poison': show('screen-poison'); renderPoisonScreen(); break;
    case 'eatWheel': handleWheelPhase(); break;
    case 'game': show('screen-game'); renderGameScreenFull(); break;
    case 'result': show('screen-result'); renderResultScreen(); break;
  }
}
function renderGameScreenFull(){
  const g = game;
  ensureGameTicker();
  updateLeaveButtonVisibility();
  const curId = currentPlayerId();
  $('turnBanner').textContent = `Turno de ${nameOf(curId)}`;
  $('gameMsg').textContent = g.lastMessage || '';

  renderLeftInventories();
  renderRightActions(curId);
  renderUiModeBar();
  renderDefenseBox();
  renderEquilibrioLog();

  const iAmActor = localMode || myId === curId;
  const minePoisonSet = (!localMode && g.poison[myId]) ? new Set(g.poison[myId]) : new Set();
  const secretSet = new Set();
  if(!localMode && g.secretVision[myId] !== undefined){
    (g.poison[g.secretVision[myId]] || []).forEach(c=>secretSet.add(c));
  }
  const rouletteSet = g.pendingRuleta ? new Set(g.pendingRuleta.options) : null;
  const pickedSet = (uiMode && uiMode.picked) ? new Set(uiMode.picked) : null;
  const rowHighlight = (uiMode && uiMode.type==='equilibrio') ? new Set(uiMode.rows) : null;
  let forcedSet = null;
  if(iAmActor && !g.pendingDefense && !g.pendingRuleta){
    const fl = g.flags[curId];
    pruneForcedCells(fl);
    if(fl.forcedCells && fl.forcedCells.length){
      forcedSet = new Set([fl.forcedCells[0]]);
      $('gameMsg').textContent = 'Debes comer la chuche marcada en azul.';
    } else if(fl.forcedEats > 0){
      $('gameMsg').textContent = `Te quedan ${fl.forcedEats} mordisco(s) obligatorios.`;
    }
  }

  renderGameBoard($('gameBoard'), g, {
    minePoisonSet, secretSet, rouletteSet, pickedSet, rowHighlight, forcedSet,
    onPick: computeBoardClickHandler(curId, iAmActor)
  });
}
function renderDefenseBox(){
  const box = $('defenseBox');
  const pd = game.pendingDefense;
  if(!pd){ box.classList.add('hidden'); box.innerHTML=''; return; }
  box.classList.remove('hidden');
  box.innerHTML = '';
  const iAmTarget = localMode || myId === pd.targetId;
  if(iAmTarget){
    const title = document.createElement('div');
    title.style.fontWeight = '700'; title.style.marginBottom = '0.5rem';
    title.textContent = (localMode ? `Pásale el móvil a ${nameOf(pd.targetId)}. ` : '') + `${nameOf(pd.attackerId)} te ataca con ${WILDCARDS[pd.typeId].name}. ¿Usas Protección?`;
    box.appendChild(title);
    const yes = document.createElement('button'); yes.textContent = '🛡️ Usar Protección'; yes.style.marginRight='0.5rem';
    yes.onclick = () => dispatch({type:'defenseChoice', actorId:pd.targetId, use:true});
    const no = document.createElement('button'); no.className='secondary'; no.textContent = 'No usar';
    no.onclick = () => dispatch({type:'defenseChoice', actorId:pd.targetId, use:false});
    box.appendChild(yes); box.appendChild(no);
  } else {
    box.innerHTML = `<div class="msg">Esperando la decisión de ${nameOf(pd.targetId)}...</div>`;
  }
}
function renderEquilibrioLog(){
  const box = $('equilibrioLogBox');
  if(!game.equilibrioLog.length){ box.textContent=''; return; }
  box.innerHTML = game.equilibrioLog.map(e=>`⚖️ ${e.by} (filas ${e.rows.join(',')}): ${e.hasPoison?'SÍ hay veneno':'no hay veneno'}`).join('<br>');
}
function computeBoardClickHandler(curId, iAmActor){
  const g = game;
  if(g.pendingDefense) return null;
  if(g.pendingRuleta){
    if(g.pendingRuleta.activatorId === curId && iAmActor){
      return (i) => { if(g.pendingRuleta.options.includes(i)) dispatch({type:'ruletaChoice', actorId:curId, cell:i}); };
    }
    return null;
  }
  if(!iAmActor) return null;
  if(uiMode){
    return (i) => handleUiModeCellClick(i);
  }
  const fl = g.flags[curId];
  pruneForcedCells(fl);
  if(fl.forcedCells && fl.forcedCells.length){
    const allowed = fl.forcedCells[0];
    return (i) => { if(i===allowed) dispatch({type:'eat', actorId:curId, cell:i}); };
  }
  return (i) => dispatch({type:'eat', actorId:curId, cell:i});
}
function handleUiModeCellClick(i){
  if(game.eaten[i] !== undefined) return;
  if(uiMode.type==='lupa' || uiMode.type==='martillo'){
    if(uiMode.picked.includes(i)) return;
    uiMode.picked.push(i);
    if(uiMode.picked.length >= uiMode.need){
      const cells = uiMode.picked.slice(); const typeId = uiMode.type; const actorId = currentPlayerId();
      uiMode = null;
      dispatch({type:'activate', actorId, typeId, cells});
    } else { renderGameScreenFull(); }
  } else if(uiMode.type==='calavera'){
    const actorId = currentPlayerId();
    uiMode = null;
    dispatch({type:'activate', actorId, typeId:'calavera', cell:i});
  } else if(uiMode.type==='equilibrio'){
    const row = Math.floor(i / game.cols);
    const idx = uiMode.rows.indexOf(row);
    if(idx>=0) uiMode.rows.splice(idx,1); else uiMode.rows.push(row);
    renderGameScreenFull();
  }
}
function renderUiModeBar(){
  const bar = $('uiModeBar');
  bar.innerHTML = '';
  if(!uiMode){ bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  if(uiMode.type==='equilibrio'){
    const span = document.createElement('span'); span.className='msg';
    span.textContent = `Filas elegidas: ${uiMode.rows.length}/${uiMode.rowsNeeded}`;
    bar.appendChild(span);
    const confirmBtn = document.createElement('button'); confirmBtn.className='small'; confirmBtn.textContent='Confirmar';
    confirmBtn.disabled = uiMode.rows.length !== uiMode.rowsNeeded;
    confirmBtn.onclick = () => {
      const rows = uiMode.rows.slice(); const actorId = currentPlayerId();
      uiMode = null;
      dispatch({type:'activate', actorId, typeId:'equilibrio', rows});
    };
    bar.appendChild(confirmBtn);
  } else {
    const span = document.createElement('span'); span.className='msg';
    span.textContent = `Elige ${uiMode.need - uiMode.picked.length} chuche(s) más para ${WILDCARDS[uiMode.type].name}`;
    bar.appendChild(span);
  }
  const cancelBtn = document.createElement('button'); cancelBtn.className='small secondary'; cancelBtn.textContent='Cancelar';
  cancelBtn.onclick = () => { uiMode = null; renderGameScreenFull(); };
  bar.appendChild(cancelBtn);
}
function renderLeftInventories(){
  const box = $('otherInventories'); box.innerHTML = '';
  const curId = currentPlayerId();
  game.players.forEach(p=>{
    const row = document.createElement('div');
    row.className = 'inv-row' + (p.id===curId?' turn':'') + (!game.alive.includes(p.id)?' out':'');
    const icons = game.inventories[p.id].map(t=>`<span title="${WILDCARDS[t].name}">${WILDCARDS[t].icon}</span>`).join(' ') || '—';
    const livesTxt = game.livesConfig > 1 ? ` · ❤️${game.flags[p.id].lives}` : '';
    row.innerHTML = `<b>${p.name}${p.id===curId?' 🎯':''}${!game.alive.includes(p.id)?' 💀':''}${livesTxt}</b><div class="inv-icons">${icons}</div>`;
    box.appendChild(row);
  });
}
function renderRightActions(curId){
  const box = $('myActions'); box.innerHTML = '';
  const g = game;
  const iAmActor = localMode || myId === curId;
  if(g.pendingDefense){ box.innerHTML = '<div class="msg">Esperando resolución de un ataque...</div>'; return; }
  if(!iAmActor){ box.innerHTML = '<div class="msg">No es tu turno.</div>'; return; }
  const fl = g.flags[curId];
  if(fl.blocked){
    box.innerHTML = '<div class="msg">🚫 Tus comodines están bloqueados este turno.</div>';
  } else {
    const inv = g.inventories[curId];
    if(!inv.length){ box.innerHTML = '<div class="msg">Sin comodines.</div>'; }
    inv.forEach(typeId=>{
      const wc = WILDCARDS[typeId];
      const btn = document.createElement('button'); btn.className = 'wc-item small';
      btn.innerHTML = `${wc.icon} ${wc.name}`;
      if(typeId==='proteccion'){
        btn.title = 'Se activa solo cuando alguien te ataque (no se pulsa).';
        btn.disabled = true;
      } else {
        btn.title = wc.desc;
        btn.disabled = !!uiMode || !!g.pendingRuleta;
        btn.onclick = () => startActivation(curId, typeId);
      }
      box.appendChild(btn);
    });
  }
  if(g.livesConfig > 1){
    const livesDiv = document.createElement('div'); livesDiv.className = 'msg'; livesDiv.style.marginTop = '0.4rem';
    livesDiv.textContent = `❤️ Vidas: ${fl.lives}`;
    box.appendChild(livesDiv);
  }
  if(g.actionTimeSec !== 0){
    const timerDiv = document.createElement('div'); timerDiv.id = 'actionTimerDisplay'; timerDiv.className = 'msg';
    timerDiv.style.cssText = 'margin-top:0.4rem; font-weight:700; color:var(--neon);';
    box.appendChild(timerDiv);
    updateActionTimerDisplay();
  }
}

/* ---- activar comodines ---- */
function startActivation(actorId, typeId){
  if(uiMode || game.pendingRuleta || game.pendingDefense) return;
  if(SIMPLE_WILDCARDS.includes(typeId)){ dispatch({type:'activate', actorId, typeId}); return; }
  if(typeId==='foca_gordita' || typeId==='bloquea_comodines' || typeId==='ruleta_rusa' || typeId==='secretito'){
    openTargetModal(actorId, typeId); return;
  }
  if(typeId==='ladron'){ openTargetModal(actorId, typeId); return; }
  if(typeId==='duplicador'){
    openInventoryModal(game.inventories[actorId], (dupType)=>{
      dispatch({type:'activate', actorId, typeId:'duplicador', dupType});
    }); return;
  }
  if(typeId==='lupa'){ uiMode = {type:'lupa', need:2, picked:[]}; renderGameScreenFull(); return; }
  if(typeId==='martillo'){ uiMode = {type:'martillo', need:2, picked:[]}; renderGameScreenFull(); return; }
  if(typeId==='calavera'){ uiMode = {type:'calavera', need:1, picked:[]}; renderGameScreenFull(); return; }
  if(typeId==='equilibrio'){ uiMode = {type:'equilibrio', rowsNeeded: Math.ceil(game.rows/2), rows:[]}; renderGameScreenFull(); return; }
}
function openTargetModal(actorId, typeId){
  const others = game.players.filter(p => p.id!==actorId && game.alive.includes(p.id));
  openModalGeneric(`Elige objetivo para ${WILDCARDS[typeId].name}`, others.map(p=>({label:p.name, value:p.id})), (targetId)=>{
    if(typeId==='ladron'){
      const targetInv = [...new Set(game.inventories[targetId])];
      if(!targetInv.length){ return; }
      openModalGeneric(`¿Qué le robas a ${nameOf(targetId)}?`, targetInv.map(t=>({label:WILDCARDS[t].icon+' '+WILDCARDS[t].name, value:t})), (stealType)=>{
        dispatch({type:'activate', actorId, typeId:'ladron', targetId, stealType});
      });
    } else {
      dispatch({type:'activate', actorId, typeId, targetId});
    }
  });
}
function openInventoryModal(types, onPick){
  const uniq = [...new Set(types)];
  if(!uniq.length) return;
  openModalGeneric('Elige un comodín tuyo', uniq.map(t=>({label:WILDCARDS[t].icon+' '+WILDCARDS[t].name, value:t})), onPick);
}
function openModalGeneric(title, options, onPick){
  $('modalTitle').textContent = title;
  const list = $('modalList'); list.innerHTML = '';
  options.forEach(opt=>{
    const b = document.createElement('button'); b.className = 'wc-item small';
    b.textContent = opt.label;
    b.onclick = () => { closeModal(); onPick(opt.value); };
    list.appendChild(b);
  });
  $('actionModal').classList.remove('hidden');
}
function closeModal(){ $('actionModal').classList.add('hidden'); }
$('btnModalCancel').onclick = closeModal;

/* ================= APLICAR ACCIONES (autoritativo) ================= */
function applyAction(a){
  const g = game;
  switch(a.type){
    case 'pickWildcard': {
      if(g.phase !== 'shop') return;
      if(g.shopStage === 'recycle'){
        const pid = g.recycleQueue[0];
        if(a.actorId !== pid) return;
        if(g.pool[a.typeId] <= 0) return;
        g.pool[a.typeId]--;
        g.inventories[pid].push(a.typeId);
        fireEvent('pick-coin');
        g.recycleRemaining--;
        if(g.recycleRemaining <= 0){
          g.recycleQueue.shift();
          if(g.recycleQueue.length){ g.recycleRemaining = 2; }
          else { g.shopStage = null; enterPoisonPhase(); }
        }
        if(g.phase === 'shop') resetShopTimer();
        return;
      }
      const pid = g.pickOrder[g.pickIdx];
      if(a.actorId !== pid) return;
      if(g.inventories[pid].length >= g.maxWildcards) return;
      if(g.pool[a.typeId] <= 0) return;
      g.pool[a.typeId]--;
      g.inventories[pid].push(a.typeId);
      fireEvent('pick-coin');
      advancePickIdx();
      if(g.phase === 'shop') resetShopTimer();
      return;
    }
    case 'setPoison': {
      if(g.phase !== 'poison') return;
      if(g.poison[a.actorId] !== undefined) return;
      if(!a.cells || a.cells.length !== g.poisonCount) return;
      if(new Set(a.cells).size !== a.cells.length) return;
      g.poison[a.actorId] = a.cells.slice();
      return;
    }
    case 'eat': {
      if(g.phase !== 'game') return;
      if(currentPlayerId() !== a.actorId) return;
      resolveEat(a.actorId, a.cell);
      if(g.phase === 'game') resetTurnTimer();
      return;
    }
    case 'activate': {
      if(g.phase !== 'game') return;
      if(currentPlayerId() !== a.actorId) return;
      activateWildcard(a.actorId, a.typeId, a);
      if(g.phase === 'game') resetTurnTimer();
      return;
    }
    case 'ruletaChoice': {
      if(!g.pendingRuleta || g.pendingRuleta.activatorId !== a.actorId) return;
      resolveRuletaChoice(a.cell);
      if(g.phase === 'game') resetTurnTimer();
      return;
    }
    case 'defenseChoice': {
      const pd = g.pendingDefense;
      if(!pd || pd.targetId !== a.actorId) return;
      g.pendingDefense = null;
      if(a.use){
        removeOne(pd.targetId, 'proteccion');
        g.lastMessage = `${nameOf(pd.targetId)} bloqueó ${WILDCARDS[pd.typeId].name} de ${nameOf(pd.attackerId)} con Protección.`;
      } else {
        resolveTargetedEffect(pd.attackerId, pd.targetId, pd.typeId, pd.params);
      }
      if(g.phase === 'game') resetTurnTimer();
      return;
    }
  }
}
function activateWildcard(actorId, typeId, params){
  const g = game; const fl = g.flags[actorId];
  if(fl.blocked){ g.lastMessage = 'Tus comodines están bloqueados este turno.'; return; }
  if(!g.inventories[actorId].includes(typeId)) return;
  fireEvent('wildcard');

  if(typeId==='saltar_turno'){
    removeOne(actorId, typeId);
    fl.forcedEats = 0; fl.forcedCells = [];
    g.lastMessage = `${nameOf(actorId)} saltó su turno.`;
    advanceTurn();
    return;
  }
  if(typeId==='angel_guardian'){ removeOne(actorId,typeId); fl.guardianArmed=true; g.lastMessage=`${nameOf(actorId)} activó su Ángel Guardián.`; return; }
  if(typeId==='revertidor'){ removeOne(actorId,typeId); fl.revertidor=true; g.lastMessage=`${nameOf(actorId)} activó el Revertidor.`; return; }

  if(DEFENSIBLE_WILDCARDS.includes(typeId)){
    const targetId = params.targetId;
    removeOne(actorId,typeId);
    if(g.inventories[targetId].includes('proteccion')){
      g.pendingDefense = {attackerId:actorId, targetId, typeId, params};
      g.lastMessage = `${nameOf(actorId)} intenta usar ${WILDCARDS[typeId].name} sobre ${nameOf(targetId)}...`;
      return;
    }
    resolveTargetedEffect(actorId, targetId, typeId, params);
    return;
  }
  if(typeId==='lupa'){
    removeOne(actorId,typeId);
    (params.cells||[]).forEach(c=>{ g.publicInfo[c] = isCellPoison(c); });
    g.lastMessage = `${nameOf(actorId)} usó la Lupa.`;
    return;
  }
  if(typeId==='equilibrio'){
    removeOne(actorId,typeId);
    const rows = params.rows||[];
    let hasPoison = false;
    rows.forEach(r=>{ for(let c=0;c<g.cols;c++){ const idx=r*g.cols+c; if(g.eaten[idx]===undefined && isCellPoison(idx)) hasPoison = true; } });
    g.equilibrioLog.push({by:nameOf(actorId), rows: rows.slice().sort((a,b)=>a-b), hasPoison});
    g.lastMessage = `${nameOf(actorId)} usó Equilibrio: en esas filas ${hasPoison ? 'SÍ' : 'NO'} hay una envenenada.`;
    return;
  }
  if(typeId==='martillo'){
    removeOne(actorId,typeId);
    (params.cells||[]).forEach(c=>{ if(g.eaten[c]===undefined) g.eaten[c]={by:'destroyed'}; });
    g.lastMessage = `${nameOf(actorId)} destruyó 2 chuches con el Martillo.`;
    return;
  }
  if(typeId==='calavera'){
    removeOne(actorId,typeId);
    if(!g.poison[actorId]) g.poison[actorId]=[];
    g.poison[actorId].push(params.cell);
    g.lastMessage = `${nameOf(actorId)} añadió una 2ª envenenada con Calavera.`;
    return;
  }
  if(typeId==='ladron'){
    const targetId = params.targetId, stealType = params.stealType;
    removeOne(actorId,typeId);
    const idx = g.inventories[targetId].indexOf(stealType);
    if(idx>=0){ g.inventories[targetId].splice(idx,1); g.inventories[actorId].push(stealType); }
    g.lastMessage = `${nameOf(actorId)} robó ${WILDCARDS[stealType].name} a ${nameOf(targetId)}.`;
    return;
  }
  if(typeId==='duplicador'){
    const dupType = params.dupType;
    removeOne(actorId,typeId);
    g.inventories[actorId].push(dupType);
    g.lastMessage = `${nameOf(actorId)} duplicó ${WILDCARDS[dupType].name}.`;
    return;
  }
}
function resolveTargetedEffect(actorId, targetId, typeId, params){
  const g = game;
  if(typeId==='foca_gordita'){
    g.flags[targetId].forcedEats += 3;
    g.lastMessage = `${nameOf(actorId)} usó ${WILDCARDS.foca_gordita.name} sobre ${nameOf(targetId)}: le quedan ${g.flags[targetId].forcedEats} mordiscos obligatorios.`;
    return;
  }
  if(typeId==='bloquea_comodines'){
    g.flags[targetId].blocked = true;
    g.lastMessage = `${nameOf(actorId)} bloqueó los comodines de ${nameOf(targetId)}.`;
    return;
  }
  if(typeId==='ruleta_rusa'){
    const avail = [];
    for(let i=0;i<g.colors.length;i++) if(g.eaten[i]===undefined) avail.push(i);
    shuffleInPlace(avail);
    g.pendingRuleta = {activatorId:actorId, targetId, options:avail.slice(0,3)};
    g.lastMessage = `${nameOf(actorId)} gira la Ruleta Rusa contra ${nameOf(targetId)}...`;
    return;
  }
  if(typeId==='secretito'){
    g.secretVision[actorId] = targetId;
    g.lastMessage = `${nameOf(actorId)} usó Secretito sobre ${nameOf(targetId)}.`;
    return;
  }
}
function resolveRuletaChoice(cell){
  const g = game; const pr = g.pendingRuleta; if(!pr) return;
  const others = pr.options.filter(c=>c!==cell);
  const fl = g.flags[pr.targetId];
  fl.forcedCells = (fl.forcedCells||[]).concat(others);
  g.pendingRuleta = null;
  resolveEat(pr.activatorId, cell);
}
function resolveEat(actorId, cell){
  const g = game;
  if(g.eaten[cell] !== undefined) return;
  const fl = g.flags[actorId];
  let poisoned = isCellPoison(cell);
  if(fl.revertidor){
    poisoned = !poisoned;
    fl.revertidor = false;
    g.lastMessage = poisoned
      ? `${nameOf(actorId)} comió una segura, pero el Revertidor la volvió veneno.`
      : `${nameOf(actorId)} comió veneno, pero el Revertidor lo salvó.`;
  } else {
    g.lastMessage = '';
  }
  g.eaten[cell] = {by: actorId, poisoned};
  let died = false;
  if(poisoned){
    if(fl.guardianArmed){
      fl.guardianArmed = false;
      g.lastMessage = `${nameOf(actorId)} debía morir, pero su Ángel Guardián lo revivió.`;
    } else {
      fl.lives--;
      if(fl.lives <= 0){
        g.alive = g.alive.filter(id=>id!==actorId);
        g.eliminationOrder.push(actorId);
        died = true;
        if(!g.lastMessage) g.lastMessage = `${nameOf(actorId)} comió la envenenada y queda eliminado.`;
      } else if(!g.lastMessage){
        g.lastMessage = `${nameOf(actorId)} comió la envenenada. Le queda(n) ${fl.lives} vida(s).`;
      }
    }
  } else if(!g.lastMessage){
    g.lastMessage = `${nameOf(actorId)} comió una chuche segura.`;
  }
  fireEvent(died ? 'eat-poison' : 'eat-safe');
  if(fl.forcedCells && fl.forcedCells.length && fl.forcedCells[0]===cell) fl.forcedCells.shift();
  pruneForcedCells(fl);
  let mustEatAgain = false;
  if(fl.forcedEats > 0){
    fl.forcedEats--;
    if(!died && fl.forcedEats > 0) mustEatAgain = true;
  }
  if(!died && fl.forcedCells && fl.forcedCells.length) mustEatAgain = true;

  if(g.alive.length <= 1){ g.phase='result'; g.resultWinnerId = g.alive[0]||null; g.resultWinners=null; return; }
  if(poisonRemainingAll() === 0){ g.phase='result'; g.resultWinnerId=null; g.resultWinners=g.alive.slice(); return; }
  if(mustEatAgain) return;
  advanceTurn();
}
function advanceTurn(){
  const g = game;
  const prevId = currentPlayerId();
  if(g.flags[prevId]) g.flags[prevId].blocked = false;
  do{ g.turnIdx = (g.turnIdx+1) % g.order.length; } while(!g.alive.includes(currentPlayerId()));
}

function computeRanking(){
  const g = game;
  const winners = g.resultWinnerId ? [g.resultWinnerId] : (g.resultWinners || []);
  const eliminatedDesc = g.eliminationOrder.slice().reverse();
  return winners.concat(eliminatedDesc.filter(id => !winners.includes(id)));
}
let resultAnnounced = false;
function renderResultScreen(){
  const g = game;
  const winners = g.resultWinnerId ? [g.resultWinnerId] : (g.resultWinners || []);
  const ranking = computeRanking();
  const iAmWinner = localMode ? true : winners.includes(myId);
  const box = $('resultBox'), banner = $('resultBanner');
  if(iAmWinner){
    box.classList.remove('lose-flash');
    banner.className = 'result-win-banner';
    $('resultEmoji').textContent = '🏆';
    banner.textContent = winners.length > 1 ? 'Habéis ganado' : 'Has ganado';
    $('resultSub').textContent = winners.length > 1 ? `Sobreviven: ${winners.map(nameOf).join(', ')}` : '';
  } else {
    box.classList.add('lose-flash');
    banner.className = 'result-lose-banner';
    $('resultEmoji').textContent = '💀';
    banner.textContent = 'Has perdido';
    const place = ranking.indexOf(myId) + 1;
    $('resultSub').textContent = `Ganador: ${winners.map(nameOf).join(', ') || '—'} · Puesto ${place} de ${ranking.length}.`;
  }
  $('resultRanking').innerHTML = 'Clasificación: ' + ranking.map((id,i)=>`${i+1}º ${nameOf(id)}`).join(' · ');
  if(!resultAnnounced){
    resultAnnounced = true;
    if(iAmWinner){ sfxWin(); launchConfetti(); } else { sfxLose(); }
  }
}
$('btnReplay').onclick = () => { cleanupNetwork(); location.reload(); };

/* ================= MÚSICA (Web Audio, sin archivos externos) ================= */
let audioCtx = null, musicOn = false, musicTimer = null;
const MUSIC_TRACKS = {
  alegre:    {label:'Alegre',   type:'triangle', bassType:'sine',     noteDur:0.28, notes:[261.63,329.63,392.00,329.63,293.66,349.23,440.00,349.23]},
  retro:     {label:'Retro',    type:'square',   bassType:'square',   noteDur:0.15, notes:[440,523.25,440,349.23,392.00,493.88,392.00,329.63]},
  misterio:  {label:'Misterio', type:'sine',     bassType:'sine',     noteDur:0.42, notes:[220,246.94,196,220,174.61,196,164.81,146.83]},
  suspenso:  {label:'Suspenso', type:'sawtooth', bassType:'sine',     noteDur:0.22, notes:[110,110,116.54,110,103.83,98,103.83,110]},
  chill:     {label:'Chill',    type:'sine',     bassType:'triangle', noteDur:0.5,  notes:[293.66,349.23,392.00,349.23,329.63,392.00,440.00,392.00]},
  fiesta:    {label:'Fiesta',   type:'triangle', bassType:'square',   noteDur:0.18, notes:[523.25,659.25,783.99,659.25,587.33,739.99,880.00,739.99]},
  ocho_bits: {label:'8 bits',   type:'square',   bassType:'square',   noteDur:0.14, notes:[392.00,392.00,523.25,392.00,349.23,392.00,440.00,349.23]},
  epico:     {label:'Épico',    type:'sawtooth', bassType:'triangle', noteDur:0.3,  notes:[196,246.94,293.66,246.94,220,261.63,329.63,261.63]},
};
let currentTrack = 'alegre';
function populateMusicTrackOptions(){
  const sel = $('musicTrack'); sel.innerHTML = '';
  Object.keys(MUSIC_TRACKS).forEach(key=>{ const o=document.createElement('option'); o.value=key; o.textContent=MUSIC_TRACKS[key].label; sel.appendChild(o); });
  sel.value = currentTrack;
}
populateMusicTrackOptions();
$('musicTrack').onchange = () => {
  currentTrack = $('musicTrack').value;
  if(musicOn){ clearTimeout(musicTimer); scheduleMusicLoop(); }
};
function playNote(freq, time, dur, type, vol){
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(vol||0.06, time+0.02);
  gain.gain.linearRampToValueAtTime(0.0001, time+dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(time); osc.stop(time+dur+0.02);
}
function scheduleMusicLoop(){
  if(!musicOn) return;
  const track = MUSIC_TRACKS[currentTrack];
  const now = audioCtx.currentTime;
  track.notes.forEach((freq, i) => {
    const t = now + i*track.noteDur;
    playNote(freq, t, track.noteDur*0.9, track.type, 0.07);
    playNote(freq/2, t, track.noteDur*0.9, track.bassType||track.type, 0.035);
  });
  musicTimer = setTimeout(scheduleMusicLoop, track.notes.length*track.noteDur*1000);
}
$('btnMusic').onclick = () => {
  musicOn = !musicOn;
  $('btnMusic').textContent = musicOn ? '🔊' : '🔇';
  if(musicOn){
    ensureAudio();
    scheduleMusicLoop();
  } else {
    clearTimeout(musicTimer);
  }
};

/* ================= EFECTOS DE SONIDO ================= */
function ensureAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function beep(freq, dur, type, vol, delay){
  ensureAudio();
  const t = audioCtx.currentTime + (delay||0);
  const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
  osc.type = type||'sine'; osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol||0.15, t+0.01);
  gain.gain.linearRampToValueAtTime(0.0001, t+dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t); osc.stop(t+dur+0.02);
}
function noiseBurst(dur, vol){
  ensureAudio();
  const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<n;i++) data[i] = (Math.random()*2-1) * (1 - i/n);
  const src = audioCtx.createBufferSource(); src.buffer = buffer;
  const gain = audioCtx.createGain(); gain.gain.value = vol;
  src.connect(gain); gain.connect(audioCtx.destination);
  src.start();
}
function sfxEatSafe(){ noiseBurst(0.08, 0.13); beep(880, 0.1, 'triangle', 0.11, 0.03); }
function sfxEatPoison(){ noiseBurst(0.1, 0.15); beep(190, 0.35, 'sawtooth', 0.18, 0.05); beep(120, 0.4, 'sawtooth', 0.15, 0.11); }
function sfxWildcard(){ beep(660, 0.08, 'square', 0.1); beep(990, 0.1, 'square', 0.1, 0.08); }
function sfxCoin(){ beep(988, 0.07, 'square', 0.13); beep(1568, 0.12, 'square', 0.13, 0.07); }
function sfxTimeWarning(){ beep(740, 0.1, 'square', 0.12); beep(740, 0.1, 'square', 0.12, 0.18); }
function sfxWin(){ [523,659,784,1046].forEach((f,i)=>beep(f, 0.28, 'triangle', 0.16, i*0.15)); }
function sfxLose(){ [400,340,280,220].forEach((f,i)=>beep(f, 0.3, 'sawtooth', 0.16, i*0.18)); }

/* ================= CONFETI ================= */
function launchConfetti(){
  const layer = document.createElement('div');
  layer.id = 'confettiLayer';
  document.body.appendChild(layer);
  const colors = ['#ff2fd0','#7c3aed','#39ff14','#00e5ff','#ffe135','#ff6ec7','#f4a300'];
  for(let i=0;i<70;i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = (Math.random()*100)+'vw';
    p.style.background = colors[rand(colors.length)];
    p.style.animationDuration = (2+Math.random()*2)+'s';
    p.style.animationDelay = (Math.random()*0.6)+'s';
    layer.appendChild(p);
  }
  setTimeout(()=>layer.remove(), 4600);
}

/* ================= TECLADO ================= */
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    if(!$('actionModal').classList.contains('hidden')) closeModal();
    return;
  }
  if(e.key !== 'Enter') return;
  const tag = (e.target.tagName || '').toLowerCase();
  if(tag !== 'input' && tag !== 'select') return;
  if(!$('actionModal').classList.contains('hidden')) return;
  const activeScreen = document.querySelector('.screen:not(.hidden)');
  if(!activeScreen) return;
  const primaryBtn = activeScreen.querySelector('button:not(.secondary)');
  if(primaryBtn && !primaryBtn.disabled) primaryBtn.click();
});
