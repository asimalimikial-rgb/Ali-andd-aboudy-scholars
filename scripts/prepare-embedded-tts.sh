#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SHERPA_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-v2.0.1-android.tar.bz2"
SHERPA_SHA256="39003753ec293425ed56723ea9b972b98841a490af3311670c3060548d654330"
MODEL_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2"
MODEL_SHA256="82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427"

mkdir -p "$TMP_DIR/runtime" "$TMP_DIR/model" \
  "$ROOT/android/app/src/main/jniLibs/arm64-v8a" \
  "$ROOT/android/app/src/main/jniLibs/armeabi-v7a" \
  "$ROOT/android/app/src/main/assets/embedded-tts/supertonic3"

curl --fail --location --retry 3 --retry-delay 2 "$SHERPA_URL" -o "$TMP_DIR/sherpa-android.tar.bz2"
echo "$SHERPA_SHA256  $TMP_DIR/sherpa-android.tar.bz2" | sha256sum --check -
tar -xjf "$TMP_DIR/sherpa-android.tar.bz2" -C "$TMP_DIR/runtime"

for abi in arm64-v8a armeabi-v7a; do
  JNI_DIR="$(find "$TMP_DIR/runtime" -type d -path "*/jniLibs/$abi" -print -quit)"
  test -n "$JNI_DIR" || { echo "Missing sherpa JNI libraries for $abi"; exit 1; }
  compgen -G "$JNI_DIR/*.so" >/dev/null || { echo "No native libraries found for $abi"; exit 1; }
  cp "$JNI_DIR"/*.so "$ROOT/android/app/src/main/jniLibs/$abi/"
done

curl --fail --location --retry 3 --retry-delay 2 "$MODEL_URL" -o "$TMP_DIR/supertonic3.tar.bz2"
echo "$MODEL_SHA256  $TMP_DIR/supertonic3.tar.bz2" | sha256sum --check -
tar -xjf "$TMP_DIR/supertonic3.tar.bz2" -C "$TMP_DIR/model"
MODEL_DIR="$(find "$TMP_DIR/model" -type f -name 'tts.json' -printf '%h\n' | head -n 1)"
test -n "$MODEL_DIR" || { echo "Supertonic 3 model archive is incomplete"; exit 1; }
for file in duration_predictor.int8.onnx text_encoder.int8.onnx vector_estimator.int8.onnx vocoder.int8.onnx tts.json unicode_indexer.bin voice.bin; do
  test -s "$MODEL_DIR/$file" || { echo "Missing embedded model file: $file"; exit 1; }
done
cp -a "$MODEL_DIR/." "$ROOT/android/app/src/main/assets/embedded-tts/supertonic3/"

curl --fail --location "https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/v2.0.1/LICENSE" \
  -o "$ROOT/android/app/src/main/assets/embedded-tts/SHERPA-ONNX-LICENSE.txt"
curl --fail --location "https://huggingface.co/Supertone/supertonic-3/resolve/724fb5a/LICENSE" \
  -o "$ROOT/android/app/src/main/assets/embedded-tts/supertonic3/LICENSE"

test -s "$ROOT/android/app/src/main/assets/embedded-tts/SHERPA-ONNX-LICENSE.txt"
test -s "$ROOT/android/app/src/main/assets/embedded-tts/supertonic3/LICENSE"
echo "Embedded offline TTS runtime and Arabic/English model assets prepared."
du -sh "$ROOT/android/app/src/main/jniLibs" "$ROOT/android/app/src/main/assets/embedded-tts"
