# Video editing and feed media

Selecting a video in post, event or marketplace creation, or chat, opens the
editor before upload. Users can trim its start/end, choose a preset or custom
frame ratio, zoom and move the crop. Apply edits writes a separate MP4 in the
app cache; Keep original preserves the input; Cancel sends or attaches nothing.
Draft attachments can be edited again. Existing limits remain 40 MB per creation
video (three videos) and 15 MB for chat.

`react-native-media-toolkit` uses native AVFoundation on iOS and Media3 on
Android. It is dynamically loaded when metadata/export is needed. Edits preserve
sound, use rotation-corrected coordinates and never overwrite the original.
Native exports run serially. Cancelling dismisses the editor immediately; the
native operation may finish in the background, after which its output is
discarded. Failed/oversized outputs are removed. Accepted temporary edits are
removed when discarded, replaced or successfully uploaded.

Home-feed images, videos and video posters use contain fitting, keeping the
entire frame visible. Screen-width changes update the card layout. Letterboxing
is expected where the frame and card dimensions differ. A user's saved crop
remains part of their video.

## Verification and release

**A new native Android/iOS build is required.** An OTA JavaScript update cannot
install the native editor. Expo Go and previously distributed binaries do not
establish compatibility with this dependency. No new key or database migration
is needed.

The nine helper/chat tests passed before the user asked to skip further testing
on 13 October 2026. They cover geometry, mocked native export, metadata units,
limits, cleanup, serialized work, chat cancellation and uploading the edited
URI. They do not prove real native encoding or playback. Further browser/device
and native compile verification for this feature were skipped at the user's
request. Typecheck/lint results are recorded with the release work. The tests
are included in the existing release-check command for subsequent runs.

Future device verification should cover Android/iOS export, rotated MOV/MP4
inputs, audio, crop positioning, duration, cancellation, custom-ratio keyboard
behavior and full-frame portrait/landscape/mixed-media feed cards. The earlier
user-reported checks on Samsung A21s and iPhone 12 used older builds and do not
verify this feature.
