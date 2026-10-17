# plsteach.me mobile

An installable Capacitor app for Android and iOS, built on the `feat/mobile-app` branch. The native package includes its own React/Vite interface and reuses the website’s nine lessons, all 63 illustrated steps, safety guidance, skill categories and progress validation. It loads bundled assets rather than a remote website.

## What works

- Today screen, searchable and filterable skill library, progress and settings.
- Offline illustrated lessons with materials, safety guidance, replay and reduced motion.
- Self-checked and unresolved checkpoints, completion review, resume and per-lesson reset with confirmation.
- Device-local progress through Capacitor Preferences (SharedPreferences on Android, UserDefaults on iOS). Writes are serialized; storage failures are visible.
- Android hardware Back, safe-area insets, native icons and launch screens.
- Explicit links to online lessons and privacy information through the system browser.

The app does not upload learner data, embed credentials, require an account or request camera/microphone permissions. Camera coaching, accounts, teacher contributions and community features remain on the website. Opening the website needs connectivity; its login and progress are separate from the app. Uninstalling/clearing app data removes local progress. Android cloud backup is disabled. An iOS privacy manifest declares the UserDefaults API used for local preferences.

## Develop

Use Node.js 24. Install both packages from the repository root; the app imports shared source files from the parent project.

```sh
npm ci
npm --prefix mobile ci
npm run mobile:dev
```

The Vite development server uses port 3200. `npm run mobile:build` performs the mobile TypeScript check and creates `mobile/dist`. The original Next.js workflow remains `npm run dev` on port 3100.

## Android

Use JDK 21, Android SDK platform 36, build-tools 35.0.0, and platform-tools. Android 7 (API 24) or newer is supported by the native project; use a current Android System WebView. Set `ANDROID_HOME` and `JAVA_HOME`, or configure Android Studio normally.

```sh
cd mobile
npm run android:debug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android` builds/syncs assets and opens Android Studio. Release signing and store publication are separate steps: set your application ID, version and signing configuration before publishing. Never commit keystores. The generated debug APK is for device testing, not a Play Store release.

### This Linux cloud environment

```sh
cd /workspace/plsteachme/mobile
npm run setup:android:cloud
npm run android:cloud
```

The setup helper installs checksum-verified JDK/SDK tools outside the checkout. The build helper uses the cloud HTTPS proxy and system Java CA trust store, preserves TLS verification, keeps Gradle/Java data under `/workspace`, and limits Gradle to two workers. `PLSTEACH_TOOL_ROOT` can override the tool directory. `JAVA_HOME` and `ANDROID_HOME` can override the corresponding installations. No privileged installation is needed.

## iOS

The generated Xcode project uses Swift Package Manager and targets iOS 15+. On a Mac with Xcode 26 or newer:

```sh
npm ci
npm --prefix mobile ci
cd mobile
npm run ios
```

In Xcode, select your signing team and a simulator/device, then build/run. Archive and distribute through your own Apple Developer account when ready. This Linux environment cannot compile, sign or run the iOS app. The project and plugin synchronization were verified here; simulator/device behavior still needs testing on macOS.

The app ID defaults to `me.plsteach.app`. If changing it, update `capacitor.config.ts`, the Android application ID/namespace and the Xcode target’s bundle identifier consistently.

## Validation

```sh
npm run mobile:build
npm run mobile:test
```

The Playwright tests exercise every lesson step, saved progress across reloads, reset isolation, unresolved checkpoints, search, filters, navigation, reduced motion, offline navigation, storage failures and 320/390/768px layouts. They test the bundled UI in a browser; native-device tests remain necessary for platform behavior.

With the system Chromium supplied in this cloud environment:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run mobile:test
```

Elsewhere, install Playwright’s Chromium using `cd mobile && npx playwright install chromium`. Tests run against a production Vite preview on port 3200. A browser preview is not an installed app and does not provide offline cold launches; native packages serve assets from their bundled filesystem.

Checks performed for this change:

- Mobile type check and production bundle; Android Gradle debug build and repeat build.
- Mobile browser workflow tests and automated WCAG A/AA checks of Today, Explore, progress, settings and a lesson.
- Existing website: 266 unit tests, type check, production build, production catalog request and 13 lesson/catalog browser tests.
- Android/iOS Capacitor plugin synchronization. iOS compilation and physical-device checks remain unrun.

No backend credentials are necessary for these local workflows. Live OpenAI/Supabase behavior was not tested.

## Maintaining the native bundle

Run `npm run sync` in this directory after changes to mobile UI, shared lesson content or plugins. Commit native project configuration; bundled `dist`, copied native web assets, dependencies and build outputs are ignored. `npm run assets` regenerates native icons/splashes from the existing website hands logo. Both native projects are checked in, so do not run `cap add` again.
