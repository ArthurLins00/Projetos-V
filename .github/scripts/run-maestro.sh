#!/usr/bin/env bash
set -euo pipefail

adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk

maestro test .github/scripts/maestro-warmup.yaml

maestro test "$@" \
  --format junit \
  --output maestro-report.xml \
  --debug-output maestro-debug
