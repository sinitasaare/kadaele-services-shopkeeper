import re

# 1. Fix variables.gradle
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle to 34")

# 2. Fix styles.xml — disable edge-to-edge enforcement for Android 15
styles_path = "android/app/src/main/res/values/styles.xml"
with open(styles_path) as f:
    styles = f.read()
if 'android:windowOptOutEdgeToEdgeEnforcement' not in styles:
    styles = styles.replace(
        '</style>',
        '    <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\n    </style>',
        1
    )
    with open(styles_path, "w") as f:
        f.write(styles)
    print("Patched styles.xml - disabled edge-to-edge enforcement")
else:
    print("styles.xml already patched")

print("=== styles.xml ===")
with open(styles_path) as f:
    print(f.read())
