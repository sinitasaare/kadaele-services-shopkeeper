import re, os

# 1. Fix variables.gradle - both 34
with open("android/variables.gradle") as f:
    content = f.read()
content = re.sub(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = 34', content)
content = re.sub(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = 34', content)
with open("android/variables.gradle", "w") as f:
    f.write(content)
print("Patched variables.gradle: compileSdk=34, targetSdk=34")

# 2. Write MainActivity.java with edge-to-edge disabled
main_activity = """package com.kadaele.shopkeeper;

import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Disable edge-to-edge enforcement (Android 15 / targetSdk 34)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        super.onCreate(savedInstanceState);
    }
}
"""

main_activity_path = "android/app/src/main/java/com/kadaele/shopkeeper/MainActivity.java"
os.makedirs(os.path.dirname(main_activity_path), exist_ok=True)
with open(main_activity_path, "w") as f:
    f.write(main_activity)
print("Created MainActivity.java with edge-to-edge disabled")

# 3. Update AGP to 8.3.0
with open("android/build.gradle") as f:
    content = f.read()
content = re.sub(r"classpath 'com.android.tools.build:gradle:[^']*'",
                 "classpath 'com.android.tools.build:gradle:8.3.0'", content)
with open("android/build.gradle", "w") as f:
    f.write(content)
print("Updated AGP to 8.3.0")

# 4. Gradle wrapper to 8.4
wrapper_path = "android/gradle/wrapper/gradle-wrapper.properties"
with open(wrapper_path) as f:
    wrapper = f.read()
wrapper = re.sub(r'distributionUrl=.*',
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-all.zip', wrapper)
with open(wrapper_path, "w") as f:
    f.write(wrapper)
print("Gradle wrapper set to 8.4")

print("=== MainActivity.java ===")
with open(main_activity_path) as f: print(f.read())
print("=== variables.gradle ===")
with open("android/variables.gradle") as f: print(f.read())
