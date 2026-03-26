# =============================================================================
# CREDO Finanzportal - Unified Dockerfile
# Frontend (React) wird gebaut und vom Backend (Express) ausgeliefert
# Gleiche Struktur wie HR-Portal
# =============================================================================

# ── Stage 1: Dependencies installieren (Workspaces) ─────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

# ── Stage 2: Frontend bauen ──────────────────────────────
FROM deps AS frontend-builder
WORKDIR /app
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# ── Stage 3: Backend bauen ───────────────────────────────
FROM deps AS backend-builder
WORKDIR /app
COPY backend/ ./backend/
RUN npm run build --workspace=backend

# ── Stage 4: Production Image ───────────────────────────
FROM node:22-alpine
WORKDIR /app

# Backend Dependencies (nur Production)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev --workspace=backend && npm cache clean --force

# Backend Build
COPY --from=backend-builder /app/backend/dist ./dist

# Datenbank-Migrationen (SQL-Dateien für Drizzle)
COPY backend/src/db/migrations ./src/db/migrations

# Frontend Build → wird vom Backend als statische Dateien ausgeliefert
COPY --from=frontend-builder /app/frontend/dist ./public

# Entrypoint (Migration + Seed + Start)
COPY docker-entrypoint.sh ./

# Uploads-Verzeichnis
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["sh", "docker-entrypoint.sh"]
