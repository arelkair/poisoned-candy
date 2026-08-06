let game = null;
let localMode = false;
let uiMode = null;
let lastWheelId = -1;
let pendingPlayers = [];

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

function computeRanking(){
  const g = game;
  const winners = g.resultWinnerId ? [g.resultWinnerId] : (g.resultWinners || []);
  const eliminatedDesc = g.eliminationOrder.slice().reverse();
  return winners.concat(eliminatedDesc.filter(id => !winners.includes(id)));
}
