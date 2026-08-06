function populateTimeSelect(selId, value){
  const sel = $(selId); sel.innerHTML = '';
  const opt0 = document.createElement('option'); opt0.value = '0'; opt0.textContent = t('config.noCronometro'); sel.appendChild(opt0);
  for(let s=10; s<=120; s+=10){ const o=document.createElement('option'); o.value=String(s); o.textContent=t('config.seconds',{n:s}); sel.appendChild(o); }
  const optInf = document.createElement('option'); optInf.value = 'inf'; optInf.textContent = t('config.infinite'); sel.appendChild(optInf);
  sel.value = String(value);
}

function populateSkinOptions(value){
  const sel = $('cfgSkin'); sel.innerHTML = '';
  Object.keys(SKINS).forEach(key=>{ const o=document.createElement('option'); o.value=key; o.textContent = `${SKINS[key]} ${skinLabel(key)}`; sel.appendChild(o); });
  sel.value = value || 'osito';
  $('skinPreview').textContent = SKINS[sel.value] || SKINS['osito'];
}

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
  populateSkinOptions('osito');
  show('screen-config');
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

function initConfigScreen(){
  $('cfgSkin').onchange = () => { $('skinPreview').textContent = SKINS[$('cfgSkin').value] || '🧸'; };
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
}
