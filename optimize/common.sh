#!/usr/bin/env bash
# Shared by every script: connects to the TV given as the first argument (its IP).
set -euo pipefail
TV="${1:-}"
if [ -z "$TV" ]; then
  echo "الاستخدام: $0 <عنوان IP حق التلفزيون>   مثال: $0 192.168.1.50" >&2
  exit 1
fi
command -v adb >/dev/null || { echo "ركّب adb أول (Android platform-tools)" >&2; exit 1; }
adb connect "$TV:5555" >/dev/null
echo "إذا طلع على التلفزيون سؤال «Allow USB debugging» اضغط Allow."
adb -s "$TV:5555" wait-for-device
ADB=(adb -s "$TV:5555")
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$DIR/state-$TV.txt"
