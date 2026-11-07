#!/usr/bin/env python3
"""Run deterministic Android emulator smoke/audio-gate checks through a debug-only WebView hook.

This test never accepts the Supertonic 3 model licence on the user's behalf.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

OUT = Path("emulator-audio-report.json")
LOG = Path("emulator-logcat.txt")
SCREEN = Path("emulator-screen.png")
ADB = os.environ.get("ADB", "adb")

def adb(*args, check=True, timeout=60):
    return subprocess.run([ADB, *args], check=check, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          timeout=timeout).stdout

def report(status, **extra):
    data = {
        "status": status,
        "device_abi": adb("shell", "getprop", "ro.product.cpu.abi").strip(),
        "android_api": adb("shell", "getprop", "ro.build.version.sdk").strip(),
        "airplane_mode": adb("shell", "cmd", "connectivity", "airplane-mode").strip(),
        **extra,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(data, ensure_ascii=False, indent=2))

def main():
    adb("wait-for-device", timeout=120)
    deadline = time.time() + 180
    while time.time() < deadline:
        if adb("shell", "getprop", "sys.boot_completed").strip() == "1":
            break
        time.sleep(2)
    else:
        raise RuntimeError("Android emulator did not finish booting.")

    airplane = adb("shell", "cmd", "connectivity", "airplane-mode").strip().lower()
    if "enabled" not in airplane:
        raise RuntimeError("Emulator is not offline; airplane-mode status was: " + airplane)

    package = "com.alialiaboudyscholars.app"
    apk = "dist/Ali-Aboudy-Scholars-Supertonic3-ARMCompat-EmulatorTest-steps4-v1.3.0.apk"
    adb("logcat", "-c", check=False)
    adb("install", "-r", apk, timeout=180)
    adb("shell", "am", "start", "-n", package + "/.MainActivity",
        "--ez", "ci_audio_test", "true")
    time.sleep(2)

    marker = ""
    deadline = time.time() + 300
    while time.time() < deadline:
        log = adb("logcat", "-d", "-s", "CI_AUDIO_TEST:I", check=False)
        for line in log.splitlines():
            if "CI_RESULT:" in line:
                marker = line.split("CI_RESULT:", 1)[1].strip()
        if marker:
            break
        time.sleep(2)

    full_log = adb("logcat", "-d", "-v", "threadtime", check=False)
    LOG.write_text(full_log, encoding="utf-8")
    try:
        SCREEN.write_bytes(subprocess.check_output([ADB, "exec-out", "screencap", "-p"], timeout=30))
    except Exception:
        pass

    if not marker:
        report("automation_error", error="The debug-only WebView test hook did not report within 300 seconds.",
               airplane_mode=airplane)
        return 2

    try:
        payload = json.loads(marker)
    except json.JSONDecodeError:
        report("automation_error", error="Invalid CI diagnostic payload: " + marker[:1000])
        return 2

    diagnostics = payload.get("diagnostics", "")
    status_text = payload.get("status", "")
    native_start = diagnostics.count("native-start")
    native_end = diagnostics.count("native-end")
    synth_end = diagnostics.count("native-synth-end")
    native_error = diagnostics.count("native-error")
    test_complete = "test-complete" in diagnostics and payload.get("testCompleted") is True

    if test_complete and native_start >= 2 and native_end >= 2 and synth_end >= 2 and native_error == 0:
        result = "passed"
    elif not test_complete:
        result = "failed_test_did_not_complete"
    elif "speak-request" in diagnostics and native_start == 0:
        result = "failed_before_native_playback"
    else:
        result = "failed_incomplete_or_native_error"

    native_log = diagnostics.split('--- native ---', 1)[1] if '--- native ---' in diagnostics else ''
    import re
    synth_ms = [int(value) for value in re.findall(r'synth-end id=.*? synth-ms=(\d+)', native_log)]
    load_ms = [int(value) for value in re.findall(r'(?:prewarm-engine-load-end load-ms=|engine-load-end id=.*? load-ms=)(\d+)', native_log)]
    report(result, offline=True, diagnostics=diagnostics, ui_status=status_text,
           synthesis_durations_ms=synth_ms, model_load_durations_ms=load_ms,
           native_start_count=native_start, native_end_count=native_end,
           native_synth_end_count=synth_end, native_error_count=native_error,
           test_completed=test_complete, ci_hook_payload=payload)
    return 0 if result == "passed" else 2

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        try:
            report("automation_error", error=f"{type(exc).__name__}: {exc}")
        except Exception:
            print(f"automation_error: {type(exc).__name__}: {exc}")
        sys.exit(2)
