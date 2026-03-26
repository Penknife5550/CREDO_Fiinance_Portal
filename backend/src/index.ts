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
import { pauschalenRouter } from './routes/pauschalen.js';
import { adminLogin, adminLogout, adminCheck, requireAdmin } from './middleware/adminAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Rate Limiting ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5,
  message: { error: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Zu viele Uploads. Bitte versuchen Sie es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Zu viele Anfragen. Bitte versuchen Sie es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Middleware ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/einreichungen', einreichungenRouter);
app.use('/api/pauschalen', pauschalenRouter);

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
