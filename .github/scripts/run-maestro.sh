#!/usr/bin/env bash
set -euo pipefail

# Guarda o logcat para o artefato mesmo quando um passo falha
trap 'adb logcat -d > logcat.txt 2>/dev/null || true' EXIT

adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk

maestro test .github/scripts/maestro-warmup.yaml --debug-output maestro-debug/warmup

maestro test "$@" \
  --format junit \
  --output maestro-report.xml \
  --debug-output maestro-debug
