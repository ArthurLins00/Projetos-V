#!/usr/bin/env bash
set -euo pipefail

adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk

curl -sf "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false" -o /dev/null \
  || echo "Aviso: não foi possível pré-compilar o bundle; o primeiro fluxo vai esperar o Metro."

maestro test "$@" \
  --format junit \
  --output maestro-report.xml \
  --debug-output maestro-debug
