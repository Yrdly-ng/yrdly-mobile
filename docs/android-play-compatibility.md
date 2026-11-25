# Android Play compatibility rollout

This change set covers the Android compatibility and checkout work in PR #31:

- ARCore metadata is optional; portrait orientation and Wi-Fi hardware are declared optional so Play device eligibility is not narrowed unnecessarily.
- R8 and resource shrinking are enabled for production-profile Android builds.
- Payluk checkout uses safe-area insets and avoids the legacy status-bar background-color API.
- No delivery/shipment integration is changed by this work.

## Verification already recorded

- Production-profile Expo Android prebuild.
- Generated Gradle properties and Android manifest inspection.
- Release test suite and TypeScript checks.

## Required before Play promotion

1. Produce a signed AAB using the production profile after the Android Firebase client configuration preflight passes.
2. Upload it to the Play Console internal testing track and inspect the 16 KB page-size compatibility, DEX optimization, and device-eligibility results.
3. Test Payluk checkout insets and the core native flows on physical Android devices.
4. Recheck the edge-to-edge finding against the exact signed bundle.
5. Do not promote the build to production until those checks pass.

The current Android Firebase client configuration has a recorded API_KEY_INVALID preflight result. Resolve that configuration separately before creating a distributable native build; do not weaken API-key restrictions to make the preflight pass.
