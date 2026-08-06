function showToast(text, kind){
  let layer = document.getElementById('toastLayer');
  if(!layer){
    layer = document.createElement('div');
    layer.id = 'toastLayer';
    document.body.appendChild(layer);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (kind === 'negative' ? 'negative' : 'positive');
  t.textContent = text;
  layer.appendChild(t);
  setTimeout(()=>{ t.remove(); }, 3000);
}

function openModalGeneric(title, options, onPick){
  $('modalTitle').textContent = title;
  const list = $('modalList'); list.innerHTML = '';
  options.forEach(opt=>{
    const b = document.createElement('button'); b.className = 'wc-item small';
    b.textContent = opt.label;
    b.onclick = () => { closeModal(); onPick(opt.value); };
    list.appendChild(b);
  });
  $('actionModal').classList.remove('hidden');
}

function closeModal(){ $('actionModal').classList.add('hidden'); }

function initModal(){
  $('btnModalCancel').onclick = closeModal;
}

function initKeyboardShortcuts(){
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      if(!$('actionModal').classList.contains('hidden')) closeModal();
      return;
    }
    if(e.key !== 'Enter') return;
    const tag = (e.target.tagName || '').toLowerCase();
    if(tag !== 'input' && tag !== 'select') return;
    if(!$('actionModal').classList.contains('hidden')) return;
    const activeScreen = document.querySelector('.screen:not(.hidden)');
    if(!activeScreen) return;
    const primaryBtn = activeScreen.querySelector('button:not(.secondary)');
    if(primaryBtn && !primaryBtn.disabled) primaryBtn.click();
  });
}
