# Live Video Captions (Manifest V3)

Live Video Captions provides low-latency captions from the **currently active tab audio** (YouTube, webinars, courses, etc.) using a streaming STT architecture.

## Architecture

- `chrome.tabCapture` gets active-tab audio stream ID after explicit user click.
- MV3 `offscreen.html` + `offscreen.js` capture and chunk audio with `MediaRecorder`.
- Audio chunks stream over WebSocket to STT provider (Deepgram realtime WS).
- Interim/final transcripts are relayed to `content.js` overlay instantly.

## Key Behaviors

- User-triggered start/stop only.
- Active-tab-only capture.
- 100–500ms audio chunking (configurable slider).
- Persistent WebSocket streaming for low latency.
- Optional auto-restart when stream drops.
- Optional local transcript saving (default OFF).

## Files

- `manifest.json`
- `background.js`
- `offscreen.html`
- `offscreen.js`
- `content.js`
- `popup.html`
- `popup.js`
- `popup.css`
- `storage.js`
- `privacy.md`
- `TESTING.md`

## Permissions

Uses only:

- `storage`
- `activeTab`
- `scripting`
- `tabCapture`
- `offscreen`

No persistent `host_permissions` are requested.

## Setup

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Load unpacked this folder.
4. Open extension popup and set STT API key.
5. Open a media tab and click **Start Captions**.

## Language

Manual language options include:

`en-US, es-ES, fr-FR, de-DE, hi-IN, te-IN, ta-IN, zh-CN, ja-JP, ko-KR, ar-SA`

Auto mode passes best-effort hints (`document.documentElement.lang`, then `navigator.language`) and enables provider-side detection.

## Disclosure

The popup and overlay include: **“Audio is temporarily processed for live captioning and not stored.”**
