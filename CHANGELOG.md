## Unreleased — Free Neural Speech & Cache-first Audio

- Replaced Azure-dependent network speech with the free FreeTTS Neural TTS API through the existing Vercel proxy.
- Added FreeTTS MP3 proxy, English and Arabic neural voices, privacy filtering, timeout, and retry-after handling. IPA phonemes remain on the local Android speech path because the free API does not document phoneme SSML.
- Changed audio reuse to cache-first so repeated prompts do not consume the free daily quota; new phrases use online neural speech and Android local TTS remains the final fallback.
- Grouped existing curriculum books into three clear subject paths without deleting lesson data or lesson IDs.
- Redesigned the responsive interface while retaining the original embedded child photos.
- Removed pre-answer Arabic helper display and narration; one Arabic explanation now appears and is spoken only after answer validation.
- Started a fresh progress namespace and migrated parent preferences only.
- Bumped Android versionCode to 9 and versionName to 1.3.0.

# Changelog

## v1.3.0 — Learning Environment Redesign (previous release)

- Microsoft Azure AI Speech is now the primary network speech engine.
- English and Arabic prompts use dedicated neural voices; Ali's phonics prompts use IPA phoneme synthesis.
- Network TTS remains first choice; cached audio is used when online speech is unavailable, and Android local TTS is the final fallback.
- Lessons are grouped into English & Phonics, Mathematics, and Science & Discovery.
- Arabic explanations appear once, only after the child checks an answer.
- Modern responsive layout and simplified subject navigation.
- Android versionCode 9; versionName 1.3.0.
