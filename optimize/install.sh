#!/usr/bin/env bash
# Installs شاشتي and sets it as the home screen and the screensaver.
source "$(dirname "$0")/common.sh"
APK="${2:-$DIR/../shashati.apk}"
[ -f "$APK" ] || { echo "ما لقيت $APK. حمّله من صفحة Releases أو ابنِه: ./gradlew assembleRelease" >&2; exit 1; }

# Remember what was there before, so reset.sh can put it back.
if [ ! -f "$STATE" ]; then
  {
    echo "dream=$("${ADB[@]}" shell settings get secure screensaver_components | tr -d '\r')"
    echo "home=$("${ADB[@]}" shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1 | tr -d '\r')"
    echo "anim=$("${ADB[@]}" shell settings get global animator_duration_scale | tr -d '\r')"
  } > "$STATE"
fi

"${ADB[@]}" install -r "$APK"
"${ADB[@]}" shell cmd package set-home-activity tv.shashati/.HomeActivity
"${ADB[@]}" shell settings put secure screensaver_enabled 1
"${ADB[@]}" shell settings put secure screensaver_components tv.shashati/.ScreensaverService
"${ADB[@]}" shell am start -a android.intent.action.MAIN -c android.intent.category.HOME
echo "تم. اضغط زر الهوم في الريموت وبتشوف شاشتي."
