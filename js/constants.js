const COLORS = ['#e63946','#f4a300','#ffe135','#38b000','#1e90ff','#00e5ff','#7cff6b','#ff6ec7','#a259ff'];

const WILDCARDS = {
  saltar_turno:      {cat:'protectores', icon:'⏭️'},
  angel_guardian:    {cat:'protectores', icon:'👼'},
  proteccion:        {cat:'protectores', icon:'🛡️'},
  foca_gordita:      {cat:'ataque',       icon:'🐷'},
  ruleta_rusa:       {cat:'ataque',       icon:'🎯'},
  bloquea_comodines: {cat:'ataque',       icon:'🚫'},
  lupa:              {cat:'informacion',  icon:'🔍'},
  equilibrio:        {cat:'informacion',  icon:'⚖️'},
  secretito:         {cat:'informacion',  icon:'🤫'},
  revertidor:        {cat:'interaccion',  icon:'🔄'},
  martillo:          {cat:'interaccion',  icon:'🔨'},
  calavera:          {cat:'interaccion',  icon:'💀'},
  ladron:            {cat:'estrategico',  icon:'💰'},
  reciclador:        {cat:'estrategico',  icon:'♻️'},
  duplicador:        {cat:'estrategico',  icon:'✨'},
};

const CATS = ['protectores','ataque','informacion','interaccion','estrategico'];
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
