import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { kmSatzAlsString } from '../lib/kmSaetze.js';

interface ReisekostenPdfData {
  typ: 'REISEKOSTEN';
  belegNr: string;
  mandantName: string;
  mandantNr: number;
  kostenstelleNr: string;
  kostenstelleBezeichnung: string;
  vorname: string;
  nachname: string;
  personalNr: string;
  iban: string;
  kontoinhaber: string;
  reiseanlass: string;
  reiseziel: string;
  abfahrtOrt: string;
  abfahrtZeit: string;
  rueckkehrZeit: string;
  verkehrsmittel: string;
  kmGefahren: number;
  kmBetrag: number;
  vmaNetto: number;
  weitereKostenSumme: number;
  gesamtbetrag: number;
  reisetage: Array<{ datum: string; typ: string; vmaNetto: number; fruehstueckGestellt: boolean; mittagGestellt: boolean; abendGestellt: boolean }>;
  weitereKosten: Array<{ typ: string; beschreibung: string; betrag: number }>;
  unterschriftBild?: string;
}

interface ErstattungPdfData {
  typ: 'ERSTATTUNG';
  belegNr: string;
  mandantName: string;
  mandantNr: number;
  kostenstelleNr: string;
  kostenstelleBezeichnung: string;
  vorname: string;
  nachname: string;
  personalNr: string;
  iban: string;
  kontoinhaber: string;
  gesamtbetrag: number;
  positionen: Array<{ beschreibung: string; kategorie: string; datum: string; betrag: number }>;
  unterschriftBild?: string;
}

interface SammelfahrtPdfData {
  typ: 'SAMMELFAHRT';
  belegNr: string;
  mandantName: string;
  mandantNr: number;
  kostenstelleNr: string;
  kostenstelleBezeichnung: string;
  vorname: string;
  nachname: string;
  personalNr: string;
  iban: string;
  kontoinhaber: string;
  reiseanlass: string;
  verkehrsmittel: 'PKW' | 'MOTORRAD';
  kmSumme: number;
  gesamtbetrag: number;
  fahrten: Array<{ datum: string; startOrt: string; ziel: string; km: number; kmBetrag: number }>;
  unterschriftBild?: string;
}

type PdfData = ReisekostenPdfData | ErstattungPdfData | SammelfahrtPdfData;

// ── Seitenumbruch-Hilfsfunktion ──────────────────────────

interface PageContext {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  width: number;
  height: number;
  font: PDFFont;
  fontBold: PDFFont;
}

function checkPageBreak(ctx: PageContext): PageContext {
  if (ctx.y < 80) {
    const newPage = ctx.doc.addPage([595, 842]);
    ctx.page = newPage;
    ctx.y = ctx.height - 50;
  }
  return ctx;
}

// ── Hauptdokument + Belege → eine PDF ──────────────────

