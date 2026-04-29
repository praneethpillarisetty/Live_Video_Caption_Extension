# Privacy Policy - Live Video Captions

## Summary

Live Video Captions processes active-tab audio in real time for live captions and is designed to minimize data retention.

## Data handling

- Audio is captured from the **active tab only** after user clicks **Start Captions**.
- Audio is chunked in memory and streamed temporarily to the configured STT provider for transcription.
- Raw audio is **not** stored by this extension.
- Captions/transcript are stored only if user explicitly enables local saving.

## What is not included

- No analytics
- No ads
- No tracking
- No remote code loading
- No custom backend server

## Local storage

`chrome.storage.local` stores:

- UI/settings preferences
- Optional transcript (only when enabled)

## User controls

- Start/Stop captions at any time.
- Clear captions at any time.
- Disable transcript saving at any time.
- Disable auto-restart at any time.

## Disclosure

The UI displays: **“Audio is temporarily processed for live captioning and not stored.”**
