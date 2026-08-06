let audioCtx = null, musicOn = false, musicTimer = null;

const MUSIC_TRACKS = {
  alegre:    {type:'triangle', bassType:'sine',     noteDur:0.28, notes:[261.63,329.63,392.00,329.63,293.66,349.23,440.00,349.23]},
  retro:     {type:'square',   bassType:'square',   noteDur:0.15, notes:[440,523.25,440,349.23,392.00,493.88,392.00,329.63]},
  misterio:  {type:'sine',     bassType:'sine',     noteDur:0.42, notes:[220,246.94,196,220,174.61,196,164.81,146.83]},
  suspenso:  {type:'sawtooth', bassType:'sine',     noteDur:0.22, notes:[110,110,116.54,110,103.83,98,103.83,110]},
  chill:     {type:'sine',     bassType:'triangle', noteDur:0.5,  notes:[293.66,349.23,392.00,349.23,329.63,392.00,440.00,392.00]},
  fiesta:    {type:'triangle', bassType:'square',   noteDur:0.18, notes:[523.25,659.25,783.99,659.25,587.33,739.99,880.00,739.99]},
  ocho_bits: {type:'square',   bassType:'square',   noteDur:0.14, notes:[392.00,392.00,523.25,392.00,349.23,392.00,440.00,349.23]},
  epico:     {type:'sawtooth', bassType:'triangle', noteDur:0.3,  notes:[196,246.94,293.66,246.94,220,261.63,329.63,261.63]},
};

let currentTrack = 'alegre';

function populateMusicTrackOptions(){
  const sel = $('musicTrack'); sel.innerHTML = '';
  Object.keys(MUSIC_TRACKS).forEach(key=>{ const o=document.createElement('option'); o.value=key; o.textContent=trackLabel(key); sel.appendChild(o); });
  sel.value = currentTrack;
}

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

function initAudioControls(){
  populateMusicTrackOptions();
  $('musicTrack').onchange = () => {
    currentTrack = $('musicTrack').value;
    if(musicOn){ clearTimeout(musicTimer); scheduleMusicLoop(); }
  };
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
}
