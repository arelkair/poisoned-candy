const $ = id => document.getElementById(id);
const show = id => { document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); $(id).classList.remove('hidden'); };
const rand = n => Math.floor(Math.random()*n);
const shuffleInPlace = arr => { for(let i=arr.length-1;i>0;i--){const j=rand(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };
const boardSizeFor = n => n + 3;
const roomCode = () => Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rand(32)]).join('');
const maxWildcardsFor = n => n<=2 ? 2 : 3;

function rotationFrom(ids, startId){
  const idx = ids.indexOf(startId);
  return ids.slice(idx).concat(ids.slice(0,idx));
}

function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }
