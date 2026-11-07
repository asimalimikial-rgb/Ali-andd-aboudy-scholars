#!/usr/bin/env python3
"""Drive the Android app's parent voice test on a real ARM64 emulator via adb.

The test never accepts the model licence on the user's behalf. If the app has no
stored parent consent, it reports that explicit-consent blocker and stops.
"""
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path("emulator-audio-report.json")
ADB = os.environ.get("ADB", "adb")

def adb(*args, check=True, timeout=30):
    return subprocess.run([ADB, *args], check=check, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          timeout=timeout).stdout

def dump_ui():
    adb("shell", "uiautomator", "dump", "/sdcard/window.xml", check=False, timeout=30)
    raw = adb("exec-out", "cat", "/sdcard/window.xml", check=False, timeout=15)
    try:
        return ET.fromstring(raw)
    except ET.ParseError:
        return ET.Element("hierarchy")

def bounds_center(node):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not m:
        return None
    x1,y1,x2,y2 = map(int,m.groups())
    return ((x1+x2)//2,(y1+y2)//2)

def find_node(predicate, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        root = dump_ui()
        for node in root.iter("node"):
            if predicate(node):
                point = bounds_center(node)
                if point:
                    return node, point
        time.sleep(1)
    raise RuntimeError("Timed out waiting for an expected Android UI element.")

def tap_point(point):
    adb("shell", "input", "tap", str(point[0]), str(point[1]))

def tap_text(text, timeout=20, exact=False):
    node, point = find_node(
        lambda n: (n.attrib.get("text", "") == text if exact else text in n.attrib.get("text", ""))
                  or (n.attrib.get("content-desc", "") == text if exact else text in n.attrib.get("content-desc", "")),
        timeout)
    tap_point(point)
    time.sleep(1.5)
    return node

def report(status, **extra):
    data = {"status": status, "device": adb("shell","getprop","ro.product.cpu.abi").strip(),
            "sdk": adb("shell","getprop","ro.build.version.sdk").strip(), **extra}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(data, ensure_ascii=False, indent=2))

def main():
    adb("wait-for-device")
    end = time.time() + 180
    while time.time() < end:
        if adb("shell","getprop","sys.boot_completed").strip() == "1":
            break
        time.sleep(2)
    else:
        raise RuntimeError("Android emulator did not finish booting.")

    package = "com.alialiaboudyscholars.app"
    adb("shell","am","force-stop",package,check=False)
    adb("shell","am","start","-n",package+"/.MainActivity")
    time.sleep(12)

    # Select Ali's profile, then enter protected Parent Settings.
    tap_text("Ali (علي)", timeout=35)
    tap_text("Parent settings", timeout=25)
    question_node, _ = find_node(lambda n: "Adult Verification: Solve" in n.attrib.get("text",""), timeout=15)
    question = question_node.attrib.get("text","")
    numbers = re.search(r"(\d+)\s*\+\s*(\d+)", question)
    if not numbers:
        raise RuntimeError("Could not parse the parent verification arithmetic.")
    answer = str(int(numbers.group(1)) + int(numbers.group(2)))
    _, input_point = find_node(lambda n: n.attrib.get("class","").endswith("EditText"), timeout=10)
    tap_point(input_point)
    adb("shell","input","text",answer)
    tap_text("Enter", timeout=10, exact=True)
    time.sleep(3)

    # Never tick this checkbox automatically: it is the parent's explicit
    # acceptance of the bundled Supertonic 3 model licence.
    consent_node, _ = find_node(
        lambda n: "Parent agreement:" in n.attrib.get("text",""), timeout=20)
    consent_checked = consent_node.attrib.get("checked","false").lower() == "true"
    if not consent_checked:
        report("blocked_explicit_parent_model_license_consent",
               details="App installed and Parent Settings opened. Voice generation was not started because the app's explicit parent licence checkbox is unchecked. The test automation will not accept legal terms on the user's behalf.",
               parent_gate_question=question,
               consent_checkbox=consent_node.attrib)
        return 0

    # Device is offline before this workflow starts; the app must synthesize
    # both languages using only the bundled runtime and models.
    tap_text("Test both voices", timeout=15)
    deadline = time.time() + 180
    diagnostics = ""
    while time.time() < deadline:
        root = dump_ui()
        for n in root.iter("node"):
            if n.attrib.get("class","").endswith("EditText") and ("test-call" in n.attrib.get("text","") or "native-" in n.attrib.get("text","")):
                diagnostics = n.attrib.get("text","")
                break
        if diagnostics.count("native-end") >= 2 or "native-error" in diagnostics:
            break
        time.sleep(3)

    tap_text("Show speech diagnostics", timeout=10)
    time.sleep(2)
    root = dump_ui()
    for n in root.iter("node"):
        if n.attrib.get("class","").endswith("EditText"):
            candidate = n.attrib.get("text","")
            if "test-call" in candidate or "native-" in candidate:
                diagnostics = candidate
                break

    result = {
        "diagnostics": diagnostics,
        "native_start_count": diagnostics.count("native-start"),
        "native_end_count": diagnostics.count("native-end"),
        "native_error_count": diagnostics.count("native-error"),
        "offline": True
    }
    passed = result["native_start_count"] >= 2 and result["native_end_count"] >= 2 and result["native_error_count"] == 0
    report("passed" if passed else "failed", **result)
    return 0 if passed else 2

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        report("automation_error", error=f"{type(exc).__name__}: {exc}")
        sys.exit(2)
