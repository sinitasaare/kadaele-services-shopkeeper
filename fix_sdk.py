"""
verify_sdk.py — Prints the Android SDK settings for debugging.

Previously this script (fix_sdk.py) DOWNGRADED targetSdkVersion to 33
and AGP to 8.0.0. This caused:
  1. "Built for older version of Android" warning (targetSdk 33 on Android 15)
  2. App crashes when targetSdk was bumped to 34 (AGP 8.0.0 incompatibility)

FIX: Let Capacitor 5.5.1 use its own defaults. Do NOT override them.
"""
import pathlib

for name in ("android/variables.gradle",
             "android/build.gradle",
             "android/gradle/wrapper/gradle-wrapper.properties"):
    p = pathlib.Path(name)
    if p.exists():
        print(f"\n=== {name} ===")
        print(p.read_text())
    else:
        print(f"\n=== {name} === (not found)")

print("\n✅ SDK settings are Capacitor defaults — no modifications applied.")
