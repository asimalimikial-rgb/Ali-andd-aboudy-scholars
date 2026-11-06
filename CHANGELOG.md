## Unreleased — Embedded offline TTS and answer-feedback timing

- Replaced the Android System TTS bridge with an app-owned sherpa-onnx 2.0.1 runtime and bundled Supertonic 3 multilingual model.
- Added pinned, SHA-256-verified build-time downloads for native Android runtime libraries and Arabic/English model assets. No voice model downloads occur on the device.
- Removed the FreeTTS API proxy, browser SpeechSynthesis path, neural network voice settings, and cached MP3 download workflow.
- Added separate embedded voice-style selectors for Arabic and English, playback speed, voice test, stop control, and parent acceptance of the model license.
- Arabic helper explanation is shown and spoken before answer selection only.
- After submission, correct answers receive brief praise only (e.g. “أحسنت! إجابة صحيحة!”); incorrect answers receive brief encouragement only (e.g. “محاولة جميلة!”). No hint, explanation, or answer-selection instruction is repeated after submission.
- No silent fallback to Android TTS or online speech is permitted. Runtime/model failures must be visible in the app.
- Real-device Airplane Mode testing remains a required acceptance gate before merging or publishing a new release.

## Earlier v1.3.0 release

- Grouped existing curriculum books into three clear subject paths without deleting lesson data or lesson IDs.
- Redesigned the responsive interface while retaining original embedded child photos.
- Android versionCode 9; versionName 1.3.0.
