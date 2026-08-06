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

function initResultScreen(){
  $('btnReplay').onclick = () => { cleanupNetwork(); location.reload(); };
}
