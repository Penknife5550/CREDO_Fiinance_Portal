import { useState } from 'react';
import type { ReisetagEingabe } from '@/lib/types';
import type { AuslandsPauschale } from '@/lib/hooks';
import { formatReisetagTyp, formatDatumKurz } from '@/lib/vma';
import {
  fragtOrt24Uhr, laenderZumDatum, landBezeichnung, satzLandKey, setzeOrt24MitFolgetagen, LAND_ANDERES, LAND_INLAND, LAND_SEETAG,
  type VmaVorschau, type VmaVorschauTag,
} from '@/lib/reisetage';
import { formatCurrency } from '@/lib/utils';
import { LandAuswahl } from './LandAuswahl';

type Mahlzeit = 'fruehstueckGestellt' | 'mittagGestellt' | 'abendGestellt';

// Schrittmeldung (z. B. fehlender Staat) — der Freitext verweist per aria-describedby darauf.
const MELDUNG_ID = 'verpflegung-meldung';

interface Props {
  /** Eingaben je Reisetag (Mahlzeiten, Landangaben). */
  reisetage: ReisetagEingabe[];
  onChange: (tage: ReisetagEingabe[]) => void;
  /** Vorschau aus denselben reinen Funktionen wie der Server: Land, Satz und Beträge je Tag. */
  vorschau: VmaVorschau;
  /** Hauptreiseland (Land-Key) — null = Inlandsreise. */
  hauptland: string | null;
  /** Alle Satzstände (GET /api/pauschalen/ausland) — die Auswahl je Tag zeigt jedes Land einmal, mit Stand zum Datum des Tags. */
  staende: AuslandsPauschale[];
  /** Abfahrt (datetime-local) — für den Hinweis bei Abfahrt ab 18 Uhr. */
  abfahrtZeit: string;
  /** Meldung aus der Schritt-Validierung. */
  fehler?: string;
}

