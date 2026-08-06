let shopTickHandle = null;

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
