import re

# Fix root build.gradle
with open("android/build.gradle") as f:
    content = f.read()
if "ext.targetSdkVersion" not in content:
    content = "ext.targetSdkVersion = 34\next.compileSdkVersion = 34\n" + content
    print("Injected ext vars into root build.gradle")
with open("android/build.gradle", "w") as f:
    f.write(content)

# Fix variables.gradle — this is the real source of truth
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle")
print(content)
