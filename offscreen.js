let recognition;
let mediaStream;
let active = false;
let restartRequested = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return;
  }

  if (message.type === 'START_OFFSCREEN_RECOGNITION') {
    startRecognition(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        chrome.runtime.sendMessage({ type: 'RECOGNITION_ERROR', error: error.message });
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'STOP_OFFSCREEN_RECOGNITION') {
    stopRecognition();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'RESTART_RECOGNITION') {
    restartRequested = true;
    safeRestart();
    sendResponse({ ok: true });
    return;
  }
});

function resolveRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function resolveLanguage(settings, hint = {}) {
  if (!settings.autoLanguage) {
    return settings.language || 'en-US';
  }

  const docLang = (hint.documentLang || '').trim();
  const navLang = (hint.navigatorLang || '').trim();

  return docLang || navLang || 'en-US';
}

async function startRecognition({ streamId, settings, autoLanguageHint }) {
  const Recognition = resolveRecognitionClass();
  if (!Recognition) {
    throw new Error('Speech recognition is unsupported in this browser context.');
  }

  await stopRecognition();

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  // Keep stream active without recording or persistence.
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(mediaStream);
  const gain = audioContext.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(audioContext.destination);

  recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = resolveLanguage(settings, autoLanguageHint);

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0]?.transcript?.trim();
      if (!text) continue;

      chrome.runtime.sendMessage({
        type: 'RECOGNITION_RESULT',
        text,
        interim: !result.isFinal,
        timestamp: Date.now()
      });
    }
  };

  recognition.onerror = (event) => {
    chrome.runtime.sendMessage({
      type: 'RECOGNITION_ERROR',
      error: event.error || 'Speech recognition failed.'
    });
  };

  recognition.onend = () => {
    chrome.runtime.sendMessage({ type: 'RECOGNITION_ENDED' });
  };

  active = true;
  recognition.start();
}

async function stopRecognition() {
  active = false;
  restartRequested = false;

  if (recognition) {
    try {
      recognition.onend = null;
      recognition.stop();
    } catch {
      // Ignore stop errors.
    }
    recognition = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }
}

function safeRestart() {
  if (!active || !restartRequested || !recognition) {
    return;
  }

  restartRequested = false;
  setTimeout(() => {
    if (!active || !recognition) {
      return;
    }
    try {
      recognition.start();
    } catch {
      chrome.runtime.sendMessage({
        type: 'RECOGNITION_ERROR',
        error: 'Unable to restart speech recognition automatically.'
      });
    }
  }, 500);
}
