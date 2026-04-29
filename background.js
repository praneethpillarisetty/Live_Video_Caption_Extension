import { DEFAULT_SETTINGS, getSettings, saveSettings } from './storage.js';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

const state = {
  running: false,
  tabId: null,
  streamId: null,
  transcript: []
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    ...DEFAULT_SETTINGS,
    running: false,
    transcript: []
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return;
  }

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
        sendResponse({ ok: true, settings });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'CLEAR_CAPTIONS') {
    chrome.storage.local.set({ transcript: [] })
      .then(async () => {
        state.transcript = [];
        await chrome.runtime.sendMessage({ type: 'CAPTIONS_CLEARED' });
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'RECOGNITION_RESULT') {
    handleRecognitionResult(message).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'RECOGNITION_ERROR') {
    handleRecognitionError(message).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'RECOGNITION_ENDED') {
    handleRecognitionEnded().then(() => sendResponse({ ok: true }));
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
      justification: 'Process active tab audio for live captions.'
    });
  }
}

async function injectOverlay(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found to start captions.');
  }
  return tab;
}

async function startCaptions() {
  const tab = await getActiveTab();
  const tabId = tab.id;

  if (state.running) {
    await stopCaptions();
  }

  let streamId;
  try {
    streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
        const captureError = chrome.runtime.lastError;
        if (captureError) {
          reject(new Error(captureError.message || 'Unknown tab capture error.'));
          return;
        }
        resolve(id);
      });
    });
  } catch (error) {
    const rawMessage = error?.message || 'Unknown tab capture error.';
    console.error(rawMessage);

    if (rawMessage.includes('Extension has not been invoked for the current page')) {
      throw new Error('Please click the extension icon while the video tab is active, then start captions.');
    }

    if (rawMessage.includes('Chrome pages cannot be captured')) {
      throw new Error('This page cannot be captured by Chrome.');
    }

    if (rawMessage.includes('Not allowed')) {
      throw new Error('Chrome blocked tab audio capture for this page. Try refreshing the video tab, start playback first, then click the extension icon again.');
    }

    throw new Error(rawMessage);
  }

  await ensureOffscreenDocument();
  await injectOverlay(tabId);

  const settings = await getSettings();
  const autoLanguageHint = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const docLang = document?.documentElement?.lang?.trim();
      return {
        documentLang: docLang || null,
        navigatorLang: navigator.language || null
      };
    }
  });

  state.running = true;
  state.tabId = tabId;
  state.streamId = streamId;
  await chrome.storage.local.set({ running: true });

  await chrome.runtime.sendMessage({
    type: 'START_OFFSCREEN_RECOGNITION',
    streamId,
    tabId,
    settings,
    autoLanguageHint: autoLanguageHint?.[0]?.result || {}
  });

  await chrome.tabs.sendMessage(tabId, {
    type: 'CAPTION_STATUS',
    running: true,
    settings
  });
}

async function stopCaptions() {
  const tabId = state.tabId;

  state.running = false;
  state.tabId = null;
  state.streamId = null;
  await chrome.storage.local.set({ running: false });

  await chrome.runtime.sendMessage({ type: 'STOP_OFFSCREEN_RECOGNITION' });

  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'CAPTION_STATUS', running: false });
    } catch {
      // Tab may be closed or unavailable.
    }
  }
}

async function handleRecognitionResult(message) {
  if (!state.running || !state.tabId) {
    return;
  }

  const { text, interim, timestamp } = message;
  await chrome.tabs.sendMessage(state.tabId, {
    type: 'CAPTION_UPDATE',
    text,
    interim,
    timestamp
  });

  if (!interim) {
    const { saveTranscript, transcript = [] } = await chrome.storage.local.get({ saveTranscript: false, transcript: [] });
    if (saveTranscript) {
      transcript.push({ text, timestamp });
      state.transcript = transcript;
      await chrome.storage.local.set({ transcript });
    }
  }
}

async function handleRecognitionError(message) {
  if (state.tabId) {
    try {
      await chrome.tabs.sendMessage(state.tabId, {
        type: 'CAPTION_ERROR',
        error: message.error || 'Unknown speech recognition error.'
      });
    } catch {
      // Ignore if tab is gone.
    }
  }
}

async function handleRecognitionEnded() {
  if (!state.running) {
    return;
  }

  await chrome.runtime.sendMessage({ type: 'RESTART_RECOGNITION' });
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === state.tabId) {
    await stopCaptions();
  }
});
