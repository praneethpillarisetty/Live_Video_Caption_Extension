(() => {
  const ROOT_ID = 'lvc-root';
  if (window.__LVC_LOADED__) {
    return;
  }
  window.__LVC_LOADED__ = true;

  const state = {
    running: false,
    settings: {
      fontSize: 24,
      backgroundOpacity: 0.65
    },
    interimText: '',
    finalText: ''
  };

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.position = 'fixed';
  root.style.right = '16px';
  root.style.bottom = '16px';
  root.style.zIndex = '2147483647';
  root.style.width = '420px';
  root.style.minWidth = '260px';
  root.style.minHeight = '120px';
  root.style.resize = 'both';
  root.style.overflow = 'hidden';
  root.style.borderRadius = '10px';
  root.style.border = '1px solid rgba(255,255,255,0.25)';
  root.style.boxShadow = '0 6px 24px rgba(0,0,0,0.35)';
  root.style.color = '#fff';
  root.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  root.style.userSelect = 'none';

  const header = document.createElement('div');
  header.textContent = 'Live Video Captions';
  header.style.padding = '10px 12px';
  header.style.cursor = 'move';
  header.style.background = 'rgba(0,0,0,0.8)';
  header.style.fontSize = '13px';
  header.style.fontWeight = '600';
  header.style.borderBottom = '1px solid rgba(255,255,255,0.15)';

  const body = document.createElement('div');
  body.style.padding = '12px';
  body.style.height = 'calc(100% - 42px)';
  body.style.overflowY = 'auto';
  body.style.lineHeight = '1.35';
  body.style.whiteSpace = 'pre-wrap';

  const status = document.createElement('div');
  status.style.fontSize = '12px';
  status.style.opacity = '0.8';
  status.style.marginBottom = '8px';

  const captions = document.createElement('div');

  body.appendChild(status);
  body.appendChild(captions);
  root.appendChild(header);
  root.appendChild(body);
  document.documentElement.appendChild(root);

  let drag = null;

  header.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const rect = root.getBoundingClientRect();
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top
    };
    root.setPointerCapture(event.pointerId);
  });

  header.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    root.style.left = `${Math.max(0, drag.left + dx)}px`;
    root.style.top = `${Math.max(0, drag.top + dy)}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  });

  header.addEventListener('pointerup', (event) => {
    drag = null;
    root.releasePointerCapture(event.pointerId);
  });

  function applyStyle() {
    const opacity = Math.max(0, Math.min(1, Number(state.settings.backgroundOpacity || 0.65)));
    root.style.background = `rgba(0,0,0,${opacity})`;
    captions.style.fontSize = `${Math.max(12, Number(state.settings.fontSize || 24))}px`;
  }

  function render() {
    status.textContent = state.running ? 'Captions ON' : 'Captions OFF';
    const interim = state.interimText ? `\n${state.interimText}` : '';
    captions.textContent = `${state.finalText}${interim}`.trim() || 'Waiting for speech…';
  }

  applyStyle();
  render();

  chrome.runtime.onMessage.addListener((message) => {
    if (!message?.type) return;

    if (message.type === 'CAPTION_STATUS') {
      state.running = Boolean(message.running);
      if (message.settings) {
        state.settings = { ...state.settings, ...message.settings };
        applyStyle();
      }
      if (!state.running) {
        state.interimText = '';
      }
      render();
      return;
    }

    if (message.type === 'CAPTION_UPDATE') {
      if (message.interim) {
        state.interimText = message.text;
      } else {
        state.finalText = `${state.finalText} ${message.text}`.trim();
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
      applyStyle();
      render();
      return;
    }

    if (message.type === 'CAPTIONS_CLEARED') {
      state.finalText = '';
      state.interimText = '';
      render();
    }
  });
})();
