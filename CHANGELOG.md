## Unreleased — Azure Speech & Learning Environment Redesign

- Replaced Gemini network speech with Microsoft Azure AI Speech Neural TTS.
- Added Azure SSML, MP3 output, IPA phoneme support, server-side credentials, privacy filtering, timeout, and retry-after handling.
- Preserved online-first speech, local audio cache, and Android local TTS as the final fallback.
- Grouped existing curriculum books into three clear subject paths without deleting lesson data or lesson IDs.
- Redesigned the responsive interface while retaining the original embedded child photos.
- Removed pre-answer Arabic helper display and narration; one Arabic explanation now appears and is spoken only after answer validation.
- Started a fresh progress namespace and migrated parent preferences only.
- Bumped Android versionCode to 9 and versionName to 1.3.0.

# Changelog

## v1.3.0 — Azure Speech & Learning Environment Redesign

- Microsoft Azure AI Speech is now the primary network speech engine.
- English and Arabic prompts use dedicated neural voices; Ali's phonics prompts use IPA phoneme synthesis.
- Network TTS remains first choice; cached audio is used when online speech is unavailable, and Android local TTS is the final fallback.
- Lessons are grouped into English & Phonics, Mathematics, and Science & Discovery.
- Arabic explanations appear once, only after the child checks an answer.
- Modern responsive layout and simplified subject navigation.
- Android versionCode 9; versionName 1.3.0.
