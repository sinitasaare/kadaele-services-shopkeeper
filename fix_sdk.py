import re

# 1. Fix variables.gradle — compileSdk 35 (has edge-to-edge attr), targetSdk 34
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 35', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle: compileSdk=35, targetSdk=34")

# 2. Fix styles.xml - opt out of edge-to-edge (attr available in SDK 35)
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

# 3. Update Gradle wrapper to 8.4
wrapper_path = "android/gradle/wrapper/gradle-wrapper.properties"
with open(wrapper_path) as f:
    wrapper = f.read()
wrapper = re.sub(r'distributionUrl=.*', 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-all.zip', wrapper)
with open(wrapper_path, "w") as f:
    f.write(wrapper)
print("Gradle wrapper set to 8.4")

print("=== variables.gradle ===")
with open("android/variables.gradle") as f: print(f.read())
print("=== styles.xml ===")
with open(styles_path) as f: print(f.read())
