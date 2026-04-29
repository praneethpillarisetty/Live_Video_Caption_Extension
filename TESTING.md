# Testing Guide - Live Video Captions

## Quick checks

1. Load extension unpacked in `chrome://extensions`.
2. Set a valid STT API key in popup.
3. Open YouTube (or any tab with audio).
4. Start captions and confirm interim text appears while speaking.
5. Stop captions and verify stream halts.

## Functional matrix

### Start/Stop
- Start from popup only.
- Confirm overlay status changes ON/OFF.

### Active-tab capture
- Switch tabs and restart on the new active tab.
- Confirm captions represent only the chosen active tab.

### Real-time streaming
- Set chunk interval 100ms and verify lower latency.
- Set chunk interval 500ms and verify fewer updates.

### Overlay behavior
- Drag overlay away from controls.
- Resize overlay.
- Change font size and background opacity.
- Toggle show-history and validate behavior.

### Error handling
- Remove API key and start: should show clear configuration error.
- Try `chrome://` page start: should show tabCapture error.
- Simulate connection loss: verify auto-restart if enabled.

### Privacy controls
- Keep save transcript OFF and verify transcript remains empty.
- Enable save transcript and verify final captions persist locally.

## Static validation commands

- `python -m json.tool manifest.json`
- `node --check background.js`
- `node --check offscreen.js`
- `node --check content.js`
- `node --check popup.js`
