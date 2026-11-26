# Android 15 edge-to-edge and release optimization

## Changes in this branch

- Explicitly enables Expo's Android edge-to-edge configuration so Android 15+ layout uses the supported edge-to-edge path and app content must respect window insets.
- Enables Android Gradle Plugin's optimized resource shrinking property. Production already enables R8 minification and resource shrinking through `expo-build-properties`; this opts the shrinker into its optimized resource analysis where supported.

## Edge-to-edge Play Console advisory

The Play Console advisory reported references from React Native's `StatusBarModule`, React Native's edge-to-edge implementation, and Google's Material Bottom Sheet. A source search of YRDLY's application code found no calls to `StatusBar.setBackgroundColor`, `StatusBar.setTranslucent`, or the deprecated Android `Window` color methods. The only app-level React Native StatusBar usage sets `barStyle`.

React Native 0.86 includes Android 15 edge-to-edge support, but its native StatusBar module and transitive Android libraries may still contain compatibility references that Play's static analysis reports. Enabling edge-to-edge is the supported layout migration; it does not guarantee that Play Console will remove every static API warning. Do not patch React Native internals or suppress the warning without a tested upstream fix.

## Verification required before merging

1. Run the Android production AAB workflow from this branch and confirm Gradle accepts `android.r8.optimizedResourceShrinking=true`.
2. Inspect the generated `android/gradle.properties` and confirm `android.edgeToEdgeEnabled` is enabled in the generated Android project.
3. Install the resulting AAB from an internal testing track on Android 15 and a pre-Android 15 device.
4. Check status-bar icons, navigation-bar insets, modal/bottom-sheet layouts, keyboard behavior, and the Payluk checkout screen.
5. Compare the Play Console App Bundle Explorer / Android vitals recommendations against this exact new bundle. The old release's warning is historical and cannot be retroactively changed.

## Scope

This change does not upgrade React Native, Expo, Android Gradle Plugin, or Material Components. Those are managed by the current Expo / React Native dependency set and should only be changed in a separate, compatibility-tested dependency upgrade.
