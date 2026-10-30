# Ali and Aboudy Scholars

An offline-first learning app for Ali and Aboudy, packaged as an Android WebView app. The online learning helper uses Google Gemini only.

## Gemini setup

1. Create a Gemini API key at <https://aistudio.google.com/apikey>.
2. Open Parent Area, then Gemini Assistant Settings.
3. Paste and save the key on the device, test it, then enable the online helper.

The key is stored in this device's browser storage. It is not part of the source files or APK build. Do not publish a personal key in a public project. Gemini requests may use quota or incur charges.

## Build the Android APK

The GitHub Actions workflow builds a debug APK whenever code is pushed to `main`, and can also be started from the Actions tab. Download the `ali-and-aboudy-scholars-apk` workflow artifact after the build completes.

The debug APK is signed for testing and direct installation. A separate release signing key is required for store distribution and must be kept private.

## Project contents

- `index.html`: app UI, curriculum, offline helper and Gemini connection settings.
- `app/`: Android WebView wrapper, manifest and launcher icon.
- `.github/workflows/android.yml`: automated Android build.
- `icon.svg`: source artwork for the app icon.
