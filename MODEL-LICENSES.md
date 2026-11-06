# Embedded speech runtime and model licenses

This application bundles the following components in Android APK builds:

## sherpa-onnx runtime and Kotlin TTS API

- Project: https://github.com/k2-fsa/sherpa-onnx
- Pinned version: v2.0.1
- Android runtime archive: `sherpa-onnx-v2.0.1-android.tar.bz2`
- SHA-256: `39003753ec293425ed56723ea9b972b98841a490af3311670c3060548d654330`
- License: Apache License 2.0
- The full license text is copied into the APK at `assets/embedded-tts/SHERPA-ONNX-LICENSE.txt`.

## ONNX Runtime dependency

- Bundled by the sherpa-onnx Android runtime; v1.28.2.
- License: MIT.
- Full license text is copied into the APK at `assets/embedded-tts/ONNXRUNTIME-LICENSE.txt`.

## LLVM C++ runtime dependency

- Android C++ shared runtime included with the native libraries where required.
- License: Apache License 2.0 with LLVM Exceptions.
- Full license text is copied into the APK at `assets/embedded-tts/LLVM-LICENSE.txt`.

## Supertonic 3 multilingual TTS model

- Model publisher: Supertone
- Model family: Supertonic 3, multilingual (Arabic and English)
- Pinned sherpa-onnx model archive: `sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2`
- SHA-256: `82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427`
- Model license: OpenRAIL-M (see the full license included in the APK at `assets/embedded-tts/supertonic3/LICENSE`).
- The parent must accept the model license in Parent Settings before voice features are enabled.

## Runtime behavior

- The APK includes the native runtime and model files. No first-run model download is performed.
- All inference occurs on-device. No text, child names, or progress records are sent to a speech provider.
- Android AudioTrack is used only to play generated PCM; Android System TTS is not used.
- The application must preserve the full model license and its use restrictions when redistributing APKs.
