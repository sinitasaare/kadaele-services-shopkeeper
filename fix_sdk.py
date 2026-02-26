"""
fix_sdk.py — Upgrade Capacitor 5.5.1 defaults from SDK 33 → 34
with a COMPATIBLE AGP + Gradle combination.

Capacitor 5.5.1 ships with:
  compileSdkVersion = 33, targetSdkVersion = 33, AGP 8.0.0, Gradle 8.0.2

Android 15 (API 35) warns "built for older version" when targetSdk < 34.
Simply bumping targetSdk without upgrading AGP causes crashes.

This script upgrades all three together:
  compileSdkVersion = 34  (clears the warning)
  targetSdkVersion  = 34  (clears the warning)
  AGP               = 8.1.4  (supports SDK 34 properly)
  Gradle            = 8.4    (compatible with AGP 8.1.x)
"""
import re

# ── 1. variables.gradle: bump compile + target SDK to 34 ──
with open("android/variables.gradle") as f:
    content = f.read()

content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)

with open("android/variables.gradle", "w") as f:
    f.write(content)

# ── 2. root build.gradle: upgrade AGP to 8.1.4 ──
with open("android/build.gradle") as f:
    content = f.read()

content = re.sub(
    r"classpath 'com.android.tools.build:gradle:[^']*'",
    "classpath 'com.android.tools.build:gradle:8.1.4'",
    content
)

with open("android/build.gradle", "w") as f:
    f.write(content)

# ── 3. gradle-wrapper.properties: upgrade Gradle to 8.4 ──
wrapper_path = "android/gradle/wrapper/gradle-wrapper.properties"
with open(wrapper_path) as f:
    wrapper = f.read()

wrapper = re.sub(
    r'distributionUrl=.*',
    r'distributionUrl=https\://services.gradle.org/distributions/gradle-8.4-all.zip',
    wrapper
)

with open(wrapper_path, "w") as f:
    f.write(wrapper)

# ── Print results for verification ──
print("=" * 60)
print("SDK UPGRADE APPLIED:")
print("  compileSdkVersion = 34")
print("  targetSdkVersion  = 34")
print("  AGP               = 8.1.4")
print("  Gradle            = 8.4")
print("=" * 60)

print("\n=== variables.gradle ===")
with open("android/variables.gradle") as f:
    print(f.read())

print("=== gradle-wrapper.properties ===")
with open(wrapper_path) as f:
    print(f.read())
