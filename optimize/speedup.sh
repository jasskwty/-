#!/usr/bin/env bash
# Makes the TV feel faster: shorter animations and the background apps in packages.txt turned off.
source "$(dirname "$0")/common.sh"
[ -f "$STATE" ] || { echo "شغّل install.sh أول" >&2; exit 1; }

for key in window_animation_scale transition_animation_scale animator_duration_scale; do
  "${ADB[@]}" shell settings put global "$key" 0.5
done

grep -v '^#' "$DIR/packages.txt" | while read -r pkg; do
  [ -n "$pkg" ] || continue
  if "${ADB[@]}" shell pm list packages -e "$pkg" | tr -d '\r' | grep -qx "package:$pkg"; then
    "${ADB[@]}" shell pm disable-user --user 0 "$pkg" >/dev/null && echo "off=$pkg" >> "$STATE" && echo "أطفأت $pkg"
  fi
done
echo "تم. أعد تشغيل التلفزيون عشان يبان الفرق."
