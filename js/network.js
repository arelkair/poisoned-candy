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
  showToast(t('toast.left'), 'negative');
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
    $('lobbyMsg').textContent = t('lobby.shareCode');
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
        showToast(t('toast.playerLeft', {name: leaving.name}), 'negative');
        broadcastToast('toast.playerLeft', {name: leaving.name}, 'negative');
      }
    });
  });
  peer.on('error', err => { $('lobbyMsg').textContent = t('lobby.error', {type: err.type}); });
}

function handleHostData(conn, data){
  if(data.type === 'join'){
    if(lobbyPlayersList.length >= 5){ conn.send({type:'full'}); return; }
    hostConns[conn.peer] = conn;
    lobbyPlayersList.push({id: conn.peer, name: data.name});
    renderLobby();
    broadcastLobby();
    conn.send({type:'joined', hostName: myName});
    showToast(t('toast.playerJoined', {name: data.name}), 'positive');
    broadcastToast('toast.playerJoined', {name: data.name}, 'positive', conn.peer);
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

function broadcastToast(key, params, kind, excludeId){
  for(const id in hostConns){ if(id !== excludeId) hostConns[id].send({type:'toast', key, params, kind}); }
}

function handlePeerData(data){
  if(data.type === 'full'){ $('lobbyMsg').textContent = t('lobby.roomFull'); }
  else if(data.type === 'lobby'){ lobbyPlayersList = data.players; renderLobby(); }
  else if(data.type === 'hostConfiguring'){ $('lobbyMsg').textContent = t('lobby.hostConfiguring'); }
  else if(data.type === 'joined'){ showToast(t('toast.joinedRoomOf', {host: data.hostName}), 'positive'); }
  else if(data.type === 'toast'){ showToast(t(data.key, data.params), data.kind); }
  else if(data.type === 'sync'){ game = data.game; renderCurrentPhase(); }
}

function initOnlineScreens(){
  $('btnGameLeave').onclick = () => leaveOnlineGame();
  $('btnLobbyLeave').onclick = () => leaveOnlineGame();

  $('btnStartOnline').onclick = () => {
    if(lobbyPlayersList.length < 2){ $('lobbyMsg').textContent = t('lobby.needTwoPlayers'); return; }
    pendingPlayers = lobbyPlayersList.map(p=>({id:p.id, name:p.name}));
    for(const id in hostConns) hostConns[id].send({type:'hostConfiguring'});
    openConfigScreen();
  };

  $('btnJoinBack').onclick = () => show('screen-menu');
  $('btnDoJoin').onclick = () => {
    const code = $('joinCode').value.trim().toUpperCase();
    if(!code){ $('joinMsg').textContent = t('join.emptyCode'); return; }
    isHost = false;
    $('joinMsg').textContent = t('join.connecting');
    peer = new Peer(undefined, {debug:0, config: ICE_CONFIG});
    peer.on('open', id => {
      myId = id;
      hostConn = peer.connect('candy-'+code, {reliable:true});
      const timeout = setTimeout(() => {
        $('joinMsg').textContent = t('join.failed');
        cleanupNetwork();
      }, JOIN_TIMEOUT_MS);
      hostConn.on('open', () => {
        clearTimeout(timeout);
        hostConn.send({type:'join', name: myName});
        show('screen-lobby');
        $('roomCodeDisplay').textContent = code;
        $('lobbyMsg').textContent = t('lobby.waitingHostStart');
        updateLeaveButtonVisibility();
      });
      hostConn.on('data', data => handlePeerData(data));
      hostConn.on('close', () => { $('lobbyMsg').textContent = t('lobby.connectionLost'); });
      hostConn.on('error', () => {
        clearTimeout(timeout);
        $('joinMsg').textContent = t('join.connectFailed');
      });
    });
    peer.on('error', err => { $('joinMsg').textContent = t('join.error', {type: err.type}); });
  };
}
