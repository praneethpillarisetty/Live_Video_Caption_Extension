let mediaStream = null;
let mediaRecorder = null;
let socket = null;
let playbackAudio = null;
let active = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return;

  if (message.type === 'START_OFFSCREEN_RECOGNITION') {
    startPipeline(message)
      .then(() => sendResponse({ ok: true }))
      .catch(async (error) => {
        await chrome.runtime.sendMessage({ type: 'RECOGNITION_ERROR', error: error.message });
        await chrome.runtime.sendMessage({ type: 'STREAM_DROPPED', error: error.message });
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'STOP_OFFSCREEN_RECOGNITION') {
    stopPipeline();
    sendResponse({ ok: true });
    return;
  }
});

async function startPipeline({ streamId, settings, autoLanguageHint }) {
  await stopPipeline();

  if (!settings?.sttApiKey?.trim()) {
    throw new Error('Missing STT API key. Add it in popup settings.');
  }

  const language = resolveLanguage(settings, autoLanguageHint);
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });


  playbackAudio = new Audio();
  playbackAudio.srcObject = mediaStream;
  playbackAudio.autoplay = true;
  await playbackAudio.play();

  socket = createSocket(settings, language);
  await waitForSocketOpen(socket);

  const chunkMs = Math.max(100, Math.min(500, Number(settings.chunkMs || 250)));
  mediaRecorder = createRecorder(mediaStream, socket);
  mediaRecorder.start(chunkMs);
  active = true;
}

function createSocket(settings, language) {
  if (settings.sttProvider !== 'deepgram') {
    throw new Error('Only Deepgram realtime streaming is currently supported.');
  }

  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    interim_results: 'true',
    punctuate: 'true',
    encoding: 'opus',
    sample_rate: '48000'
  });

  if (settings.autoLanguage) {
    params.set('detect_language', 'true');
    params.set('language', 'multi');
  } else {
    params.set('language', language || 'en-US');
  }

  const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, ['token', settings.sttApiKey.trim()]);

  socket.onmessage = async (event) => {
    const payload = safeJson(event.data);
    const text = payload?.channel?.alternatives?.[0]?.transcript?.trim();
    if (!text) return;

    await chrome.runtime.sendMessage({
      type: 'RECOGNITION_RESULT',
      text,
      interim: !payload.is_final,
      timestamp: Date.now()
    });
  };

  socket.onerror = async () => {
    await chrome.runtime.sendMessage({ type: 'RECOGNITION_ERROR', error: 'STT connection failed.' });
  };

  socket.onclose = async () => {
    if (!active) return;
    await chrome.runtime.sendMessage({
      type: 'STREAM_DROPPED',
      error: 'STT stream disconnected. Attempting restart…'
    });
  };

  return socket;
}

function createRecorder(stream, ws) {
  const mimeType = chooseMimeType();
  if (!mimeType) {
    throw new Error('This browser cannot encode tab audio for realtime streaming.');
  }

  const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
  recorder.ondataavailable = async (event) => {
    if (!event.data || event.data.size === 0 || ws.readyState !== WebSocket.OPEN) return;
    const buffer = await event.data.arrayBuffer();
    ws.send(buffer);
  };
  recorder.onerror = async () => {
    await chrome.runtime.sendMessage({ type: 'STREAM_DROPPED', error: 'Audio chunking failed. Restarting stream…' });
  };
  return recorder;
}

function chooseMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

function resolveLanguage(settings, hint = {}) {
  if (!settings.autoLanguage) return settings.language || 'en-US';
  return hint.documentLang || hint.navigatorLang || 'en-US';
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function waitForSocketOpen(ws) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting to STT service.')), 8000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Unable to connect to STT service.'));
    };
  });
}

async function stopPipeline() {
  active = false;

  if (mediaRecorder) {
    try {
      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    } catch {
      // Ignore.
    }
    mediaRecorder = null;
  }


  if (playbackAudio) {
    try {
      playbackAudio.pause();
      playbackAudio.srcObject = null;
    } catch {
      // Ignore.
    }
    playbackAudio = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }

  if (socket) {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'CloseStream' }));
      }
      socket.close();
    } catch {
      // Ignore.
    }
    socket = null;
  }
}
