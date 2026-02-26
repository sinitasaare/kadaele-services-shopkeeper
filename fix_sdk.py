import re, sys

with open("android/build.gradle") as f:
    content = f.read()

if "ext.targetSdkVersion" in content:
    content = re.sub(r"ext\.targetSdkVersion\s*=\s*\d+", "ext.targetSdkVersion = 34", content)
    content = re.sub(r"ext\.compileSdkVersion\s*=\s*\d+", "ext.compileSdkVersion = 34", content)
    print("Patched existing ext vars")
else:
    content = "ext.targetSdkVersion = 34\next.compileSdkVersion = 34\n" + content
    print("Injected ext vars at top")

with open("android/build.gradle", "w") as f:
    f.write(content)
