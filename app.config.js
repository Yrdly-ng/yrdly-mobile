const CRISP_WEBSITE_ID = process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID || "e843a16b-9483-4622-9c42-5586532ab2fa";
const fs = require("fs");
const path = require("path");

const inlineGoogleServices = process.env.GOOGLE_SERVICES_JSON;
const encodedGoogleServices = process.env.GOOGLE_SERVICES_JSON_BASE64;
const generatedGoogleServicesPath = path.join(__dirname, "google-services.json");
let googleServicesFile = "./google-services.json";

// Prefer the explicitly provisioned build credential. The committed fallback is
// retained for local development, but must never shadow a rotated EAS key.
const verifiedGoogleServicesPath = path.join(__dirname, "config/firebase/android-client.json");
if (inlineGoogleServices?.trim().startsWith("{")) {
  JSON.parse(inlineGoogleServices);
  fs.writeFileSync(generatedGoogleServicesPath, inlineGoogleServices);
} else if (encodedGoogleServices) {
  const decoded = Buffer.from(encodedGoogleServices, "base64").toString("utf8");
  JSON.parse(decoded);
  fs.writeFileSync(generatedGoogleServicesPath, decoded);
} else if (inlineGoogleServices && fs.existsSync(path.resolve(__dirname, inlineGoogleServices))) {
  googleServicesFile = path.relative(__dirname, path.resolve(__dirname, inlineGoogleServices));
} else if (fs.existsSync(verifiedGoogleServicesPath)) {
  const verified = fs.readFileSync(verifiedGoogleServicesPath, "utf8");
  require("./scripts/validate-android-firebase.cjs").validateAndroidFirebase(JSON.parse(verified));
  fs.writeFileSync(generatedGoogleServicesPath, verified);
}

// Android EAS workers must reject a missing, stale or foreign Firebase
// config BEFORE creating an APK/AAB. Checking just "a project number exists"
// is not enough to prevent FCM SENDER_ID_MISMATCH.
//
// EAS_BUILD_PLATFORM is populated on EAS workers, not during local CLI
// evaluation. Keep iOS release builds independent of Android Firebase files.
// The apk profile is Android-only and extends production; validate it too.
const requiresAndroidFirebase =
  process.env.EAS_BUILD_PLATFORM === "android" ||
  process.env.EAS_BUILD_PROFILE === "apk";
const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
if (requiresAndroidFirebase) {
  const configPath = path.resolve(__dirname, googleServicesFile);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      "YRDLY Android Firebase configuration missing: provide GOOGLE_SERVICES_JSON or GOOGLE_SERVICES_JSON_BASE64 in the EAS build environment."
    );
  }
  let firebase;
  try {
    firebase = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    throw new Error("YRDLY Android Firebase configuration is not valid JSON.");
  }
  // This canonical validator checks project_id, sender/project_number,
  // com.yrdly package, and the Android mobilesdk_app_id sender prefix.
  const { validateAndroidFirebase } = require("./scripts/validate-android-firebase.cjs");
  validateAndroidFirebase(firebase);
  if (!androidMapsKey) {
    throw new Error('Android Google Maps configuration missing: provide GOOGLE_MAPS_ANDROID_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY before building an APK.');
  }
}

// Explicit build-time opt-in; QA and preview builds must never collect analytics.
const googleAnalyticsEnabled = process.env.EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS === 'true';
if (googleAnalyticsEnabled && (process.env.EXPO_PUBLIC_APP_ENV !== 'production' ||
  process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'production')) {
  throw new Error('Google measurement is restricted to an approved production build.');
}
const iosFirebaseFile = process.env.GOOGLE_SERVICE_INFO_PLIST;
if (googleAnalyticsEnabled && process.env.EAS_BUILD_PLATFORM === 'ios') {
  if (!iosFirebaseFile || !fs.existsSync(iosFirebaseFile)) throw new Error('Verified production GoogleService-Info.plist is required.');
  const plist = require('node:child_process').execFileSync('/usr/bin/plutil',['-convert','json','-o','-',iosFirebaseFile],{encoding:'utf8'});
  const config = JSON.parse(plist);
  if (config.PROJECT_ID !== 'yrdly-470221' || config.BUNDLE_ID !== 'com.yrdly' || String(config.GCM_SENDER_ID) !== '399225255875' || !/^1:399225255875:ios:[a-f0-9]+$/i.test(config.GOOGLE_APP_ID || '')) throw new Error('Invalid iOS Firebase project or app identifier.');
}
const nativeBuildNumber = process.env.YRDLY_BUILD_NUMBER || '1';
if (!/^[1-9][0-9]*$/.test(nativeBuildNumber) || !Number.isSafeInteger(Number(nativeBuildNumber)) || Number(nativeBuildNumber) > 2100000000) throw new Error('Invalid native build number');
const optimizeAndroidRelease =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.YRDLY_ANDROID_QA_SIZE_OPTIMIZATIONS === '1';

