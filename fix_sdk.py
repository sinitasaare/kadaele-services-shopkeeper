import re

# 1. Fix variables.gradle — set both to 34
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle to 34")

# 2. Fix AndroidManifest.xml — ensure android:exported="true" on MainActivity
with open("android/app/src/main/AndroidManifest.xml") as f:
    manifest = f.read()
if 'android:exported' not in manifest:
    manifest = manifest.replace(
        'android:name=".MainActivity"',
        'android:name=".MainActivity"\n            android:exported="true"'
    )
    with open("android/app/src/main/AndroidManifest.xml", "w") as f:
        f.write(manifest)
    print("Patched AndroidManifest.xml - added exported=true")
else:
    print("AndroidManifest.xml already has exported attribute")

# 3. Print verification
with open("android/variables.gradle") as f:
    print("=== variables.gradle ===")
    print(f.read())
with open("android/app/src/main/AndroidManifest.xml") as f:
    print("=== AndroidManifest.xml ===")
    print(f.read())
