import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileTypeFromFile } from 'file-type';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');

// HEIC/HEIF (iPhone-Fotos) sind erlaubt: der Extension-Filter (fileFilter) laesst sie
// durch und der PDF-Renderer bettet sie via sharp ein — ohne die MIME-Typen hier wuerden
// sie vom Magic-Bytes-Check faelschlich geloescht (Bug bis 15.7). file-type meldet je nach
// ftyp-Brand 'image/heic' oder 'image/heif'.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'image/heic', 'image/heif'];

// Sicherstellen, dass Upload-Verzeichnis existiert
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const subdir = path.join(UPLOAD_DIR, new Date().toISOString().slice(0, 7)); // z.B. 2026-03
    if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });
    cb(null, subdir);
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.heic', '.heif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Dateityp ${ext} nicht erlaubt. Erlaubt: PDF, JPG, PNG, HEIC`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * Prüft den tatsächlichen MIME-Type einer Datei via Magic Bytes.
 * Löscht die Datei und wirft einen Fehler bei ungültigem Typ.
 */
export async function validateMimeType(dateipfad: string): Promise<void> {
  const result = await fileTypeFromFile(dateipfad);
  const mimeType = result?.mime;

  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    // Datei löschen
    await fs.promises.unlink(dateipfad);
    throw new Error(
      `Ungültiger Dateityp${mimeType ? ` (${mimeType})` : ''}. Erlaubt: JPEG, PNG, PDF, HEIC`
    );
  }
}

export async function berechneHash(dateipfad: string): Promise<string> {
  const buffer = await fs.promises.readFile(dateipfad);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
