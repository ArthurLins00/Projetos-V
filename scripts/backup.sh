#!/usr/bin/env bash
# Backup do Fiscalize: banco (pg_dump) e fotos (volume uploads) da stack do Docker Compose.
# Política e testes de restauração: docs/seguranca-da-informacao/05_Backup_e_Continuidade_de_Operacao.md
#
#   scripts/backup.sh [pasta]        padrão: $BACKUP_DIR ou ./backups
#
# Variáveis (opcionais):
#   BACKUP_PASSPHRASE   cifra os arquivos com AES-256 (gpg, modo simétrico); sem ela, ficam só compactados
#   BACKUP_KEEP_DAYS    apaga cópias com mais dias que isto (padrão 7; 0 desliga a rotação)
#
# Roda na raiz do repositório, onde fica o compose.yaml; respeita COMPOSE_FILE e COMPOSE_PROFILES do .env
# (por exemplo, o compose.prod.yaml do deploy). Cada execução gera, com o mesmo carimbo de data e hora:
#   fiscalize-<carimbo>-db.sql.gz[.gpg]        dump lógico com --clean (restaura por cima de um banco existente)
#   fiscalize-<carimbo>-uploads.tar.gz[.gpg]   fotos dos chamados e de perfil
#   fiscalize-<carimbo>.sha256                 somas para conferir a integridade antes de restaurar
set -euo pipefail

DEST=${1:-${BACKUP_DIR:-./backups}}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-7}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
PREFIX="fiscalize-$STAMP"

log() { echo "[backup] $*"; }
fail() { echo "[backup] ERRO: $*" >&2; exit 1; }

command -v docker >/dev/null || fail "docker não encontrado"
docker compose ps --status running --services | grep -qx postgres || fail "o serviço postgres não está rodando (docker compose up -d)"
docker compose ps --status running --services | grep -qx backend || fail "o serviço backend não está rodando (docker compose up -d)"

mkdir -p "$DEST"
TMP=$(mktemp -d "$DEST/.tmp-XXXXXX")
trap 'rm -rf "$TMP"' EXIT

log "banco → $PREFIX-db.sql.gz"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  | gzip -9 > "$TMP/$PREFIX-db.sql.gz"
gzip -t "$TMP/$PREFIX-db.sql.gz"
# Um dump sem tabelas indica banco vazio ou errado: melhor falhar do que guardar uma cópia inútil
grep -q 'CREATE TABLE public.usuario ' <(zcat "$TMP/$PREFIX-db.sql.gz") || fail "o dump não contém a tabela usuario"

log "fotos → $PREFIX-uploads.tar.gz"
docker compose exec -T backend tar czf - -C /app/uploads . > "$TMP/$PREFIX-uploads.tar.gz"
tar tzf "$TMP/$PREFIX-uploads.tar.gz" > /dev/null

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  command -v gpg >/dev/null || fail "BACKUP_PASSPHRASE definida, mas o gpg não está instalado"
  log "cifrando com AES-256"
  for file in "$TMP/$PREFIX-db.sql.gz" "$TMP/$PREFIX-uploads.tar.gz"; do
    printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 0 \
      --symmetric --cipher-algo AES256 --output "$file.gpg" "$file"
    rm -f "$file"
  done
fi

(cd "$TMP" && sha256sum "$PREFIX"-* > "$PREFIX.sha256")
mv "$TMP/$PREFIX"* "$DEST/"

if [ "$KEEP_DAYS" -gt 0 ] 2>/dev/null; then
  removed=$(find "$DEST" -maxdepth 1 -name 'fiscalize-*' -type f -mtime +"$KEEP_DAYS" -print -delete | wc -l)
  [ "$removed" -gt 0 ] && log "rotação: $removed arquivo(s) com mais de $KEEP_DAYS dias removido(s)"
fi

log "concluído: $DEST/$PREFIX.*"
ls -lh "$DEST/$PREFIX"*
