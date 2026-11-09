#!/usr/bin/env bash
# Restauração do Fiscalize a partir de uma cópia gerada por scripts/backup.sh.
# Política e testes de restauração: docs/seguranca-da-informacao/05_Backup_e_Continuidade_de_Operacao.md
#
#   scripts/restore.sh [--yes] <carimbo | arquivo .sha256> [pasta]
#
#   carimbo   o trecho de data e hora dos arquivos, ex.: 20261109T030000Z (ou "latest" para a cópia mais recente)
#   pasta     onde estão os arquivos; padrão: $BACKUP_DIR ou ./backups
#   --yes     não pede confirmação (para automação e para o teste do CI)
#
# Substitui o banco e as fotos atuais pelos da cópia. Antes de restaurar, confere as somas SHA-256 e, se os
# arquivos estiverem cifrados, pede BACKUP_PASSPHRASE. Depois, limpa o cache do Redis (métricas e contadores)
# para a API não servir dados de antes da restauração.
#
# Atenção (LGPD, Atividade 5 seção 3.4): depois de restaurar uma cópia antiga, reaplique as exclusões e
# anonimizações registradas desde a data da cópia.
set -euo pipefail

YES=false
if [ "${1:-}" = "--yes" ]; then YES=true; shift; fi

TARGET=${1:-}
DIR=${2:-${BACKUP_DIR:-./backups}}

log() { echo "[restore] $*"; }
fail() { echo "[restore] ERRO: $*" >&2; exit 1; }

[ -n "$TARGET" ] || fail "uso: scripts/restore.sh [--yes] <carimbo | latest | arquivo .sha256> [pasta]"

case "$TARGET" in
  latest) SUMS=$(ls -1 "$DIR"/fiscalize-*.sha256 2>/dev/null | sort | tail -n 1) ;;
  *.sha256) SUMS=$TARGET; DIR=$(dirname "$TARGET") ;;
  *) SUMS="$DIR/fiscalize-$TARGET.sha256" ;;
esac
[ -n "$SUMS" ] && [ -f "$SUMS" ] || fail "cópia não encontrada (procurei $SUMS em $DIR)"
PREFIX=$(basename "$SUMS" .sha256)

command -v docker >/dev/null || fail "docker não encontrado"
docker compose ps --status running --services | grep -qx postgres || fail "o serviço postgres não está rodando (docker compose up -d)"
docker compose ps --status running --services | grep -qx backend || fail "o serviço backend não está rodando (docker compose up -d)"

log "conferindo a integridade de $PREFIX"
(cd "$DIR" && sha256sum --check --quiet "$(basename "$SUMS")") || fail "soma SHA-256 não confere; a cópia está corrompida ou incompleta"

DB_FILE=$(ls -1 "$DIR/$PREFIX-db.sql.gz"* | head -n 1)
UPLOADS_FILE=$(ls -1 "$DIR/$PREFIX-uploads.tar.gz"* | head -n 1)

if ! $YES; then
  printf 'Isto SUBSTITUI o banco e as fotos atuais pela cópia %s. Digite "restaurar" para continuar: ' "$PREFIX"
  read -r answer
  [ "$answer" = "restaurar" ] || fail "cancelado"
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

open_file() {
  local file=$1 out=$2
  if [[ "$file" == *.gpg ]]; then
    [ -n "${BACKUP_PASSPHRASE:-}" ] || fail "a cópia está cifrada: defina BACKUP_PASSPHRASE"
    printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 0 \
      --decrypt --output "$out" "$file" || fail "não foi possível decifrar $(basename "$file") (senha errada?)"
  else
    cp "$file" "$out"
  fi
}

open_file "$DB_FILE" "$TMP/db.sql.gz"
open_file "$UPLOADS_FILE" "$TMP/uploads.tar.gz"

log "restaurando o banco"
# O dump foi gerado com --clean: apaga e recria cada objeto. ON_ERROR_STOP interrompe no primeiro erro
# e --single-transaction desfaz tudo se algo falhar, deixando o banco como estava.
zcat "$TMP/db.sql.gz" | docker compose exec -T postgres sh -c \
  'psql -q -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > /dev/null

log "restaurando as fotos"
docker compose exec -T backend sh -c 'find /app/uploads -mindepth 1 -delete && tar xzf - -C /app/uploads' < "$TMP/uploads.tar.gz"

if docker compose ps --status running --services | grep -qx redis; then
  log "limpando o cache do Redis"
  docker compose exec -T redis redis-cli FLUSHALL > /dev/null
fi

log "concluído: banco e fotos restaurados de $PREFIX"
