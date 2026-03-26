import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

// Einfacher Token-basierter Auth (kein JWT nötig für internes Tool)
const activeSessions = new Map<string, { email: string; expiresAt: Date }>();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Login ──────────────────────────────────────────────

export async function adminLogin(req: Request, res: Response) {
  const { email, passwort } = req.body;

  if (!email || !passwort) {
    res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    return;
  }

  const [admin] = await db
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.email, email));

  if (!admin || !(await verifyPassword(passwort, admin.passwortHash))) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }

  const token = generateToken();
  activeSessions.set(token, {
    email: admin.email,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });

  res.json({ token, name: admin.name, email: admin.email });
}

// ── Logout ─────────────────────────────────────────────

export function adminLogout(req: Request, res: Response) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) activeSessions.delete(token);
  res.json({ success: true });
}

// ── Session prüfen ─────────────────────────────────────

export function adminCheck(req: Request, res: Response) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Nicht angemeldet' });
    return;
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < new Date()) {
    activeSessions.delete(token || '');
    res.status(401).json({ error: 'Sitzung abgelaufen' });
    return;
  }

  res.json({ email: session.email });
}

// ── Middleware ──────────────────────────────────────────

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Anmeldung erforderlich' });
    return;
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < new Date()) {
    activeSessions.delete(token);
    res.status(401).json({ error: 'Sitzung abgelaufen' });
    return;
  }

  next();
}
