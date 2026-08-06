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
    try{
      if(localMode || isHost) finalizeWheel();
    }catch(e){
      console.error(e);
      if(localMode || isHost) afterMutation();
    }
  });
}

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
