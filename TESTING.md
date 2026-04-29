# Testing Guide - Live Video Captions

## Manual test matrix

### 1) Basic Start/Stop
1. Load extension unpacked.
2. Open a video page (e.g., YouTube).
3. Click extension icon → **Start Captions**.
4. Verify overlay appears and status shows running.
5. Click **Stop Captions**.
6. Verify status returns to idle and updates stop.

Expected: No capture starts without explicit click.

### 2) Interim captions
1. Start captions on a page with speech.
2. Watch overlay while sentence is still being spoken.

Expected: Interim text appears before final sentence completion.

### 3) Overlay behavior
1. Drag the overlay by its header.
2. Resize overlay via corner handle.
3. Change font size and background opacity in popup.

Expected: overlay moves/resizes; style updates live.

### 4) Language selection
1. Set language manually (e.g., `es-ES`).
2. Start captions with Spanish audio.
3. Enable auto mode and repeat.

Expected: manual selection respected; auto mode best-effort from page/browser language.

### 5) Save transcript toggle
1. Ensure “Save transcript locally” is OFF.
2. Start captions and speak.
3. Inspect `chrome.storage.local` -> `transcript` should remain unchanged/empty.
4. Turn setting ON and repeat.

Expected: transcript is stored only when toggle is ON.

### 6) Unsupported / blocked scenarios
1. Open a Chrome internal page (`chrome://extensions`).
2. Try starting captions.

Expected: clear error that tab capture is unavailable or blocked.

### 7) Unexpected recognition stop
1. Start captions.
2. Simulate quiet periods / recognition pauses.

Expected: recognition attempts restart only while running is true.

## Compliance checklist

- [x] Manifest V3
- [x] Explicit user action required to start capture
- [x] Visible capture state in popup and overlay
- [x] No backend services
- [x] Local-only storage
- [x] Privacy policy included (`privacy.md`)
