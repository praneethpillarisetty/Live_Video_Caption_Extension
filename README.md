# Live Video Captions (Chrome Extension, Manifest V3)

Live Video Captions is a privacy-first Chrome extension that provides live speech captions for media playing in the **currently active tab** (e.g., YouTube, webinars, online courses, and other browser video/audio pages).

## Features

- **Manual start/stop** caption capture from popup UI.
- Uses `chrome.tabCapture` for active-tab audio only.
- Runs caption processing in an **MV3 offscreen document**.
- Uses `SpeechRecognition` / `webkitSpeechRecognition` with:
  - `continuous = true`
  - `interimResults = true`
- Shows live, interim captions in a **floating page overlay**.
- Overlay is **draggable**, **resizable**, and readable.
- Optional local transcript saving (disabled by default).
- Local-only settings in `chrome.storage.local`.

## Project Structure

- `manifest.json`
- `background.js` (MV3 service worker)
- `offscreen.html`
- `offscreen.js`
- `content.js` (overlay)
- `popup.html`
- `popup.js`
- `popup.css`
- `storage.js`
- `privacy.md`
- `TESTING.md`

## Permissions Used

- `storage`: persist local settings and optional local transcript.
- `activeTab`: operate only on user-activated tab.
- `scripting`: inject overlay UI into active tab.
- `tabCapture`: capture active-tab audio after user click.
- `offscreen`: run media/speech processing in offscreen document.

## Host Permissions

No persistent `host_permissions` are requested.

The extension injects `content.js` only into the currently active tab after user interaction, using `activeTab + scripting`, which avoids broad permanent site access.

## Install (Developer Mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Usage

1. Open a page with audio/video.
2. Open extension popup.
3. Click **Start Captions**.
4. Adjust language/settings if needed.
5. Click **Stop Captions** anytime.

## Language Handling

Available language options:

- `en-US`, `es-ES`, `fr-FR`, `de-DE`, `hi-IN`, `te-IN`, `ta-IN`, `zh-CN`, `ja-JP`, `ko-KR`, `ar-SA`

When **Auto language mode** is enabled, language is selected in this order:

1. `document.documentElement.lang` (from active page)
2. `navigator.language`
3. Fallback to `en-US`

Auto detection is best effort.

## Notes / Limitations

- Speech recognition availability can vary by browser build and platform.
- Some protected media pages and browser-internal pages may block capture.
- Automatic restarts occur only while captions remain enabled.
