#!/usr/bin/env bash
set -euo pipefail

# Guarda o logcat para o artefato mesmo quando um passo falha
trap 'adb logcat -d > logcat.txt 2>/dev/null || true' EXIT

# O emulador do CI às vezes deixa um app do sistema (o launcher) em ANR, e o diálogo "isn't responding" fica por
# cima do app: o login está desenhado atrás, mas o Maestro só enxerga o diálogo. Esconder esses diálogos não
# esconde falha do Fiscalize: se o app travar ou fechar, os elementos que os fluxos procuram somem do mesmo jeito.
adb shell settings put global hide_error_dialogs 1 || true
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null || true

adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk

# Os fluxos rodam uma vez só, sem aquecimento, reinício do emulador nem nova tentativa
# (docs/testes-automatizados/tas.md, seção 5.4): a primeira falha reprova o job e vira issue.
maestro test "$@" \
  --format junit \
  --output maestro-report.xml \
  --debug-output maestro-debug/flows
