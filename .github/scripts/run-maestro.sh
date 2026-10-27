#!/usr/bin/env bash
set -euo pipefail

# Guarda o logcat para o artefato mesmo quando um passo falha
trap 'adb logcat -d > logcat.txt 2>/dev/null || true' EXIT

adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk

warmup() {
  maestro test .github/scripts/maestro-warmup.yaml --debug-output "maestro-debug/warmup-$1"
}

# Às vezes o serviço de acessibilidade do emulador trava: o app desenha o login, mas o Maestro
# não enxerga nenhum elemento e relançar o app não resolve. Reiniciar o emulador destrava.
if ! warmup 1; then
  echo "::warning::Maestro não enxergou o app no aquecimento; reiniciando o emulador e tentando de novo"
  adb logcat -d > logcat-warmup-1.txt 2>/dev/null || true
  adb reboot
  adb wait-for-device
  for _ in $(seq 1 150); do
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 2
  done
  adb shell input keyevent 82 || true
  warmup 2
fi

# Uma nova tentativa, como o retries: 1 do Playwright: o emulador do CI às vezes falha sem relação com o app.
# A falha da primeira tentativa fica registrada como aviso e em maestro-debug/flows-1.
for tentativa in 1 2; do
  if maestro test "$@" \
    --format junit \
    --output maestro-report.xml \
    --debug-output "maestro-debug/flows-$tentativa"; then
    exit 0
  fi
  if [ "$tentativa" = 1 ]; then
    echo "::warning::Fluxos do Maestro falharam na 1ª tentativa; repetindo uma vez"
  fi
done
exit 1
