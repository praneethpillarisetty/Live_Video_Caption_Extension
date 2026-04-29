# Privacy Policy - Live Video Captions

## Summary

Live Video Captions is designed for on-device, local operation. It does **not** use any backend service and does not track users.

## What the extension does

- Captures audio from the **currently active tab** only after the user clicks **Start Captions**.
- Converts speech to text in-browser using built-in speech recognition APIs.
- Displays captions in an on-page overlay.

## What the extension does NOT do

- Does **not** record audio files.
- Does **not** upload or transmit audio to a custom backend.
- Does **not** save audio.
- Does **not** save captions/transcripts unless the user explicitly enables “Save transcript locally”.
- Does **not** include analytics, ads, remote code loading, or tracking scripts.

## Data storage

- Settings are stored locally with `chrome.storage.local`.
- Transcript storage is optional and disabled by default.
- If enabled, transcript is stored only in `chrome.storage.local` on the user’s device.

## Permissions justification

- `tabCapture`: capture active-tab audio when user starts captions.
- `offscreen`: run audio/speech processing in an offscreen document.
- `scripting` + `activeTab`: inject caption overlay only into the current user-selected tab.
- `storage`: save local preferences and optional transcript.

## User control

- User starts and stops captioning manually.
- User can clear captions from UI.
- User can disable local transcript saving at any time.

## Contact

If you distribute this extension, update this policy with your support email/contact method.
