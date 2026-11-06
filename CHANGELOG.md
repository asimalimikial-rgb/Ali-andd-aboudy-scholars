# Changelog

## v1.2.3 — Android Offline Speech & Responsive Word Study

- Fixed narrow Word Study cards and made the tracing canvas usable on mobile and desktop.
- Connected Android's native offline TextToSpeech engine as the local fallback when online audio is unavailable and no saved clip exists.
- Loaded installed Android offline voices into the voice selector and added stop/cancel handling.
- Removed the reference to the missing tts-bridge.js file that caused a browser 404.
- Kept the IPA online voice path and saved offline audio cache introduced in v1.2.2.

## v1.2.2 — Phonics, Word Study & Arabic Guidance

- Separated letter-name, isolated phonics-sound, and example-word playback controls.
- Added IPA phoneme synthesis through the speech endpoint, with cached audio for offline replay and local speech fallback.
- Replaced the placeholder formation prompt with an interactive finger-tracing canvas, clear/retry, and completion feedback.
- Added a dedicated Word Study area with age-level vocabulary, Arabic meanings, sound/word breakdowns, listening, tracing, and local word saving.
- Added Arabic meanings to the vocabulary book and clearer Arabic guidance throughout the phonics pathway.
- Preserved the existing profiles, embedded child photos, curricula, local progress, app identity, and signing certificate requirement.

## v1.2.1

- Previous release baseline.
