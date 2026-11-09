#!/usr/bin/env bash
set -euo pipefail

# Guarda o logcat para o artefato mesmo quando um passo falha
trap 'adb logcat -d > logcat.txt 2>/dev/null || true' EXIT

# O emulador do CI às vezes deixa um app do sistema (o launcher) em ANR, e o diálogo "isn't responding" fica por
# cima do app: o login está desenhado atrás, mas o Maestro só enxerga o diálogo. Esconder esses diálogos não
# esconde falha do Fiscalize: se o app travar ou fechar, os elementos que os fluxos procuram somem do mesmo jeito.
prepara_emulador() {
  adb shell settings put global hide_error_dialogs 1 || true
  adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null || true
}

prepara_emulador
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
  prepara_emulador
  warmup 2
fi

# Os fluxos rodam uma vez só, sem nova tentativa (docs/testes-automatizados/tas.md, seção 5.4): o aquecimento acima já garante
# que o emulador enxerga o app, então uma falha daqui em diante reprova o job e vira issue.
maestro test "$@" \
  --format junit \
  --output maestro-report.xml \
  --debug-output maestro-debug/flows
