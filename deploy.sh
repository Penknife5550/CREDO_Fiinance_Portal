#!/bin/bash
# =============================================================================
# CREDO Finanzportal - Deployment-Script
# =============================================================================
# Verwendung:
#   ./deploy.sh              → DB-Backup + Bauen + Starten + Health-Check
#   ./deploy.sh backup       → nur DB-Backup (nach backups/)
#   ./deploy.sh logs         → Logs anzeigen
#   ./deploy.sh stop         → Container stoppen
#   ./deploy.sh restart      → Neustart ohne Neubauen (übernimmt KEINE geänderten Env-Werte)
#   ./deploy.sh health       → Health-Check
#
# Env-Datei: .env.production, sonst .env (Server finance.fes-credo.de nutzt .env).
# Docker braucht auf dem Server root: sudo ./deploy.sh
# =============================================================================

set -e
cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.prod.yml"
APP_CONTAINER="credo-finanz-app"
DB_CONTAINER="credo-finanz-db"
BACKUP_DIR="backups"

# Env-Datei bestimmen. Achtung: Ein direktes "docker compose" ohne --env-file liest nur .env.
if [ -f ".env.production" ]; then
  ENV_FILE=".env.production"
  if [ -f ".env" ]; then
    echo "HINWEIS: .env.production und .env vorhanden — verwendet wird .env.production."
    echo "         Direkte docker-compose-Aufrufe ohne --env-file lesen dagegen .env!"
  fi
elif [ -f ".env" ]; then
  ENV_FILE=".env"
else
  echo "FEHLER: Weder .env.production noch .env gefunden!"
  echo "Kopiere .env.example → .env.production und passe die Werte an."
  exit 1
fi

# Prüfe ob Platzhalter noch drin stehen (.env.example nutzt "change-me")
if grep -qE "HIER_|change-me" "$ENV_FILE"; then
  echo "WARNUNG: $ENV_FILE enthält noch Platzhalter (change-me / HIER_...)!"
  grep -nE "HIER_|change-me" "$ENV_FILE" | cut -d= -f1
  echo "Bitte alle Werte vor dem Deployment anpassen."
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# DB-Backup (pg_dump, Custom-Format) mit Lesbarkeitsprüfung. Ohne laufende DB (Erstinstallation)
# gibt es nichts zu sichern. Enthält personenbezogene Daten (IBAN) → nur für root lesbar.
backup_db() {
  if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    echo "  Keine laufende Datenbank ($DB_CONTAINER) — kein Backup nötig."
    return 0
  fi
  umask 077
  mkdir -p "$BACKUP_DIR"
  local datei
  datei="$BACKUP_DIR/finanzportal_$(date +%F_%H%M%S).dump"
  if ! docker exec "$DB_CONTAINER" pg_dump -U credo -Fc finanzportal > "$datei"; then
    echo "FEHLER: pg_dump fehlgeschlagen — Deployment abgebrochen."
    rm -f "$datei"
    exit 1
  fi
  local tabellen
  tabellen=$(docker exec -i "$DB_CONTAINER" pg_restore -l < "$datei" | grep -c "TABLE DATA" || true)
  if [ "$tabellen" -lt 1 ]; then
    echo "FEHLER: Backup $datei ist nicht lesbar — Deployment abgebrochen."
    exit 1
  fi
  echo "  ✓ Backup: $datei ($(du -h "$datei" | cut -f1), $tabellen Tabellen)"
}

case "${1:-deploy}" in
  deploy)
    echo ""
    echo "  CREDO Finanzportal — Deployment (Env-Datei: $ENV_FILE)"
    echo "  ────────────────────────────────"
    echo ""
    echo "  [1/4] Datenbank-Backup..."
    backup_db

    echo "  [2/4] Docker-Image bauen..."
    compose build

    echo "  [3/4] Container starten..."
    compose up -d

    echo "  [4/4] Warte auf Health-Check (max. 2 Minuten)..."
    status=""
    for _ in $(seq 1 24); do
      sleep 5
      status=$(docker inspect --format='{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || true)
      if [ "$status" = "healthy" ] || [ "$status" = "unhealthy" ]; then
        break
      fi
    done

    if [ "$status" = "healthy" ]; then
      echo ""
      echo "  ✓ Deployment erfolgreich!"
      echo "  → https://finance.fes-credo.de"
      echo ""
      echo "  Kontrolle: docker logs $APP_CONTAINER 2>&1 | grep -E 'Migrations|Retention'"
      echo ""
    else
      echo ""
      echo "  ✗ App nicht gesund (Status: ${status:-unbekannt}). Letzte Log-Zeilen:"
      docker logs --tail=30 "$APP_CONTAINER" 2>&1 || true
      echo ""
      echo "  Rückweg: DEPLOYMENT.md §11 (Backup liegt in $BACKUP_DIR/)"
      exit 1
    fi
    ;;

  backup)
    backup_db
    ;;

  logs)
    compose logs -f --tail=100
    ;;

  stop)
    echo "Container stoppen..."
    compose down
    echo "✓ Gestoppt"
    ;;

  restart)
    echo "Container neustarten..."
    compose restart
    echo "✓ Neugestartet"
    ;;

  health)
    echo ""
    echo "Container-Status:"
    compose ps
    echo ""
    echo "Health-Check:"
    docker inspect --format='{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo "Container nicht gefunden"
    echo ""
    ;;

  *)
    echo "Verwendung: $0 {deploy|backup|logs|stop|restart|health}"
    exit 1
    ;;
esac
