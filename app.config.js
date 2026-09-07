module.exports = {
  expo: {
    name: "YRDLY",
    slug: "yrdly",
    version: "1.0.0",
    sdkVersion: "54.0.0",
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
      bundleIdentifier: "com.feranmi.dev.yrdlymobile",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      },
      associatedDomains: [
        "applinks:app.yrdly.ng"
      ],
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#E6F4FE"
      },
      package: "com.feranmi.dev.yrdlymobile",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY
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
        "onesignal-expo-plugin",
        {
          mode: "development"
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/logo.png",
          color: "#82DB7E",
          androidMode: "default",
          androidCollapsedTitle: "Yrdly"
        }
      ],
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
          android: {
            enableMultiDex: true
          },
          ios: {
            swiftVersion: "5.9"
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
      eas: {
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: "OneSignalNotificationServiceExtension",
                  bundleIdentifier: "com.feranmi.dev.yrdlymobile.OneSignalNotificationServiceExtension",
                  entitlements: {
                    "com.apple.security.application-groups": [
                      "group.com.feranmi.dev.yrdlymobile.onesignal"
                    ]
                  }
                }
              ]
            }
          }
        },
        projectId: "e7a4c0a6-f56c-4822-b2aa-e6c0eae694cf"
      }
    },
    owner: "yrdly-ltd"
  }
};
