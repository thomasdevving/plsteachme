#!/usr/bin/env bash
# Linux x64 cloud toolchain; no sudo and no changes to tracked application files.
set -euo pipefail
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'Use Android Studio and JDK 21 on this platform; this helper targets Linux x64.' >&2
  exit 1
fi
root="${PLSTEACH_TOOL_ROOT:-/workspace}"
mkdir -p "$root"
if [[ ! -x "$root/.plsteach-jdk/bin/javac" ]]; then
  archive="$(mktemp -d)"
  trap 'rm -rf "$archive"' EXIT
  curl -fSL 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz' -o "$archive/jdk.tar.gz"
  printf '%s  %s\n' 'ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94' "$archive/jdk.tar.gz" | sha256sum -c -
  mkdir -p "$root/.plsteach-jdk"
  tar -xzf "$archive/jdk.tar.gz" -C "$root/.plsteach-jdk" --strip-components=1
fi
export JAVA_HOME="$root/.plsteach-jdk"
export ANDROID_HOME="$root/.android-sdk"
export ANDROID_USER_HOME="$root/.android-user"
mkdir -p "$ANDROID_USER_HOME"
if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  archive="$(mktemp -d)"
  trap 'rm -rf "$archive"' EXIT
  curl -fSL 'https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip' -o "$archive/android.zip"
  # Checksum from Google's repository2-1.xml for this exact archive.
  printf '%s  %s\n' 'e025545c62a8e64c7559119566a569fb1dec5f60' "$archive/android.zip" | sha1sum -c -
  unzip -q "$archive/android.zip" -d "$archive"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  mv "$archive/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
if [[ ! -d "$ANDROID_HOME/platforms/android-36" || ! -d "$ANDROID_HOME/build-tools/35.0.0" || ! -x "$ANDROID_HOME/platform-tools/adb" ]]; then
  # The pinned Android CLI fetches and verifies the SDK packages. Accept the
  # standard SDK licenses for this development environment without interaction.
  "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" 'platforms;android-36' 'build-tools;35.0.0' 'platform-tools' <<'LICENSES'
y
y
y
y
y
y
y
y
y
y
LICENSES
fi
"$JAVA_HOME/bin/javac" -version
printf 'Android toolchain installed under %s. Run npm run android:cloud to build.\n' "$root"
