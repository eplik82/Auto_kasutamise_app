#!/bin/bash
# Käivitab virtuaalse Android-tahvli (WSL + WSLg) ja appi testserveri.
# Kasutus: bash tools/start_emulator.sh     → tahvlis Chrome'is ava http://localhost:8765
set -e
SDK=~/android-sdk
# WSL-ist puuduvad teegid (libpulse, nss jne) – alla laaditud ilma rootita: apt-get download + dpkg-deb -x
X=$SDK/extra-libs/root/usr/lib/x86_64-linux-gnu
export LD_LIBRARY_PATH=$X:$X/pulseaudio${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
APP="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -w /dev/kvm ]; then
  echo "KVM pole lubatud. Käivita üks kord:  sudo chmod 666 /dev/kvm   (või: sudo usermod -aG kvm $USER ja WSL restart)"; exit 1
fi
# testserver (kui juba ei jookse)
if ! curl -s -o /dev/null http://localhost:8765/index.html; then
  (cd "$APP" && nohup python3 -m http.server 8765 >/tmp/autoapp-server.log 2>&1 &)
fi
nohup $SDK/emulator/emulator -avd Tahvel_test -no-snapshot-save -no-boot-anim >/tmp/autoapp-emu.log 2>&1 &
echo "Emulaator käivitub (1–2 min)…"
$SDK/platform-tools/adb wait-for-device
until [ "$($SDK/platform-tools/adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 3; done
# emulaatori localhost:8765 → arvuti testserver (localhost = turvaline, kaamera ja offline töötavad)
$SDK/platform-tools/adb reverse tcp:8765 tcp:8765
$SDK/platform-tools/adb shell am start -a android.intent.action.VIEW -d http://localhost:8765/index.html com.android.chrome >/dev/null
echo "Valmis: tahvlis avati Chrome → http://localhost:8765. Avakuvale: ⋮ → Lisa avakuvale / Installi."
