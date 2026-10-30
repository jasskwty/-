#!/usr/bin/env bash
# Puts the TV back as it was: the apps that were turned off, the old home screen and screensaver, and removes شاشتي.
source "$(dirname "$0")/common.sh"

if [ -f "$STATE" ]; then
  grep '^off=' "$STATE" | cut -d= -f2 | while read -r pkg; do
    "${ADB[@]}" shell pm enable --user 0 "$pkg" >/dev/null && echo "رجّعت $pkg"
  done
  dream=$(grep '^dream=' "$STATE" | cut -d= -f2-)
  home=$(grep '^home=' "$STATE" | cut -d= -f2-)
  anim=$(grep '^anim=' "$STATE" | cut -d= -f2-)
  [ -n "$dream" ] && [ "$dream" != null ] && "${ADB[@]}" shell settings put secure screensaver_components "$dream"
  [[ "$home" == */* ]] && "${ADB[@]}" shell cmd package set-home-activity "$home"
  for key in window_animation_scale transition_animation_scale animator_duration_scale; do
    if [ -n "$anim" ] && [ "$anim" != null ]; then
      "${ADB[@]}" shell settings put global "$key" "$anim"
    else
      "${ADB[@]}" shell settings delete global "$key" >/dev/null
    fi
  done
  rm -f "$STATE"
fi
"${ADB[@]}" uninstall tv.shashati || true
echo "رجع التلفزيون مثل ما كان. أعد تشغيله."
