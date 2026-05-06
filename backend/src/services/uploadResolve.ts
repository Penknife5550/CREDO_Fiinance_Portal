import path from 'path';
import fs from 'fs';

/**
 * Resolve Beleg-Datei-IDs zu absoluten Pfaden im Upload-Verzeichnis und
 * verhindere Path-Traversal-Angriffe.
 *
 * Schutzschichten:
 *  1. `path.basename(id)` strippt jeden Pfadbestandteil aus der Datei-ID.
 *  2. Der resolved Path muss innerhalb von `uploadDir` liegen
 *     (`startsWith(resolvedUploadDir)`).
 *  3. Datei muss tatsaechlich existieren — sonst throw.
 */
export async function resolveAndValidateBelegPfade(
  dateiIds: string[],
  uploadDir: string,
): Promise<string[]> {
  const resolvedUploadDir = path.resolve(uploadDir);
  const entries = await fs.promises.readdir(resolvedUploadDir, { withFileTypes: true });
  const subdirs = entries.filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name));

  return Promise.all(dateiIds.map(async id => {
    // Nur den Dateinamen akzeptieren (keine Pfadbestandteile)
    const basename = path.basename(id);

    for (const subdir of subdirs) {
      const candidate = path.resolve(resolvedUploadDir, subdir.name, basename);
      if (candidate.startsWith(resolvedUploadDir)) {
        try {
          await fs.promises.access(candidate);
          return candidate;
        } catch { /* nicht in diesem Subdir */ }
      }
    }

    // Fallback: direkt im UPLOAD_DIR
    const directPath = path.resolve(resolvedUploadDir, basename);
    if (!directPath.startsWith(resolvedUploadDir)) {
      throw new Error('Ungültiger Dateipfad: Path Traversal erkannt');
    }
    try {
      await fs.promises.access(directPath);
    } catch {
      throw new Error(`Datei nicht gefunden: ${basename}`);
    }
    return directPath;
  }));
}
