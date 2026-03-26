#!/bin/bash
# =============================================================================
# CREDO Finanzportal - Deployment-Script
# =============================================================================
# Verwendung:
#   ./deploy.sh              → Bauen + Starten
#   ./deploy.sh logs         → Logs anzeigen
#   ./deploy.sh stop         → Container stoppen
#   ./deploy.sh restart      → Neustart ohne Neubauen
#   ./deploy.sh health       → Health-Check
# =============================================================================

set -e

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
APP_CONTAINER="credo-finanz-app"

# Prüfe ob .env.production existiert
if [ ! -f "$ENV_FILE" ]; then
  echo "FEHLER: $ENV_FILE nicht gefunden!"
  echo "Kopiere .env.example → .env.production und passe die Werte an."
  exit 1
fi

# Prüfe ob Platzhalter noch drin stehen
if grep -q "HIER_" "$ENV_FILE"; then
  echo "WARNUNG: $ENV_FILE enthält noch Platzhalter (HIER_...)!"
  echo "Bitte alle Werte vor dem Deployment anpassen."
  exit 1
fi

case "${1:-deploy}" in
  deploy)
    echo ""
    echo "  CREDO Finanzportal — Deployment"
    echo "  ────────────────────────────────"
    echo ""
    echo "  [1/3] Docker-Image bauen..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

    echo "  [2/3] Container starten..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

    echo "  [3/3] Warte auf Health-Check..."
    sleep 5

    if docker inspect --format='{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null | grep -q "healthy"; then
      echo ""
      echo "  ✓ Deployment erfolgreich!"
      echo "  → https://finanzen.fes-credo.de"
      echo ""
    else
      echo ""
      echo "  ⏳ Container startet noch... Prüfe mit: ./deploy.sh health"
      echo ""
    fi
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=100
    ;;

  stop)
    echo "Container stoppen..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    echo "✓ Gestoppt"
    ;;

  restart)
    echo "Container neustarten..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
    echo "✓ Neugestartet"
    ;;

  health)
    echo ""
    echo "Container-Status:"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""
    echo "Health-Check:"
    docker inspect --format='{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo "Container nicht gefunden"
    echo ""
    ;;

  *)
    echo "Verwendung: $0 {deploy|logs|stop|restart|health}"
    exit 1
    ;;
esac
