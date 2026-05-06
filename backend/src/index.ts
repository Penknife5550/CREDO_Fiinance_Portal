import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { mandantenRouter } from './routes/mandanten.js';
import { kostenstellenRouter } from './routes/kostenstellen.js';
import { einreichungenRouter } from './routes/einreichungen.js';
import { adminRouter } from './routes/admin.js';
import { adminLogin, adminLogout, adminCheck, requireAdmin } from './middleware/adminAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── Rate Limiting ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 20,
  message: { error: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Zu viele Uploads. Bitte versuchen Sie es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Schutz gegen Massen-Einreichungen pro IP (Spam an DMS-Mailadressen)
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 10,
  message: { error: 'Zu viele Einreichungen. Bitte versuchen Sie es in einer Stunde erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Zu viele Anfragen. Bitte versuchen Sie es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Admin-Routen sind bereits durch requireAdmin geschützt — nicht durch globales Limit drosseln
  skip: (req) => req.path.startsWith('/api/admin') || req.path.startsWith('/admin'),
});

// ── Middleware ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  // HSTS wird in Production von Caddy gesetzt (HTTPS-Terminierung). Express
  // selbst sollte HSTS nicht senden — sonst pinnt Safari den Header auch für
  // lokale http://localhost-Aufrufe und bricht den Dev-Loop.
  hsts: false,
}));
// CORS: in Production Caddy/Nginx terminieren — Same-Origin. In Dev kommt das
// Frontend von Vite (5173), Backend von 3000 → erlaubte Origins explizit setzen.
const allowedOrigins = (process.env.APP_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: false,
}));
// 2 MB reicht für Submit (Unterschriftsbild + Metadaten); Belege laufen ueber den
// /belege-Upload-Endpoint mit eigenem multer-Limit.
app.use(express.json({ limit: '2mb' }));

// ── Allgemeines Rate Limiting für API ─────────────────────
app.use('/api/', apiLimiter);

// ── Health Check ───────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CREDO Finanzportal', timestamp: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────────────
// Self-Service (kein Login)
app.use('/api/mandanten', mandantenRouter);
app.use('/api/kostenstellen', kostenstellenRouter);
app.post('/api/einreichungen/belege', uploadLimiter);
// Eigentlicher Submit (Reisekosten + Erstattungen) zusätzlich gedrosselt
app.post('/api/einreichungen', submitLimiter);
app.use('/api/einreichungen', einreichungenRouter);

// AdminCenter Auth (Login/Logout — ohne Middleware)
app.post('/api/admin/login', loginLimiter, adminLogin);
app.post('/api/admin/logout', adminLogout);
app.get('/api/admin/check', adminCheck);

// AdminCenter (passwortgeschützt)
app.use('/api/admin', requireAdmin, adminRouter);

// ── Statische Dateien (Frontend) ───────────────────────
// In Production: Frontend-Build aus /app/public servieren
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA Fallback: Alle nicht-API-Routen → index.html
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Start ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  CREDO Finanzportal`);
  console.log(`  ─────────────────`);
  console.log(`  App:    http://localhost:${PORT}`);
  console.log(`  API:    http://localhost:${PORT}/api`);
  console.log(`  Health: http://localhost:${PORT}/api/health\n`);
});

export default app;
