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
  sttProvider: document.getElementById('sttProvider'),
  sttApiKey: document.getElementById('sttApiKey'),
  language: document.getElementById('language'),
  autoLanguage: document.getElementById('autoLanguage'),
  chunkMs: document.getElementById('chunkMs'),
  chunkMsValue: document.getElementById('chunkMsValue'),
  fontSize: document.getElementById('fontSize'),
  fontSizeValue: document.getElementById('fontSizeValue'),
  backgroundOpacity: document.getElementById('backgroundOpacity'),
  opacityValue: document.getElementById('opacityValue'),
  showHistory: document.getElementById('showHistory'),
  saveTranscript: document.getElementById('saveTranscript'),
  autoRestart: document.getElementById('autoRestart')
};

function renderLanguageOptions() {
  LANGUAGES.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    el.language.appendChild(option);
  });
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id || null;
}

function setError(message = '') {
  el.error.textContent = message;
}

async function refreshStatus() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  const running = Boolean(response?.running);
  el.status.textContent = `Status: ${running ? 'Capturing active tab audio' : 'Idle'}`;
  el.startBtn.disabled = running;
  el.stopBtn.disabled = !running;
}

async function persist(partial) {
  const response = await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: partial });
  if (!response?.ok) throw new Error(response?.error || 'Failed to save settings.');
}

function bindSettings() {
  el.sttProvider.addEventListener('change', () => persistWithError({ sttProvider: el.sttProvider.value }));
  el.sttApiKey.addEventListener('change', () => persistWithError({ sttApiKey: el.sttApiKey.value.trim() }));
  el.language.addEventListener('change', () => persistWithError({ language: el.language.value }));
  el.autoLanguage.addEventListener('change', () => persistWithError({ autoLanguage: el.autoLanguage.checked }));
  el.showHistory.addEventListener('change', () => persistWithError({ showHistory: el.showHistory.checked }));
  el.saveTranscript.addEventListener('change', () => persistWithError({ saveTranscript: el.saveTranscript.checked }));
  el.autoRestart.addEventListener('change', () => persistWithError({ autoRestart: el.autoRestart.checked }));

  el.chunkMs.addEventListener('input', () => {
    el.chunkMsValue.textContent = el.chunkMs.value;
    persistWithError({ chunkMs: Number(el.chunkMs.value) });
  });

  el.fontSize.addEventListener('input', () => {
    el.fontSizeValue.textContent = el.fontSize.value;
    persistWithError({ fontSize: Number(el.fontSize.value) });
  });

  el.backgroundOpacity.addEventListener('input', () => {
    el.opacityValue.textContent = Number(el.backgroundOpacity.value).toFixed(2);
    persistWithError({ backgroundOpacity: Number(el.backgroundOpacity.value) });
  });
}

async function persistWithError(partial) {
  try {
    await persist(partial);
    setError();
  } catch (error) {
    setError(error.message);
  }
}

async function hydrate() {
  renderLanguageOptions();
  const settings = await getSettings();

  el.sttProvider.value = settings.sttProvider;
  el.sttApiKey.value = settings.sttApiKey;
  el.language.value = settings.language;
  el.autoLanguage.checked = settings.autoLanguage;
  el.chunkMs.value = String(settings.chunkMs);
  el.chunkMsValue.textContent = String(settings.chunkMs);
  el.fontSize.value = String(settings.fontSize);
  el.fontSizeValue.textContent = String(settings.fontSize);
  el.backgroundOpacity.value = String(settings.backgroundOpacity);
  el.opacityValue.textContent = Number(settings.backgroundOpacity).toFixed(2);
  el.showHistory.checked = settings.showHistory;
  el.saveTranscript.checked = settings.saveTranscript;
  el.autoRestart.checked = settings.autoRestart;

  await refreshStatus();
}

el.startBtn.addEventListener('click', async () => {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) throw new Error('No active tab available for capture.');

    const response = await chrome.runtime.sendMessage({ type: 'START_CAPTIONS', tabId });
    if (!response?.ok) throw new Error(response?.error || 'Unable to start captions.');

    await refreshStatus();
    setError();
  } catch (error) {
    setError(error.message);
  }
});

el.stopBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_CAPTIONS' });
    if (!response?.ok) throw new Error(response?.error || 'Unable to stop captions.');

    await refreshStatus();
    setError();
  } catch (error) {
    setError(error.message);
  }
});

el.clearBtn.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CAPTIONS' });
    if (!response?.ok) throw new Error(response?.error || 'Unable to clear captions.');
    setError();
  } catch (error) {
    setError(error.message);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'CAPTION_ERROR') {
    setError(message.error || 'Live captioning error occurred.');
  }
});

bindSettings();
hydrate().catch((error) => setError(error.message));