export async function erstelleGesamtPdf(
  data: PdfData,
  belegDateipfade: string[],
  outputPfad: string,
): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── Seite 1: Hauptdokument ─────────────────────────
  const firstPage = doc.addPage([595, 842]); // A4
  const { width, height } = firstPage.getSize();

  const ctx: PageContext = { doc, page: firstPage, y: height - 50, width, height, font, fontBold };

  const drawText = (text: string, x: number, size = 10, bold = false) => {
    checkPageBreak(ctx);
    ctx.page.drawText(text, { x, y: ctx.y, size, font: bold ? fontBold : font, color: rgb(0.1, 0.1, 0.1) });
  };

  const drawTextAt = (text: string, x: number, yPos: number, size = 10, bold = false) => {
    ctx.page.drawText(text, { x, y: yPos, size, font: bold ? fontBold : font, color: rgb(0.1, 0.1, 0.1) });
  };

  const drawLine = () => {
    checkPageBreak(ctx);
    ctx.page.drawLine({ start: { x: 50, y: ctx.y }, end: { x: width - 50, y: ctx.y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  };

  // ── Swiss QR Code generieren (wird oben rechts platziert) ──
  const qrDatum = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const qrPayload = [
    'SPC', '0200', '1', '', 'K',
    data.mandantName, '', '', '', '', 'CH',
    '', '', '', '', '', '',
    data.gesamtbetrag.toFixed(2), 'CHF',
    '', '', '', '', '', '',
    'NON', '',
    `MNR:${data.mandantNr}|BNR:${data.belegNr}|DAT:${qrDatum}|BET:${formatEur(data.gesamtbetrag)}`,
    'EPD',
  ].join('\n');

  let qrImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    const qrPng = await QRCode.toBuffer(qrPayload, {
      type: 'png', width: 260, margin: 0, errorCorrectionLevel: 'M',
    });
    qrImage = await doc.embedPng(qrPng);
  } catch (qrErr) {
    console.error('QR-Code konnte nicht erstellt werden:', qrErr);
  }

  // Header
  const titel =
    data.typ === 'REISEKOSTEN' ? 'REISEKOSTENABRECHNUNG'
    : data.typ === 'ERSTATTUNG' ? 'KOSTENERSTATTUNG'
    : 'FAHRTKOSTENSAMMELANTRAG';
  drawText('CREDO', 50, 14, true);
  drawTextAt(titel, width - 50 - fontBold.widthOfTextAtSize(titel, 14), ctx.y, 14, true);
  ctx.y -= 25;
  drawLine();
  ctx.y -= 20;

  // Meta-Daten (links) + QR-Code (rechts)
  const qrSize = 110;
  const qrX = width - 50 - qrSize;            // rechtsbündig am Rand
  const qrY = ctx.y - qrSize + 10;            // Oberkante auf Höhe der Meta-Daten
  const metaRightEdge = qrX - 15;             // Text endet vor dem QR-Code

  /** Zeichnet Text, kürzt ihn aber mit „…" falls er über maxX hinausragen würde */
  const drawTextClipped = (text: string, x: number, yPos: number, maxX: number, size = 10, bold = false) => {
    const f = bold ? fontBold : font;
    let display = text;
    while (f.widthOfTextAtSize(display, size) > maxX - x && display.length > 1) {
      display = display.slice(0, -2) + '…';
    }
    ctx.page.drawText(display, { x, y: yPos, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  };

  const textMaxX = qrX - 15; // Texte dürfen nicht in den QR-Code hineinragen

  drawText(`Beleg-Nr: ${data.belegNr}`, 50, 10, true);
  drawTextClipped(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 250, ctx.y, textMaxX);
  ctx.y -= 15;
  drawTextClipped(`Mandant: ${data.mandantName}`, 50, ctx.y, textMaxX);
  ctx.y -= 15;
  drawText(`Mandanten-Nr: ${data.mandantNr}`, 50);
  ctx.y -= 15;
  if (data.kostenstelleNr || data.kostenstelleBezeichnung) {
    drawTextClipped(`KST: ${data.kostenstelleNr} (${data.kostenstelleBezeichnung})`, 50, ctx.y, textMaxX);
    ctx.y -= 15;
  }
  drawTextClipped(`Mitarbeiter: ${data.vorname} ${data.nachname}`, 50, ctx.y, textMaxX);
  drawTextClipped(`PNr: ${data.personalNr}`, 250, ctx.y, textMaxX);
  ctx.y -= 15;
  drawText(`Betrag: ${formatEur(data.gesamtbetrag)}`, 50, 10, true);

  // QR-Code rechts neben die Meta-Daten zeichnen
  if (qrImage) {
    // Leichter Rahmen um den QR-Code
    ctx.page.drawRectangle({
      x: qrX - 5, y: qrY - 5,
      width: qrSize + 10, height: qrSize + 10,
      borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5,
      color: rgb(1, 1, 1),
    });
    ctx.page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    // Kleine Beschriftung unter dem QR-Code
    drawTextAt('Swiss QR Code', qrX + qrSize / 2 - fontBold.widthOfTextAtSize('Swiss QR Code', 7) / 2, qrY - 12, 7, true);
  }

  // y-Position auf das Ende des QR-Blocks setzen (falls QR tiefer reicht als Meta-Text)
  ctx.y = Math.min(ctx.y, qrY - 18) - 10;
  drawLine();
  ctx.y -= 20;

  if (data.typ === 'REISEKOSTEN') {
    // Reisedaten
    checkPageBreak(ctx);
    drawText('REISEDATEN', 50, 11, true);
    ctx.y -= 18;
    drawText(`Anlass: ${data.reiseanlass}`, 50);
    ctx.y -= 15;
    drawText(`Ziel: ${data.reiseziel}`, 50);
    ctx.y -= 15;
    drawText(`Abfahrt: ${formatDatumZeit(data.abfahrtZeit)} (${data.abfahrtOrt === 'WOHNUNG' ? 'Wohnung' : 'Erste Tätigkeitsstätte'})`, 50);
    ctx.y -= 15;
    drawText(`Rückkehr: ${formatDatumZeit(data.rueckkehrZeit)}`, 50);
    ctx.y -= 25;
    drawLine();
    ctx.y -= 20;

    // Fahrkosten
    if (data.kmBetrag > 0) {
      checkPageBreak(ctx);
      drawText('FAHRKOSTEN', 50, 11, true);
      ctx.y -= 18;
      drawText(`Verkehrsmittel: ${data.verkehrsmittel}`, 50);
      ctx.y -= 15;
      drawText(`${data.kmGefahren} km × ${kmSatzAlsString(data.verkehrsmittel)} EUR = ${formatEur(data.kmBetrag)}`, 50);
      ctx.y -= 25;
      drawLine();
      ctx.y -= 20;
    }

    // VMA
    if (data.vmaNetto > 0) {
      checkPageBreak(ctx);
      drawText('VERPFLEGUNGSMEHRAUFWAND', 50, 11, true);
      ctx.y -= 18;
      for (const tag of data.reisetage) {
        if (tag.vmaNetto > 0) {
          checkPageBreak(ctx);
          drawText(`${tag.datum}  ${tag.typ}`, 50);
          drawTextAt(formatEur(tag.vmaNetto), 450, ctx.y);
          ctx.y -= 14;
        }
      }
      drawText(`Gesamt VMA: ${formatEur(data.vmaNetto)}`, 50, 10, true);
      ctx.y -= 25;
      drawLine();
      ctx.y -= 20;
    }

    // Weitere Kosten
    if (data.weitereKostenSumme > 0) {
      checkPageBreak(ctx);
      drawText('WEITERE KOSTEN', 50, 11, true);
      ctx.y -= 18;
      for (const k of data.weitereKosten) {
        checkPageBreak(ctx);
        drawText(`${k.typ}: ${k.beschreibung}`, 50);
        drawTextAt(formatEur(k.betrag), 450, ctx.y);
        ctx.y -= 14;
      }
      ctx.y -= 10;
      drawLine();
      ctx.y -= 20;
    }
  } else if (data.typ === 'ERSTATTUNG') {
    // Erstattung: Positionen
    checkPageBreak(ctx);
    drawText('POSITIONEN', 50, 11, true);
    ctx.y -= 18;
    for (const pos of data.positionen) {
      checkPageBreak(ctx);
      drawText(`${pos.beschreibung}`, 50);
      drawTextAt(pos.datum, 350, ctx.y);
      drawTextAt(formatEur(pos.betrag), 450, ctx.y);
      ctx.y -= 14;
    }
    ctx.y -= 10;
    drawLine();
    ctx.y -= 20;
  } else if (data.typ === 'SAMMELFAHRT') {
    // Sammelfahrt: Anlass + Verkehrsmittel + Einzelfahrten
    checkPageBreak(ctx);
    drawText('ANLASS', 50, 11, true);
    ctx.y -= 18;
    drawText(data.reiseanlass, 50);
    ctx.y -= 25;
    drawLine();
    ctx.y -= 20;

    checkPageBreak(ctx);
    drawText('FAHRTEN', 50, 11, true);
    ctx.y -= 18;
    drawText(`Verkehrsmittel: ${data.verkehrsmittel}  ·  Pauschale ${kmSatzAlsString(data.verkehrsmittel)} EUR/km`, 50);
    ctx.y -= 18;

    // Tabellenkopf
    checkPageBreak(ctx);
    drawText('Datum', 50, 9, true);
    drawTextAt('Von', 110, ctx.y, 9, true);
    drawTextAt('Nach', 270, ctx.y, 9, true);
    drawTextAt('km', 420, ctx.y, 9, true);
    drawTextAt('Betrag', 470, ctx.y, 9, true);
    ctx.y -= 12;
    drawLine();
    ctx.y -= 12;

    for (const f of data.fahrten) {
      checkPageBreak(ctx);
      drawText(formatDatumKurz(f.datum), 50, 9);
      drawTextAt(kuerzeText(f.startOrt, 28), 110, ctx.y, 9);
      drawTextAt(kuerzeText(f.ziel, 28), 270, ctx.y, 9);
      drawTextAt(f.km.toFixed(2).replace('.', ','), 420, ctx.y, 9);
      drawTextAt(formatEur(f.kmBetrag), 470, ctx.y, 9);
      ctx.y -= 13;
    }

    ctx.y -= 6;
    drawLine();
    ctx.y -= 14;
    drawText(`Gesamt: ${data.kmSumme.toFixed(2).replace('.', ',')} km`, 50, 10, true);
    drawTextAt(formatEur(data.gesamtbetrag), 470, ctx.y, 10, true);
    ctx.y -= 22;
    drawLine();
    ctx.y -= 20;
  }

  // Gesamtbetrag
  checkPageBreak(ctx);
  ctx.page.drawRectangle({ x: 48, y: ctx.y - 5, width: width - 96, height: 30, color: rgb(0.95, 0.95, 0.95) });
  drawText('GESAMTBETRAG:', 55, 12, true);
  drawTextAt(formatEur(data.gesamtbetrag), 440, ctx.y, 12, true);
  ctx.y -= 35;

  // Bankverbindung
  checkPageBreak(ctx);
  drawText('BANKVERBINDUNG', 50, 11, true);
  ctx.y -= 18;
  drawText(`Kontoinhaber: ${data.kontoinhaber}`, 50);
  ctx.y -= 15;
  drawText(`IBAN: ${formatIbanDisplay(data.iban)}`, 50);
  ctx.y -= 25;
  drawLine();
  ctx.y -= 20;

  // Unterschrift
  if (data.unterschriftBild) {
    checkPageBreak(ctx);
    drawText('DIGITALE UNTERSCHRIFT', 50, 11, true);
    ctx.y -= 18;
    try {
      const sigData = data.unterschriftBild.replace(/^data:image\/\w+;base64,/, '');
      const sigBytes = Buffer.from(sigData, 'base64');
      const sigImage = await doc.embedPng(sigBytes);
      const sigDims = sigImage.scale(0.3);
      checkPageBreak(ctx);
      ctx.page.drawImage(sigImage, { x: 50, y: ctx.y - sigDims.height, width: sigDims.width, height: sigDims.height });
      ctx.y -= sigDims.height + 5;
    } catch {
      drawText('(Unterschrift konnte nicht eingebettet werden)', 50);
      ctx.y -= 15;
    }
    checkPageBreak(ctx);
    drawText(`${data.vorname} ${data.nachname}, ${new Date().toLocaleString('de-DE')}`, 50);
    ctx.y -= 25;
  }

  // M-Kennzeichen (Lohnsteuer-Hinweis) — nur bei Reisekosten mit gestellten Mahlzeiten
  if (data.typ === 'REISEKOSTEN') {
    const tageMitMahlzeit = data.reisetage.filter(
      t => t.fruehstueckGestellt || t.mittagGestellt || t.abendGestellt
    );

    if (tageMitMahlzeit.length > 0) {
      checkPageBreak(ctx);
      ctx.y -= 10;
      drawLine();
      ctx.y -= 15;
      drawText('LOHNSTEUER-HINWEIS', 50, 11, true);
      ctx.y -= 18;
      drawText('Kennzeichen "M": Bei dieser Dienstreise wurde(n)', 50);
      ctx.y -= 14;
      drawText('Mahlzeit(en) gestellt. Bitte Großbuchstabe "M" im', 50);
      ctx.y -= 14;
      drawText('Lohnkonto und der Lohnsteuerbescheinigung eintragen', 50);
      ctx.y -= 14;
      drawText('(§ 8 Abs. 2 Satz 8 EStG).', 50);
      ctx.y -= 20;
      drawText('Betroffene Tage:', 50, 10, true);
      ctx.y -= 16;

      for (const tag of tageMitMahlzeit) {
        checkPageBreak(ctx);
        const mahlzeiten: string[] = [];
        if (tag.fruehstueckGestellt) mahlzeiten.push('Frühstück gestellt');
        if (tag.mittagGestellt) mahlzeiten.push('Mittag gestellt');
        if (tag.abendGestellt) mahlzeiten.push('Abend gestellt');
        drawText(`- ${formatDatumKurz(tag.datum)}: ${mahlzeiten.join(', ')}`, 60);
        ctx.y -= 14;
      }
      ctx.y -= 10;
    }
  }

  // Footer
  checkPageBreak(ctx);
  drawLine();
  ctx.y -= 15;
  drawText(`Erstellt am ${new Date().toLocaleString('de-DE')} | ${data.belegNr}`, 50, 8);
  ctx.y -= 12;
  drawText('Dieses Dokument wurde digital erstellt.', 50, 8);

  // ── Belege als Folgeseiten einbetten ─────────────────

  for (let i = 0; i < belegDateipfade.length; i++) {
    const pfad = belegDateipfade[i];
    const ext = path.extname(pfad).toLowerCase();

    try {
      if (ext === '.pdf') {
        // PDF-Belege: Seiten direkt kopieren
        const belegBytes = await fs.promises.readFile(pfad);
        const belegDoc = await PDFDocument.load(belegBytes);
        const pages = await doc.copyPages(belegDoc, belegDoc.getPageIndices());
        for (const p of pages) {
          doc.addPage(p);
        }
      } else {
        // Bilder: Auf A4-Seite skalieren
        let imageBytes: Buffer;

        if (ext === '.heic') {
          // HEIC → PNG konvertieren
          imageBytes = await sharp(pfad).png().toBuffer();
        } else {
          // JPG/PNG: Optimieren auf max 2000px
          imageBytes = await sharp(pfad)
            .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        }

        const imagePage = doc.addPage([595, 842]);

        // Anlage-Header
        imagePage.drawText(`Anlage ${i + 1}: ${path.basename(pfad)}`, {
          x: 50, y: 820, size: 9, font, color: rgb(0.4, 0.4, 0.4),
        });

        // Bild einbetten
        let image;
        if (ext === '.png' || ext === '.heic') {
          image = await doc.embedPng(imageBytes);
        } else {
          image = await doc.embedJpg(imageBytes);
        }

        const maxW = 495; // A4 - 2x50 Rand
        const maxH = 740; // A4 - Header - Footer
        const scale = Math.min(maxW / image.width, maxH / image.height, 1);
        const w = image.width * scale;
        const h = image.height * scale;

        imagePage.drawImage(image, {
          x: 50 + (maxW - w) / 2,
          y: 50 + (maxH - h) / 2,
          width: w,
          height: h,
        });
      }
    } catch (err) {
      // Bei Fehler: Platzhalter-Seite
      const errorPage = doc.addPage([595, 842]);
      errorPage.drawText(`Anlage ${i + 1}: ${path.basename(pfad)}`, {
        x: 50, y: 800, size: 10, font: fontBold, color: rgb(0.8, 0.2, 0.2),
      });
      errorPage.drawText('Beleg konnte nicht eingebettet werden.', {
        x: 50, y: 780, size: 10, font, color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  // ── PDF speichern ────────────────────────────────────

  const pdfBytes = await doc.save();
  const dir = path.dirname(outputPfad);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(outputPfad, pdfBytes);
}

// ── Hilfsfunktionen ────────────────────────────────────

function formatEur(betrag: number): string {
  return `${betrag.toFixed(2).replace('.', ',')} EUR`;
}

function formatDatumZeit(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatIbanDisplay(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

function formatDatumKurz(datum: string): string {
  const d = new Date(datum);
  const tage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${tage[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
}

function kuerzeText(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + '…';
}
