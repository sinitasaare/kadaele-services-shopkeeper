import re

# Only patch variables.gradle - keep it simple
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle: compileSdk=34, targetSdk=34")

# Revert AGP back to 8.0.0 (original working version)
with open("android/build.gradle") as f:
    content = f.read()
content = re.sub(r"classpath 'com.android.tools.build:gradle:[^']*'",
                 "classpath 'com.android.tools.build:gradle:8.0.0'", content)
with open("android/build.gradle", "w") as f:
    f.write(content)
print("Reverted AGP to 8.0.0")

# Revert Gradle wrapper back to 8.2.1 (original working version)
wrapper_path = "android/gradle/wrapper/gradle-wrapper.properties"
with open(wrapper_path) as f:
    wrapper = f.read()
wrapper = re.sub(r'distributionUrl=.*',
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2.1-all.zip', wrapper)
with open(wrapper_path, "w") as f:
    f.write(wrapper)
print("Reverted Gradle wrapper to 8.2.1")

with open("android/variables.gradle") as f: print(f.read())
