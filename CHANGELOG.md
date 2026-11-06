## Unreleased — Local-first speech and pre-answer Arabic guidance

- Restored Android Native TTS as the default speech engine, with separate local English and Arabic voice selectors.
- Kept Neural TTS as an optional experimental mode; real provider generation and MP3 playback still require live verification.
- Moved the Arabic helper explanation to the question screen before answer selection; removed Arabic explanation from post-answer feedback and narration.
- Kept the neural MP3 cache and lesson download tools available only in experimental Neural mode.

## Earlier experimental Neural TTS work

- Replaced Azure-dependent network speech with the free FreeTTS Neural TTS API through the existing Vercel proxy.
- Added FreeTTS MP3 proxy, English and Arabic neural voices, privacy filtering, timeout, and retry-after handling. IPA phonemes remain on the local Android speech path because the free API does not document phoneme SSML.
- Changed audio reuse to cache-first so repeated prompts do not consume a new provider quota when Neural mode is selected.
- Grouped existing curriculum books into three clear subject paths without deleting lesson data or lesson IDs.
- Redesigned the responsive interface while retaining the original embedded child photos.
- At the time of the v1.3.0 redesign, Arabic explanations were shown after answer validation; the current unreleased change moves them before answer selection.
- Started a fresh progress namespace and migrated parent preferences only.
- Bumped Android versionCode to 9 and versionName to 1.3.0.

# Changelog

## v1.3.0 — Learning Environment Redesign (previous release)

- Microsoft Azure AI Speech is now the primary network speech engine.
- English and Arabic prompts use dedicated neural voices; Ali's phonics prompts use IPA phoneme synthesis.
- Network TTS remains first choice; cached audio is used when online speech is unavailable, and Android local TTS is the final fallback.
- Lessons are grouped into English & Phonics, Mathematics, and Science & Discovery.
- Arabic helper appears before answer selection; post-answer feedback does not repeat it.
- Modern responsive layout and simplified subject navigation.
- Android versionCode 9; versionName 1.3.0.
