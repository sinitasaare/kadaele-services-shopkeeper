import re

# 1. Fix variables.gradle
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle to 34")

# 2. Update Android Gradle Plugin to 8.3.0 (supports compileSdk 34 + edge-to-edge attr)
with open("android/build.gradle") as f:
    content = f.read()
content = content.replace(
    "classpath 'com.android.tools.build:gradle:8.0.0'",
    "classpath 'com.android.tools.build:gradle:8.3.0'"
)
with open("android/build.gradle", "w") as f:
    f.write(content)
print("Updated Android Gradle Plugin to 8.3.0")

# 3. Fix styles.xml - opt out of edge-to-edge (requires AGP 8.3+)
styles_path = "android/app/src/main/res/values/styles.xml"
with open(styles_path) as f:
    styles = f.read()
if 'windowOptOutEdgeToEdgeEnforcement' not in styles:
    styles = styles.replace(
        '</style>',
        '    <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\n    </style>',
        1
    )
    with open(styles_path, "w") as f:
        f.write(styles)
    print("Patched styles.xml")
else:
    print("styles.xml already patched")

print("=== build.gradle ===")
with open("android/build.gradle") as f: print(f.read())
print("=== styles.xml ===")
with open(styles_path) as f: print(f.read())
