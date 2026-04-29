export const DEFAULT_SETTINGS = {
  language: 'en-US',
  autoLanguage: true,
  fontSize: 24,
  backgroundOpacity: 0.65,
  saveTranscript: false,
  showHistory: true,
  autoRestart: true,
  chunkMs: 250,
  sttProvider: 'deepgram',
  sttApiKey: ''
};

export async function getSettings() {
  const data = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...data };
}

export async function saveSettings(partial) {
  await chrome.storage.local.set(partial);
  return getSettings();
}
