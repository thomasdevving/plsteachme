# On-device model assets

These official Google MediaPipe model bundles are served from the app's own origin:

- https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

MediaPipe is distributed under Apache-2.0: https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE

WASM and runtime JavaScript are copied from the lockfile-pinned `@mediapipe/tasks-vision` package by `npm run prepare:vision` (automatically before dev/build). Generated runtime files are ignored by Git.
