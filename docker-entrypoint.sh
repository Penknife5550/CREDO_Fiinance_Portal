#!/bin/sh
set -e

echo ""
echo "  CREDO Finanzportal — Container-Start"
echo "  ─────────────────────────────────────"

# ── Datenbank-Migrationen ──────────────────────────────
echo "  [1/3] Datenbank-Migrationen..."
node dist/db/migrate.js
echo "  ✓ Migrationen abgeschlossen"

# ── Seed-Daten (idempotent — nur wenn leer) ────────────
echo "  [2/3] Seed-Daten prüfen..."
node dist/db/seed.js
echo "  ✓ Seed-Daten geprüft"

# ── App starten ────────────────────────────────────────
echo "  [3/3] App starten..."
echo ""
exec node dist/index.js
