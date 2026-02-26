import re

# 1. Fix variables.gradle - both 34
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle: compileSdk=34, targetSdk=34")

# 2. Remove windowOptOutEdgeToEdgeEnforcement from styles.xml (not available in SDK 34)
styles_path = "android/app/src/main/res/values/styles.xml"
with open(styles_path) as f:
    styles = f.read()
styles = re.sub(r'\s*<item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>\n', '', styles)
with open(styles_path, "w") as f:
    f.write(styles)
print("Cleaned styles.xml")

# 3. Update AGP to 8.3.0
with open("android/build.gradle") as f:
    content = f.read()
content = re.sub(r"classpath 'com.android.tools.build:gradle:[^']*'",
                 "classpath 'com.android.tools.build:gradle:8.3.0'", content)
with open("android/build.gradle", "w") as f:
    f.write(content)
print("Updated AGP to 8.3.0")

# 4. Suppress compileSdk warning and add edge-to-edge opt-out in gradle.properties
with open("android/gradle.properties") as f:
    props = f.read()
if 'suppressUnsupportedCompileSdk' not in props:
    props += '\nandroid.suppressUnsupportedCompileSdk=34\n'
with open("android/gradle.properties", "w") as f:
    f.write(props)
print("Updated gradle.properties")

# 5. Update Gradle wrapper to 8.4
wrapper_path = "android/gradle/wrapper/gradle-wrapper.properties"
with open(wrapper_path) as f:
    wrapper = f.read()
wrapper = re.sub(r'distributionUrl=.*',
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-all.zip', wrapper)
with open(wrapper_path, "w") as f:
    f.write(wrapper)
print("Gradle wrapper set to 8.4")

print("=== variables.gradle ===")
with open("android/variables.gradle") as f: print(f.read())
print("=== styles.xml ===")
with open(styles_path) as f: print(f.read())
