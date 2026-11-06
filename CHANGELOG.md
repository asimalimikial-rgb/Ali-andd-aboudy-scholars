# Changelog

## 1.2.0 — 2026-11-06
- Updated the public app source to the full enhanced learning build, including the original child profile photos as explicitly authorized by the project owner.
- Added Chirp 3 HD online-first neural speech with IndexedDB audio caching and automatic local TTS fallback.
- Added English and Arabic neural voice selectors, cache status, cache clearing, and a stop-audio control.
- Added a server-side Google Cloud TTS endpoint; API key remains a Vercel environment secret.
- Added an Android WebView wrapper with native Android TextToSpeech bridge.
- Added GitHub Actions syntax checks and APK build/release workflow.
- Package ID retained: `com.alialiaboudyscholars.app`; app version set to 1.2.0 / versionCode 3.
- APK build signing is temporary debug signing; original release-key continuity remains unverified.
