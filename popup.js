import { getSettings } from './storage.js';

const LANGUAGES = [
  'en-US', 'es-ES', 'fr-FR', 'de-DE', 'hi-IN', 'te-IN', 'ta-IN', 'zh-CN', 'ja-JP', 'ko-KR', 'ar-SA'
];

const el = {
  status: document.getElementById('status'),
  error: document.getElementById('error'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  clearBtn: document.getElementById('clearBtn'),
  language: document.getElementById('language'),
  autoLanguage: document.getElementById('autoLanguage'),
  fontSize: document.getElementById('fontSize'),
  fontSizeValue: document.getElementById('fontSizeValue'),
  backgroundOpacity: document.getElementById('backgroundOpacity'),
  opacityValue: document.getElementById('opacityValue'),
  saveTranscript: document.getElementById('saveTranscript')
};

function renderLanguageOptions() {
  for (const lang of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang;
    el.language.appendChild(opt);
  }
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id || null;
}

function setError(message = '') {
  el.error.textContent = message;
}

async function refreshStatus() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  const running = Boolean(res?.running);
  el.status.textContent = `Status: ${running ? 'Capturing tab audio' : 'Idle'}`;
  el.startBtn.disabled = running;
  el.stopBtn.disabled = !running;
}

async function persistSetting(partial) {
  const response = await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: partial });
  if (!response?.ok) {
    throw new Error(response?.error || 'Unable to save settings.');
  }
}

function bindSettings() {
  el.language.addEventListener('change', async () => {
    try {
      await persistSetting({ language: el.language.value });
      setError();
    } catch (error) {
      setError(error.message);
    }
  });

  el.autoLanguage.addEventListener('change', async () => {
    try {
      await persistSetting({ autoLanguage: el.autoLanguage.checked });
      setError();
    } catch (error) {
      setError(error.message);
    }
  });

  el.fontSize.addEventListener('input', async () => {
    el.fontSizeValue.textContent = el.fontSize.value;
    try {
      await persistSetting({ fontSize: Number(el.fontSize.value) });
      setError();
    } catch (error) {
      setError(error.message);
    }
  });

  el.backgroundOpacity.addEventListener('input', async () => {
    el.opacityValue.textContent = Number(el.backgroundOpacity.value).toFixed(2);
    try {
      await persistSetting({ backgroundOpacity: Number(el.backgroundOpacity.value) });
      setError();
    } catch (error) {
      setError(error.message);
    }
  });

  el.saveTranscript.addEventListener('change', async () => {
    try {
      await persistSetting({ saveTranscript: el.saveTranscript.checked });
      setError();
    } catch (error) {
      setError(error.message);
    }
  });
}

async function hydrate() {
  renderLanguageOptions();

  const settings = await getSettings();
  el.language.value = settings.language;
  el.autoLanguage.checked = settings.autoLanguage;
  el.fontSize.value = String(settings.fontSize);
  el.fontSizeValue.textContent = String(settings.fontSize);
  el.backgroundOpacity.value = String(settings.backgroundOpacity);
  el.opacityValue.textContent = Number(settings.backgroundOpacity).toFixed(2);
  el.saveTranscript.checked = settings.saveTranscript;

  await refreshStatus();
}

el.startBtn.addEventListener('click', async () => {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) {
      throw new Error('No active tab is available for capture.');
    }

    const response = await chrome.runtime.sendMessage({ type: 'START_CAPTIONS', tabId });
    if (!response?.ok) {
      throw new Error(response?.error || 'Unable to start captions.');
    }

    await refreshStatus();
    setError();
  } catch (error) {
    setError(error.message);
  }
});

el.stopBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTIONS' });
    if (!response?.ok) {
      throw new Error(response?.error || 'Unable to stop captions.');
    }
    await refreshStatus();
    setError();
  } catch (error) {
    setError(error.message);
  }
});

el.clearBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CAPTIONS' });
    if (!response?.ok) {
      throw new Error(response?.error || 'Unable to clear captions.');
    }
    setError();
  } catch (error) {
    setError(error.message);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'SETTINGS_UPDATED') {
    if (typeof message.settings.fontSize !== 'undefined') {
      el.fontSize.value = String(message.settings.fontSize);
      el.fontSizeValue.textContent = String(message.settings.fontSize);
    }
    if (typeof message.settings.backgroundOpacity !== 'undefined') {
      el.backgroundOpacity.value = String(message.settings.backgroundOpacity);
      el.opacityValue.textContent = Number(message.settings.backgroundOpacity).toFixed(2);
    }
  }

  if (message?.type === 'CAPTION_ERROR') {
    setError(message.error);
  }
});

bindSettings();
hydrate().catch((error) => setError(error.message));
