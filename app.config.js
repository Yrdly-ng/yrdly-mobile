module.exports = {
  expo: {
    name: "YRDLY",
    slug: "yrdly",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    splash: {
      image: "./assets/images/logo.png",
      resizeMode: "contain",
      backgroundColor: "#E6F4FE",
      dark: {
        image: "./assets/images/logo.png",
        backgroundColor: "#0B0D0B"
      }
    },
    scheme: "yrdlymobile",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yrdly",
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
          { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] }
        ],
        NSPrivacyCollectedDataTypes: [
          // Sentry crash reports + performance traces (app health)
          { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCrashData", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] },
          { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePerformanceData", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] },
          { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherDiagnosticData", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] },
          // PostHog screen views + app lifecycle events
          { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeProductInteraction", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"] },
          // Sentry + PostHog are identified by Supabase user ID only
          { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"] }
        ]
      },
      associatedDomains: [
        "applinks:app.yrdly.ng"
      ]
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#E6F4FE"
      },
      package: "com.yrdly",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
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
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      [
        "react-native-maps",
        {
          iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      ],
      [
        "expo-notifications",
        {
          mode: process.env.EAS_BUILD_PROFILE === "development" ? "development" : "production",
          icon: "./assets/images/logo.png",
          color: "#82DB7E",
          androidMode: "default",
          androidCollapsedTitle: "Yrdly"
        }
      ],
      process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID
        ? [
            "crisp-sdk-react-native",
            {
              websiteId: process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID,
              notifications: {
                enabled: true,
                mode: "coexistence"
              }
            }
          ]
        : "crisp-sdk-react-native",
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/logo.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#E6F4FE",
          dark: {
            image: "./assets/images/logo.png",
            backgroundColor: "#0B0D0B"
          }
        }
      ],
      "expo-secure-store",
      "expo-apple-authentication",
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
      "expo-video",
      "expo-audio",
      "./plugins/withAROptional.js",
      "./plugins/withImageCropPicker.js",
      "expo-localization",
      [
        "expo-build-properties",
        {
          ios: {
            enableSceneSupport: true
          },
          android: {
            enableMultiDex: true
          }
        }
      ]
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
