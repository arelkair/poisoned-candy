const COLORS = ['#e63946','#f4a300','#ffe135','#38b000','#1e90ff','#00e5ff','#7cff6b','#ff6ec7','#a259ff'];

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

const SKINS = { osito:'🧸', caramelo:'🍬', piruleta:'🍭', donut:'🍩', galleta:'🍪' };

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ]
};

const JOIN_TIMEOUT_MS = 15000;
const SHOP_TIME_MS = 20000;
