(() => {
  if (window.__LVC_LOADED__) return;
  window.__LVC_LOADED__ = true;

  const state = {
    running: false,
    finalLines: [],
    interimText: '',
    disclosure: '',
    settings: {
      fontSize: 24,
      backgroundOpacity: 0.65,
      showHistory: true
    }
  };

  const root = document.createElement('section');
  root.id = 'lvc-overlay';
  root.style.position = 'fixed';
  root.style.right = '14px';
  root.style.bottom = '90px';
  root.style.zIndex = '2147483646';
  root.style.width = '420px';
  root.style.maxWidth = '45vw';
  root.style.minWidth = '240px';
  root.style.minHeight = '120px';
  root.style.resize = 'both';
  root.style.overflow = 'hidden';
  root.style.borderRadius = '10px';
  root.style.border = '1px solid rgba(255,255,255,0.22)';
  root.style.backdropFilter = 'blur(2px)';
  root.style.boxShadow = '0 8px 24px rgba(0,0,0,0.32)';
  root.style.color = '#fff';
  root.style.fontFamily = 'Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  root.style.pointerEvents = 'auto';

  const header = document.createElement('header');
  header.textContent = 'Live Captions';
  header.style.padding = '9px 12px';
  header.style.cursor = 'move';
  header.style.background = 'rgba(0,0,0,0.75)';
  header.style.fontSize = '12px';
  header.style.fontWeight = '600';
  header.style.letterSpacing = '0.2px';

  const body = document.createElement('div');
  body.style.padding = '10px 12px';
  body.style.height = 'calc(100% - 34px)';
  body.style.overflowY = 'auto';

  const status = document.createElement('div');
  status.style.fontSize = '11px';
  status.style.opacity = '0.8';
  status.style.marginBottom = '8px';

  const captions = document.createElement('div');
  captions.style.whiteSpace = 'pre-wrap';
  captions.style.lineHeight = '1.35';

  const disclosure = document.createElement('div');
  disclosure.style.fontSize = '10px';
  disclosure.style.opacity = '0.65';
  disclosure.style.marginTop = '10px';

  body.append(status, captions, disclosure);
  root.append(header, body);
  document.documentElement.appendChild(root);

  let drag = null;
  header.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    root.setPointerCapture(event.pointerId);
  });

  header.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    root.style.left = `${Math.max(0, drag.left + dx)}px`;
    root.style.top = `${Math.max(0, drag.top + dy)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  });

  header.addEventListener('pointerup', (event) => {
    drag = null;
    root.releasePointerCapture(event.pointerId);
  });

  function updateStyle() {
    const opacity = Math.max(0, Math.min(1, Number(state.settings.backgroundOpacity)));
    root.style.background = `rgba(8,12,18,${opacity})`;
    captions.style.fontSize = `${Math.max(12, Number(state.settings.fontSize || 24))}px`;
  }

  function render() {
    status.textContent = state.running ? 'Captions ON' : 'Captions OFF';

    const base = state.settings.showHistory
      ? state.finalLines.slice(-8).join('\n')
      : state.finalLines.at(-1) || '';

    const interim = state.interimText ? `${base ? '\n' : ''}${state.interimText}` : '';
    captions.textContent = `${base}${interim}`.trim() || 'Waiting for speech…';
    disclosure.textContent = state.disclosure;
    body.scrollTop = body.scrollHeight;
  }

  updateStyle();
  render();

  chrome.runtime.onMessage.addListener((message) => {
    if (!message?.type) return;

    if (message.type === 'CAPTION_STATUS') {
      state.running = Boolean(message.running);
      if (message.settings) {
        state.settings = { ...state.settings, ...message.settings };
        updateStyle();
      }
      state.disclosure = message.disclosure || state.disclosure;
      if (!state.running) state.interimText = '';
      render();
      return;
    }

    if (message.type === 'CAPTION_UPDATE') {
      if (message.interim) {
        state.interimText = message.text;
      } else {
        state.finalLines.push(message.text);
        if (state.finalLines.length > 200) state.finalLines = state.finalLines.slice(-200);
        state.interimText = '';
      }
      render();
      return;
    }

    if (message.type === 'CAPTION_ERROR') {
      state.interimText = '';
      captions.textContent = `Error: ${message.error}`;
      return;
    }

    if (message.type === 'SETTINGS_UPDATED') {
      state.settings = { ...state.settings, ...message.settings };
      updateStyle();
      render();
      return;
    }

    if (message.type === 'CAPTIONS_CLEARED') {
      state.finalLines = [];
      state.interimText = '';
      render();
    }
  });
})();
