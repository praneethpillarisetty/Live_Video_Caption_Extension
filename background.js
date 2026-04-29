import { DEFAULT_SETTINGS, getSettings, saveSettings } from './storage.js';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

const state = {
  running: false,
  tabId: null,
  restartTimer: null
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    ...DEFAULT_SETTINGS,
    running: false,
    transcript: []
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return;

  if (message.type === 'START_CAPTIONS') {
    startCaptions()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'STOP_CAPTIONS') {
    stopCaptions()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'UPDATE_SETTINGS') {
    saveSettings(message.settings || {})
      .then(async (settings) => {
        await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings });
        if (state.tabId) {
          await chrome.tabs.sendMessage(state.tabId, { type: 'SETTINGS_UPDATED', settings });
        }
        sendResponse({ ok: true, settings });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'CLEAR_CAPTIONS') {
    clearCaptions()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'RECOGNITION_RESULT') {
    relayCaption(message)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'RECOGNITION_ERROR') {
    relayError(message.error || 'Speech-to-text failed unexpectedly.')
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'STREAM_DROPPED') {
    recoverFromStreamDrop(message.error || 'Connection dropped.')
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'GET_STATE') {
    chrome.storage.local.get({ running: false }).then((data) => {
      sendResponse({ ok: true, running: data.running });
    });
    return true;
  }
});

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['USER_MEDIA'],
      justification: 'Process active tab audio and stream chunks for live captions.'
    });
  }
}

async function injectOverlay(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function startCaptions() {
  const tab = await getActiveTab();

  // Critical user-gesture step: call immediately before any other async setup.
  const streamId = await getTabStreamId(tab.id);

  const settings = await getSettings();
  if (!settings.sttApiKey?.trim()) {
    throw new Error('STT API key is required. Add it in the extension popup settings.');
  }

  if (state.running) {
    await stopCaptions();
  }

  await ensureOffscreenDocument();
  await injectOverlay(tab.id);

  const autoLanguageHint = await readLanguageHints(tab.id);

  state.running = true;
  state.tabId = tab.id;
  await chrome.storage.local.set({ running: true });

  await chrome.runtime.sendMessage({
    type: 'START_OFFSCREEN_RECOGNITION',
    streamId,
    tabId: tab.id,
    settings,
    autoLanguageHint
  });

  await chrome.tabs.sendMessage(tab.id, {
    type: 'CAPTION_STATUS',
    running: true,
    settings,
    disclosure: 'Audio is temporarily processed for live captioning and not stored.'
  });
}


async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs?.[0];
  if (!tab?.id) {
    throw new Error('No active tab found to start captions.');
  }
  return tab;
}

async function getTabStreamId(tabId) {
  try {
    return await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch {
    throw new Error('Tab audio capture failed (possibly because the user gesture expired or the page is restricted). Click Start Captions and try again on a regular media page.');
  }
}

async function readLanguageHints(tabId) {
  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        documentLang: document?.documentElement?.lang?.trim() || null,
        navigatorLang: navigator.language || null
      })
    });
    return injected?.[0]?.result || {};
  } catch {
    return {};
  }
}

async function stopCaptions() {
  state.running = false;
  clearTimeout(state.restartTimer);
  state.restartTimer = null;
  const tabId = state.tabId;
  state.tabId = null;

  await chrome.storage.local.set({ running: false });
  await chrome.runtime.sendMessage({ type: 'STOP_OFFSCREEN_RECOGNITION' });

  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'CAPTION_STATUS', running: false });
    } catch {
      // Tab closed/navigated.
    }
  }
}

async function clearCaptions() {
  await chrome.storage.local.set({ transcript: [] });
  if (state.tabId) {
    await chrome.tabs.sendMessage(state.tabId, { type: 'CAPTIONS_CLEARED' });
  }
}

async function relayCaption({ text, interim, timestamp }) {
  if (!state.running || !state.tabId || !text) return;

  await chrome.tabs.sendMessage(state.tabId, {
    type: 'CAPTION_UPDATE',
    text,
    interim,
    timestamp
  });

  if (!interim) {
    const data = await chrome.storage.local.get({ saveTranscript: false, transcript: [] });
    if (data.saveTranscript) {
      data.transcript.push({ text, timestamp });
      await chrome.storage.local.set({ transcript: data.transcript });
    }
  }
}

async function relayError(error) {
  if (!state.tabId) return;
  await chrome.tabs.sendMessage(state.tabId, { type: 'CAPTION_ERROR', error });
}

async function recoverFromStreamDrop(error) {
  if (!state.running || !state.tabId) return;

  const settings = await getSettings();
  await relayError(error);

  if (!settings.autoRestart) return;

  clearTimeout(state.restartTimer);
  state.restartTimer = setTimeout(async () => {
    if (!state.running || !state.tabId) return;
    try {
      const streamId = await getTabStreamId(state.tabId);
      const autoLanguageHint = await readLanguageHints(state.tabId);
      await chrome.runtime.sendMessage({
        type: 'START_OFFSCREEN_RECOGNITION',
        streamId,
        tabId: state.tabId,
        settings,
        autoLanguageHint
      });
    } catch {
      await relayError('Unable to auto-restart captions. Please click Start Captions again.');
    }
  }, 1200);
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === state.tabId) {
    await stopCaptions();
  }
});
