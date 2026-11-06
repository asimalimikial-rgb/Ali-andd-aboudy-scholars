# Changelog

## v1.2.4 — Restore Online Gemini Voice & Wide Word Study

- Switched the speech endpoint to the configured GEMINI_API_KEY and Gemini 3.8 Flash-Lite TTS model; the previous Google Cloud key name was not configured in production and caused HTTP 503.
- Mapped the app's selected voice names to Gemini prebuilt voices and sent the correct English/Arabic language code.
- Added phoneme-style metadata for isolated English sound requests.
- Changed Word Study to one full-width card per row so tracing remains comfortable on desktop and mobile.
- Preserved Android native offline TextToSpeech, cached audio, the three separate phonics controls, Arabic explanations, profiles and public child photos.

## v1.2.3 — Android Offline Speech & Responsive Word Study

- Fixed Word Study card sizing and connected Android native offline TextToSpeech as the local fallback.
- Loaded installed Android offline voices and added stop/cancel handling.
- Removed the missing tts-bridge.js request.

## v1.2.2 — Phonics, Word Study & Arabic Guidance

- Separated letter-name, isolated phonics-sound, and example-word playback controls.
- Added finger tracing, age-level Word Study, Arabic meanings, and local word saving.
- Preserved existing profiles, photos, curricula, local progress and app identity.

## v1.2.1

- Previous release baseline.
