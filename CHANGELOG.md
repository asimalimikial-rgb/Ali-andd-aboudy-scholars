## Unreleased — Bilingual TTS reliability

- Added server-side privacy enforcement so child names cannot be sent to the online speech provider.
- Added request validation, bounded provider timeout, clearer upstream error codes, retry-after handling, and support for WAV/PCM audio responses.
- Added independent online English/Arabic tests that bypass saved clips, report Online/Cache/Local outcomes, and use generic test phrases without child names.
- Added a separate local/offline English and Arabic voice test.
- Improved Android locale fallback when an Arabic TTS locale is missing.
- Aligned web and Android API configuration with the Vercel project used for Production.
- Added automated API tests to the CI validation workflow.

# Changelog

## v1.2.5 — Arabic Helper Narration & Online-First Phonics

- Speak every question in English, then speak the complete Arabic helper explanation exactly as displayed.
- Keep English question narration and Arabic helper narration as separate sequential speech requests, preserving the correct voice and language for each.
- For Ali's isolated target letters, speak the phonics sound instead of the letter name; single-letter choices in letter/sound questions use the same phoneme path.
- Prefer live neural TTS whenever the network is available. Use saved clips when offline or when the network request fails; use Android/browser local TTS only as the final fallback.
- Make the force-online diagnostic truly bypass cached audio.
- Bump Android versionCode to 8 and versionName to 1.2.5. Pull Requests build with debug signing; main release builds require and verify the existing protected signing secret.


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
