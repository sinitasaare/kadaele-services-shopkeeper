import re

# Fix variables.gradle — target 33 to avoid Android 14 strict mode crashes
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 33', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Set compileSdk=34, targetSdk=33")
print(content)