export function VerpflegungStep({ reisetage, onChange, vorschau, hauptland, staende, abfahrtZeit, fehler }: Props) {
  // Master-Toggle: hat irgendwer eine Mahlzeit gestellt?
  // Initial: aus den Daten ableiten — wenn ein Tag bereits Mahlzeit-Flags hat, ist es "Ja".
  const initialGestellt = reisetage.some(
    t => t.fruehstueckGestellt || t.mittagGestellt || t.abendGestellt,
  );
  const [verpflegungGestellt, setVerpflegungGestellt] = useState<boolean>(initialGestellt);

  // Wechsel auf "Nein": alle Mahlzeiten-Flags zuruecksetzen (Beträge rechnet die Vorschau neu).
  const setzeVerpflegungGestellt = (gestellt: boolean) => {
    setVerpflegungGestellt(gestellt);
    if (!gestellt && reisetage.some(t => t.fruehstueckGestellt || t.mittagGestellt || t.abendGestellt)) {
      onChange(reisetage.map(t => ({ ...t, fruehstueckGestellt: false, mittagGestellt: false, abendGestellt: false })));
    }
  };

  if (reisetage.length === 0) {
    return (
      <div className="text-center py-8 text-credo-500">
        <p>Bitte geben Sie zuerst die Reisedaten ein (Abfahrt und Rückkehr),</p>
        <p>um die Verpflegungspauschalen berechnen zu können.</p>
      </div>
    );
  }

  // Eintaegige Reise bis einschl. 8 h: kein Anspruch — kompakter Hinweis, keine Eingabe
  const hatEintaegigOhneVma = reisetage.length === 1 && reisetage[0].typ === 'EINTAEGIG' && !reisetage[0].eintaegigUeber8h;
  if (hatEintaegigOhneVma) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-900 font-medium mb-1">Kein Verpflegungsmehraufwand</p>
          <p className="text-sm text-amber-800">
            Bei einer Abwesenheit von nicht mehr als 8 Stunden besteht kein Anspruch auf
            Verpflegungspauschale (§ 9 Abs. 4a EStG).
          </p>
        </div>
        {/* Landangaben sendet das Formular für diesen Tag nicht (ReisekostenFormular, tageFuerRechnung);
            lehnt die Vorschau trotzdem ab, blockiert „Weiter“ — den Grund dann hier nennen. */}
        {vorschau.fehler && (
          <div id={MELDUNG_ID} role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{vorschau.fehler}</div>
        )}
      </div>
    );
  }

  const istAusland = hauptland !== null;
  // Vorschau je Tag (gleiche Reihenfolge); fehlt sie (z. B. Länderliste nicht geladen), zeigen wir „—“.
  const vorschauTag = (index: number): VmaVorschauTag | undefined => vorschau.tage[index];
  const betrag = (index: number) => {
    const v = vorschauTag(index);
    return v ? formatCurrency(v.vmaNetto) : '—';
  };
  const kuerzung = (index: number) => {
    const k = vorschauTag(index)?.vmaKuerzung ?? 0;
    return k > 0 ? <div className="text-xs text-red-500">- {formatCurrency(k)}</div> : null;
  };

  const aendereTag = (index: number, aenderung: (tag: ReisetagEingabe) => ReisetagEingabe) => {
    onChange(reisetage.map((tag, i) => (i === index ? aenderung(tag) : tag)));
  };

  const handleMahlzeitToggle = (index: number, field: Mahlzeit) => {
    aendereTag(index, tag => ({ ...tag, [field]: !tag[field] }));
  };

  const gesamt = vorschau.tage.length > 0
    ? formatCurrency(vorschau.tage.reduce((sum, t) => sum + t.vmaNetto, 0))
    : '—';
  // Meldung, mit der auch der Server ablehnen würde: nach „Weiter“ immer, sonst nur ohne Beträge.
  const meldung = vorschau.fehler && (fehler || vorschau.tage.length === 0) ? vorschau.fehler : null;

  // Landangabe eines Tags ändern. Die 24-Uhr-Angabe gibt „Staat nicht in der Liste“ samt Staat an
  // die folgenden Zwischentage weiter (setzeOrt24MitFolgetagen) — sonst je Tag neu wählen und tippen.
  const aendereLand = (index: number, feld: 'land24uhr' | 'letzterTaetigkeitsort', neu: ReisetagEingabe) => {
    onChange(feld === 'land24uhr'
      ? setzeOrt24MitFolgetagen(reisetage, index, neu)
      : reisetage.map((tag, i) => (i === index ? neu : tag)));
  };

  // Landangabe ändern: Folgefrage nur bei „Inland um 24 Uhr“, Freitext nur bei „Staat nicht in der Liste“.
  const setzeLand = (index: number, feld: 'land24uhr' | 'letzterTaetigkeitsort', wert: string) => {
    const neu = { ...reisetage[index], [feld]: wert };
    if (fragtOrt24Uhr(neu.typ) && neu.land24uhr !== LAND_INLAND) neu.letzterTaetigkeitsort = null;
    if (neu.land24uhr !== LAND_ANDERES && neu.letzterTaetigkeitsort !== LAND_ANDERES) neu.landFreitext = null;
    aendereLand(index, feld, neu);
  };

  // Freitext ändern — eine nur vorbelegte Angabe (z. B. Abreisetag wie Vortag) wird dabei festgeschrieben.
  const setzeFreitext = (index: number, feld: 'land24uhr' | 'letzterTaetigkeitsort', text: string) => {
    aendereLand(index, feld, { ...reisetage[index], [feld]: LAND_ANDERES, landFreitext: text });
  };

  // Landfelder je Tag. Ohne Angabe gilt, was auch der Server annimmt (Hauptland, am Abreisetag
  // das Land des Vortags) — genau damit ist die Auswahl vorbelegt.
  const landFelder = (tag: ReisetagEingabe, index: number) => {
    const v = vorschauTag(index);
    // Länder mit Stand zum Datum dieses Tags (Jahreswechsel: Stand des jeweiligen Jahres)
    const laender = laenderZumDatum(staende, tag.datum);
    const freitextWert = tag.landFreitext ?? v?.land.landFreitext ?? '';
    const freitextFehler = !!fehler && !freitextWert.trim();
    const freitextProps = (feld: 'land24uhr' | 'letzterTaetigkeitsort') => ({
      mitAnderes: true,
      freitext: freitextWert,
      onFreitextChange: (text: string) => setzeFreitext(index, feld, text),
      freitextFehler,
      freitextFehlerId: MELDUNG_ID,
    });

    if (fragtOrt24Uhr(tag.typ)) {
      const ort24 = tag.land24uhr || hauptland || LAND_INLAND;
      const abendsAbfahrt = tag.typ === 'ANREISE' && Number(abfahrtZeit.slice(11, 13)) >= 18;
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <LandAuswahl
            id={`land24-${tag.datum}`}
            label="Wo waren Sie um 24 Uhr?"
            value={ort24}
            onChange={wert => setzeLand(index, 'land24uhr', wert)}
            laender={laender}
            mitInland
            mitSeetag={tag.typ === 'GANZTAG'}
            {...freitextProps('land24uhr')}
            hinweis={abendsAbfahrt && (
              <p className="text-xs text-amber-700 mt-1">Um 24 Uhr noch in Deutschland? Dann „Inland“ wählen.</p>
            )}
          />
          {ort24 === LAND_INLAND && (
            <LandAuswahl
              id={`taetigkeit-${tag.datum}`}
              label="Letzter Tätigkeitsort im Ausland an diesem Tag"
              value={tag.letzterTaetigkeitsort || LAND_INLAND}
              onChange={wert => setzeLand(index, 'letzterTaetigkeitsort', wert)}
              laender={laender}
              mitInland
              inlandText="Keine Tätigkeit im Ausland"
              {...freitextProps('letzterTaetigkeitsort')}
              hinweis={
                <p className="text-xs text-credo-500 mt-1">
                  Waren Sie an diesem Tag im Ausland beruflich tätig, gilt dieses Land – auch wenn danach
                  noch ein Termin in Deutschland folgte.
                </p>
              }
            />
          )}
        </div>
      );
    }

    // Abreisetag und eintägige Reise: letzter Tätigkeitsort im Ausland (§ 9 Abs. 4a S. 5 EStG).
    const istAbreise = tag.typ === 'ABREISE';
    // Abreisetag: Hinweise nur bei Bedarf — „bitte prüfen“, wenn die Vorbelegung (Land des Vortags)
    // vom Reiseland abweicht; der Hafen-Hinweis nach einem Seetag (vorbelegt ist dann das Reiseland).
    const vorbelegtAbweichend = istAbreise && !tag.letzterTaetigkeitsort && !!v && v.land.landKey !== hauptland;
    const nachSeetag = istAbreise && reisetage[index - 1]?.land24uhr === LAND_SEETAG;
    const hinweisText = istAbreise
      ? [
          vorbelegtAbweichend && 'Vorbelegt mit dem Land vom Vortag – bitte prüfen.',
          nachSeetag && 'Am Ausschiffungstag: Land des Hafens.',
        ].filter(Boolean).join(' ')
      : 'Zählt auch, wenn danach noch ein Termin in Deutschland folgte.';
    return (
      <div className="mb-3">
        <LandAuswahl
          id={`taetigkeit-${tag.datum}`}
          label={istAbreise
            ? 'Letzter Tätigkeitsort im Ausland (auch wenn das am Vortag war)'
            : 'Letzter Tätigkeitsort im Ausland'}
          value={tag.letzterTaetigkeitsort || v?.land.landKey || hauptland || LAND_INLAND}
          onChange={wert => setzeLand(index, 'letzterTaetigkeitsort', wert)}
          laender={laender}
          mitInland
          inlandText="Keine Tätigkeit im Ausland"
          {...freitextProps('letzterTaetigkeitsort')}
          hinweis={hinweisText ? <p className="text-xs text-credo-500 mt-1">{hinweisText}</p> : undefined}
        />
      </div>
    );
  };

  // Maßgebendes Land je Tag (Kopfzeile der Tageskarte), z. B. „Belgien“ oder „Nauru · Satz Luxemburg“.
  const landZeile = (index: number) => {
    const v = vorschauTag(index);
    if (!v) return null;
    const satzVon = satzLandKey(v.land.landKey);
    return (
      <>
        {' · '}{landBezeichnung(v.land)}
        {satzVon && satzVon !== v.land.landKey && ` · Satz ${satzVon}`}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Master-Toggle: zwei radio-style Karten */}
      <fieldset>
        <legend className="text-sm font-medium text-credo-700 mb-3">
          Wurde Ihnen während der Reise eine Mahlzeit vom Arbeitgeber oder Veranstalter gestellt?
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`relative flex flex-col gap-1 px-5 py-4 rounded-xl border cursor-pointer transition-all
                       focus-within:ring-2 focus-within:ring-credo-500 focus-within:ring-offset-1
                       ${!verpflegungGestellt
                         ? 'border-credo-600 bg-credo-50 shadow-sm'
                         : 'border-credo-200 bg-white hover:border-credo-300'}`}
          >
            <input
              type="radio"
              name="verpflegungGestellt"
              className="sr-only"
              checked={!verpflegungGestellt}
              onChange={() => setzeVerpflegungGestellt(false)}
            />
            <span className="text-sm font-semibold text-credo-900">Nein</span>
            <span className="text-xs text-credo-500">Ich habe alles selbst bezahlt.</span>
          </label>
          <label
            className={`relative flex flex-col gap-1 px-5 py-4 rounded-xl border cursor-pointer transition-all
                       focus-within:ring-2 focus-within:ring-credo-500 focus-within:ring-offset-1
                       ${verpflegungGestellt
                         ? 'border-credo-600 bg-credo-50 shadow-sm'
                         : 'border-credo-200 bg-white hover:border-credo-300'}`}
          >
            <input
              type="radio"
              name="verpflegungGestellt"
              className="sr-only"
              checked={verpflegungGestellt}
              onChange={() => setzeVerpflegungGestellt(true)}
            />
            <span className="text-sm font-semibold text-credo-900">Ja</span>
            <span className="text-xs text-credo-500">Mindestens eine Mahlzeit war inklusive.</span>
          </label>
        </div>
      </fieldset>

      {/* Bei "Nein": kompakte Pauschalen-Anzeige */}
      {!verpflegungGestellt && (
        <div className="bg-credo-50 border border-credo-200 rounded-xl p-5">
          <p className="text-xs text-credo-500 uppercase tracking-wider mb-1">Verpflegungspauschale</p>
          <p className="text-2xl font-bold text-credo-900">{gesamt}</p>
          <p className="text-xs text-credo-500 mt-2">
            {reisetage.length > 1
              ? `${reisetage.length} Reisetage`
              : reisetage[0].typ === 'GANZTAG'
              ? 'Ein Reisetag ohne Übernachtung (24 Stunden oder länger)'
              : 'Eintägige Reise (über 8 Stunden)'}
          </p>
        </div>
      )}

      {/* Inland mit Mahlzeiten: Desktop-Tabelle */}
      {!istAusland && verpflegungGestellt && (
        <div className="hidden lg:block border border-credo-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-credo-50">
              <tr>
                <th scope="col" className="text-left p-3 font-medium text-credo-700">Tag</th>
                <th scope="col" className="text-left p-3 font-medium text-credo-700">Typ</th>
                <th scope="col" className="text-center p-3 font-medium text-credo-700">Frühstück</th>
                <th scope="col" className="text-center p-3 font-medium text-credo-700">Mittag</th>
                <th scope="col" className="text-center p-3 font-medium text-credo-700">Abend</th>
                <th scope="col" className="text-right p-3 font-medium text-credo-700">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {reisetage.map((tag, index) => (
                <tr key={tag.datum} className={`border-t border-credo-100 ${index % 2 === 0 ? '' : 'bg-credo-50/30'}`}>
                  <td className="p-3 text-credo-700 font-medium">{formatDatumKurz(tag.datum)}</td>
                  <td className="p-3 text-credo-500 text-xs">{formatReisetagTyp(tag.typ)}</td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                      checked={tag.fruehstueckGestellt}
                      onChange={() => handleMahlzeitToggle(index, 'fruehstueckGestellt')}
                      aria-label={`Frühstück gestellt am ${formatDatumKurz(tag.datum)}`}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                      checked={tag.mittagGestellt}
                      onChange={() => handleMahlzeitToggle(index, 'mittagGestellt')}
                      aria-label={`Mittagessen gestellt am ${formatDatumKurz(tag.datum)}`}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-credo-300 text-credo-600 focus:ring-credo-500"
                      checked={tag.abendGestellt}
                      onChange={() => handleMahlzeitToggle(index, 'abendGestellt')}
                      aria-label={`Abendessen gestellt am ${formatDatumKurz(tag.datum)}`}
                    />
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-semibold text-credo-900">{betrag(index)}</div>
                    {kuerzung(index)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-credo-50 border-t-2 border-credo-200">
              <tr>
                <td colSpan={5} className="p-3 font-semibold text-credo-700">Gesamt</td>
                <td className="p-3 text-right font-bold text-credo-900 text-lg">{gesamt}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Ausland: wie das Land je Tag bestimmt wird — zugeklappt, die Vorbelegung passt im Normalfall */}
      {istAusland && (
        <details className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          <summary className="font-medium cursor-pointer">Wie wird das Land je Tag bestimmt?</summary>
          <ul className="list-disc pl-5 space-y-0.5 text-xs mt-2">
            <li>
              An- und Zwischentage: das Land, in dem Sie sich um 24 Uhr (Ortszeit) befinden. Sind Sie um 24 Uhr
              in Deutschland, zählt Ihr letzter Tätigkeitsort im Ausland an diesem Tag.
            </li>
            <li>Abreisetag und eintägige Reise: das Land Ihres letzten Tätigkeitsorts im Ausland.</li>
            <li>
              Flug: Ein Land gilt erst mit der Landung als erreicht; Zwischenlandungen zählen nicht (außer mit
              Übernachtung). Ganzer Kalendertag im Flugzeug (zwischen Abflug- und Landetag): „Österreich“.
            </li>
            <li>Fähre oder Schiff: ganzer Tag an Bord = „Seetag“; am Ein- oder Ausschiffungstag (auch am Abreisetag) das Land des Hafens.</li>
            <li>
              Nicht eigens aufgeführte Übersee- und Außengebiete zählen zum Mutterland (z. B. Grönland → Dänemark,
              Madeira → Portugal); die Kanarischen Inseln haben einen eigenen Eintrag.
            </li>
          </ul>
        </details>
      )}

      {/* Tageskarten: bei Ausland immer (Land je Tag), im Inland nur mit Mahlzeiten und nur mobil */}
      {(istAusland || verpflegungGestellt) && (
        <div className={`space-y-3 ${istAusland ? '' : 'lg:hidden'}`}>
          {reisetage.map((tag, index) => (
            <fieldset key={tag.datum} className="min-w-0 border border-credo-200 rounded-xl p-4 bg-white">
              {/* Gruppenname für Screenreader: sonst tragen alle Tage dieselben Feldbeschriftungen */}
              <legend className="sr-only">{formatDatumKurz(tag.datum)} – {formatReisetagTyp(tag.typ)}</legend>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-credo-900">{formatDatumKurz(tag.datum)}</div>
                  <div className="text-xs text-credo-500">
                    {formatReisetagTyp(tag.typ)}
                    {istAusland && landZeile(index)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-credo-900">{betrag(index)}</div>
                  {kuerzung(index)}
                </div>
              </div>
              {istAusland && landFelder(tag, index)}
              {verpflegungGestellt && (
                <div className="grid grid-cols-3 gap-2">
                  {(['fruehstueckGestellt', 'mittagGestellt', 'abendGestellt'] as const).map(field => {
                    const labels = { fruehstueckGestellt: 'Frühstück', mittagGestellt: 'Mittag', abendGestellt: 'Abend' };
                    const checked = tag[field];
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => handleMahlzeitToggle(index, field)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-credo-500
                                   ${checked
                                     ? 'bg-credo-600 text-white shadow-sm'
                                     : 'bg-credo-50 text-credo-700 border border-credo-200 hover:bg-credo-100'}`}
                        aria-pressed={checked}
                        aria-label={`${labels[field]} gestellt am ${formatDatumKurz(tag.datum)}`}
                      >
                        {labels[field]}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}
          {verpflegungGestellt && (
            <div className="bg-credo-50 border border-credo-200 rounded-xl p-4 flex items-center justify-between">
              <span className="font-semibold text-credo-700">Gesamt</span>
              <span className="font-bold text-credo-900 text-lg">{gesamt}</span>
            </div>
          )}
        </div>
      )}

      {meldung && (
        <div id={MELDUNG_ID} role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{meldung}</div>
      )}

      {verpflegungGestellt && (
        <p className="text-xs text-credo-500">
          {istAusland
            ? <>Kürzung: Frühstück 20 %, Mittag 40 %, Abend 40 % — vom 24-Stunden-Satz des für den Tag maßgebenden Landes.</>
            : <>Kürzung: Frühstück 20 %, Mittag 40 %, Abend 40 % — immer vom Volltagessatz (28,00 EUR).</>}
          {' '}Das Ergebnis pro Tag wird nie negativ.
        </p>
      )}
    </div>
  );
}
