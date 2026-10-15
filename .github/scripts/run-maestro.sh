#!/usr/bin/env bash
# Executado dentro do android-emulator-runner, com o emulador já ligado.
# Fica num arquivo próprio porque o runner executa cada linha do `script` separadamente.
set -euo pipefail

adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk

# Compila o bundle antes do primeiro fluxo, para o login não estourar o tempo esperando o Metro
curl -sf "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false" -o /dev/null \
  || echo "Aviso: não foi possível pré-compilar o bundle; o primeiro fluxo vai esperar o Metro."

maestro test mobile/e2e \
  --format junit \
  --output maestro-report.xml \
  --debug-output maestro-debug
