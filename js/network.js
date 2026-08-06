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
  peer = new Peer('candy-'+code, {debug:0, config: ICE_CONFIG});
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

function handlePeerData(data){
  if(data.type === 'full'){ $('lobbyMsg').textContent = 'Sala llena (máx. 5).'; }
  else if(data.type === 'lobby'){ lobbyPlayersList = data.players; renderLobby(); }
  else if(data.type === 'hostConfiguring'){ $('lobbyMsg').textContent = 'El anfitrión está configurando la partida...'; }
  else if(data.type === 'joined'){ showToast(`Te has unido a la partida de ${data.hostName}.`, 'positive'); }
  else if(data.type === 'toast'){ showToast(data.text, data.kind); }
  else if(data.type === 'sync'){ game = data.game; renderCurrentPhase(); }
}

function initOnlineScreens(){
  $('btnGameLeave').onclick = () => leaveOnlineGame();
  $('btnLobbyLeave').onclick = () => leaveOnlineGame();

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
    $('joinMsg').textContent = 'Conectando...';
    peer = new Peer(undefined, {debug:0, config: ICE_CONFIG});
    peer.on('open', id => {
      myId = id;
      hostConn = peer.connect('candy-'+code, {reliable:true});
      const timeout = setTimeout(() => {
        $('joinMsg').textContent = 'No se pudo conectar. Comprueba el código y que ambos tengáis buena conexión, o probad de nuevo.';
        cleanupNetwork();
      }, JOIN_TIMEOUT_MS);
      hostConn.on('open', () => {
        clearTimeout(timeout);
        hostConn.send({type:'join', name: myName});
        show('screen-lobby');
        $('roomCodeDisplay').textContent = code;
        $('lobbyMsg').textContent = 'Esperando a que el anfitrión empiece...';
        updateLeaveButtonVisibility();
      });
      hostConn.on('data', data => handlePeerData(data));
      hostConn.on('close', () => { $('lobbyMsg').textContent = 'Conexión perdida con el anfitrión.'; });
      hostConn.on('error', () => {
        clearTimeout(timeout);
        $('joinMsg').textContent = 'No se pudo conectar con esa sala.';
      });
    });
    peer.on('error', err => { $('joinMsg').textContent = 'Error: '+err.type; });
  };
}