module.exports = {
  expo: {
    name: "YRDLY",
    slug: "yrdly",
    version: "1.0.0",
    updates: {
      url: "https://u.expo.dev/e7a4c0a6-f56c-4822-b2aa-e6c0eae694cf"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    splash: {
      image: "./assets/images/logo.png",
      resizeMode: "contain",
      backgroundColor: "#FAF9F3",
      dark: {
        image: "./assets/images/logo.png",
        backgroundColor: "#0B0D0B"
      }
    },
    scheme: "yrdlymobile",
    userInterfaceStyle: "automatic",
    ios: {
      buildNumber: nativeBuildNumber,
      supportsTablet: true,
      usesAppleSignIn: true,
      bundleIdentifier: "com.yrdly",
      ...(iosFirebaseFile ? {googleServicesFile: iosFirebaseFile} : {}),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        FIREBASE_ANALYTICS_COLLECTION_ENABLED: false,
        FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED: !googleAnalyticsEnabled,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE: false,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE: false,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA: false,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS: false
      },
      associatedDomains: [
        "applinks:app.yrdly.ng"
      ]
    },
    android: {
      // Opt in explicitly to Android 15+ edge-to-edge layout and inset handling.
      edgeToEdgeEnabled: true,
      // The clipboard module changes Android native code. Keep this runtime
      // distinct from existing 1.0.0 binaries so they cannot receive this JS update.
      runtimeVersion: "1.0.1",
      versionCode: Number(nativeBuildNumber),
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#E6F4FE"
      },
      package: "com.yrdly",
      googleServicesFile,
      config: {
        googleMaps: {
          apiKey: androidMapsKey
        }
      },
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "app.yrdly.ng",
              pathPrefix: "/"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ],
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.VIBRATE",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ],
      // Users choose individual images and videos via the Android system picker
      // (including the React Native crop picker), not continuous gallery access.
      // Block dependencies from re-adding these permissions during manifest merge.
      blockedPermissions: [
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      ...(googleAnalyticsEnabled ? ["@react-native-firebase/app", ["@react-native-firebase/analytics", {ios: {withoutAdIdSupport: true}}]] : []),
      "./plugins/withGoogleAnalyticsPrivacy.js",
      "expo-apple-authentication",
      [
        "@sentry/react-native/expo",
        {
          organization: process.env.SENTRY_ORG || "yrdly-ltd",
          project: process.env.SENTRY_PROJECT || "yrdly-mobile",
          url: process.env.SENTRY_URL || "https://sentry.io/",
          experimental_android: {
            enableAndroidGradlePlugin: true,
            uploadNativeSymbols: true,
            autoUploadNativeSymbols: true,
            includeNativeSources: false
          }
        }
      ],
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: androidMapsKey,
          iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      ],
      [
        "expo-notifications",
        {
          mode: process.env.EAS_BUILD_PROFILE === "production" ? "production" : "development",
          icon: "./assets/images/logo.png",
          color: "#82DB7E",
          androidMode: "default",
          androidCollapsedTitle: "Yrdly"
        }
      ],
      [
        "crisp-sdk-react-native",
        {
          websiteId: CRISP_WEBSITE_ID,
          notifications: {
            enabled: true,
            mode: "coexistence"
          }
        }
      ],
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/logo.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#FAF9F3",
          dark: {
            image: "./assets/images/logo.png",
            backgroundColor: "#0B0D0B"
          }
        }
      ],
      "expo-secure-store",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Yrdly uses your location to connect you with your local neighbourhood — nearby posts, events, and marketplace listings.",
          isAndroidBackgroundLocationEnabled: false
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Yrdly needs camera access to scan event tickets at check-in.",
          microphonePermission: false
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Yrdly needs photo library access to attach evidence to disputes and update your profile picture.",
          cameraPermission: "Yrdly needs camera access to take photos for disputes."
        }
      ],
      ["expo-sqlite", { useSQLCipher: true }],
      "expo-video",
      ["expo-audio", { enableBackgroundPlayback: false }],
      "./plugins/withImageCropPicker.js",
      "./plugins/withAndroidOptionalFeatures.js",
      "expo-localization",
      [
        "expo-build-properties",
        {
          android: {
            enableMultiDex: true,
            enableMinifyInReleaseBuilds: optimizeAndroidRelease,
            enableShrinkResourcesInReleaseBuilds: optimizeAndroidRelease,
          },
          ios: {
            enableSceneSupport: true,
            ...(googleAnalyticsEnabled ? {useFrameworks: "static"} : {})
          }
        }
      ],
      "./plugins/withAndroidBuildMemory.js",
      "./plugins/withOptimizedResourceShrinking.js"
    ],
    newArchEnabled: true,
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://app.yrdly.ng',
      eas: {
        projectId: "e7a4c0a6-f56c-4822-b2aa-e6c0eae694cf"
      }
    },
    owner: "yrdly-ltd"
  }
};