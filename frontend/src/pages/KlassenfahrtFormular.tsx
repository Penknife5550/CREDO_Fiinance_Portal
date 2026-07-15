import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, ShieldCheck } from 'lucide-react';
import { useMandanten, useUnsavedWarning } from '@/lib/hooks';
import { useToast } from '@/components/Toast';
import { DezimalInput } from '@/components/forms/DezimalInput';
import { IbanFeld } from '@/components/forms/IbanFeld';
import { BelegUpload } from '@/components/forms/BelegUpload';
import { SignaturPad } from '@/components/forms/SignaturPad';
import { formatCurrency, validateIBAN } from '@/lib/utils';
import { einreichenKlassenfahrt } from '@/lib/api';
import { berechneKlassenfahrt, rundeAufCent, KlassenfahrtBerechnungsfehler } from '@/lib/klassenfahrt';
import {
  KF_OBERKATEGORIEN, KF_MAX_KLASSEN, KF_MAX_KOSTENZEILEN,
  type KfEinreicher, type KfKlasseForm, type KfKostenzeileForm, type KfVerteilmodus,
} from '@/lib/types';

const STEPS = ['Eckdaten', 'Klassen & Konten', 'Kosten', 'Belege', 'Ergebnis & Unterschrift'];

const INITIAL_EINREICHER: KfEinreicher = { vorname: '', nachname: '', personalNr: '' };
const neueKlasse = (): KfKlasseForm => ({ bezeichnung: '', schueler: 0, begleiter: 1, empfaenger: '', iban: '' });
const neueKostenzeile = (anzahlKlassen: number): KfKostenzeileForm =>
  ({ oberkategorie: 'FAHRTKOSTEN', bezeichnung: '', modus: 'PROPORTIONAL', betrag: 0, anteile: Array(anzahlKlassen).fill(0) });

const fmtNum = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const zelle = (n: number) => (Math.abs(n) < 0.005 ? '–' : fmtNum(n));

export function KlassenfahrtFormular() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { mandanten, loading: mandantenLoading } = useMandanten();
  const m40 = mandanten.find(m => m.mandantNr === 40);

  const [idempotenzKey] = useState(() => crypto.randomUUID());
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [einreicher, setEinreicher] = useState<KfEinreicher>(INITIAL_EINREICHER);
  const [anlass, setAnlass] = useState('');
  const [ziel, setZiel] = useState('');
  const [zeitraumVon, setZeitraumVon] = useState('');
  const [zeitraumBis, setZeitraumBis] = useState('');
  const [klassen, setKlassen] = useState<KfKlasseForm[]>([neueKlasse()]);
  const [kostenzeilen, setKostenzeilen] = useState<KfKostenzeileForm[]>([neueKostenzeile(1)]);
  const [belege, setBelege] = useState<File[]>([]);
  const [unterschrift, setUnterschrift] = useState<string | undefined>();

  const hasData = !!(einreicher.vorname || einreicher.nachname || anlass || klassen.some(k => k.empfaenger || k.iban || k.schueler > 0));
  useUnsavedWarning(hasData);

  // ── Klassen-/Kostenzeilen-Handler (Anteil-Arrays synchron zur Klassenzahl halten) ──
  const addKlasse = () => {
    if (klassen.length >= KF_MAX_KLASSEN) return;
    setKlassen([...klassen, neueKlasse()]);
    setKostenzeilen(kostenzeilen.map(z => ({ ...z, anteile: [...z.anteile, 0] })));
  };
  const removeKlasse = (idx: number) => {
    if (klassen.length <= 1) return;
    setKlassen(klassen.filter((_, i) => i !== idx));
    setKostenzeilen(kostenzeilen.map(z => ({ ...z, anteile: z.anteile.filter((_, i) => i !== idx) })));
  };
  const updateKlasse = (idx: number, patch: Partial<KfKlasseForm>) =>
    setKlassen(klassen.map((k, i) => (i === idx ? { ...k, ...patch } : k)));

  const addZeile = () => { if (kostenzeilen.length < KF_MAX_KOSTENZEILEN) setKostenzeilen([...kostenzeilen, neueKostenzeile(klassen.length)]); };
  const removeZeile = (idx: number) => { if (kostenzeilen.length > 1) setKostenzeilen(kostenzeilen.filter((_, i) => i !== idx)); };
  const updateZeile = (idx: number, patch: Partial<KfKostenzeileForm>) =>
    setKostenzeilen(kostenzeilen.map((z, i) => (i === idx ? { ...z, ...patch } : z)));
  const updateAnteil = (zi: number, ki: number, val: number) =>
    setKostenzeilen(kostenzeilen.map((z, i) => (i === zi ? { ...z, anteile: z.anteile.map((a, j) => (j === ki ? val : a)) } : z)));

  // Geldwerte + Begleiter-Divisor auf 2 Nachkommastellen normalisieren — exakt wie der
  // Server (einreichungen.ts), damit die Live-Vorschau == dem ausgezahlten Betrag ist
  // (auch wenn jemand mehr als 2 Nachkommastellen eintippt).
  const zeileBetrag = (z: KfKostenzeileForm): number =>
    z.modus === 'DIREKT' ? rundeAufCent(z.anteile.reduce((s, a) => s + rundeAufCent(a), 0)) : rundeAufCent(z.betrag);

  // ── Live-Berechnung (autoritativ rechnet der Server neu) ──
  const berechnung = useMemo(() => {
    try {
      const ergebnis = berechneKlassenfahrt(
        klassen.map(k => ({ schueler: k.schueler, begleiter: rundeAufCent(k.begleiter) })),
        kostenzeilen.map(z => ({ modus: z.modus, betrag: rundeAufCent(z.betrag), anteile: z.anteile.map(a => rundeAufCent(a)) })),
      );
      return { ok: true as const, ergebnis };
    } catch (e) {
      return { ok: false as const, fehler: e instanceof KlassenfahrtBerechnungsfehler ? e.message : 'Berechnung derzeit nicht möglich.' };
    }
  }, [klassen, kostenzeilen]);

  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!einreicher.vorname.trim()) errs.vorname = 'Pflichtfeld';
      if (!einreicher.nachname.trim()) errs.nachname = 'Pflichtfeld';
      if (anlass.trim().length < 3) errs.anlass = 'Bitte Anlass angeben (min. 3 Zeichen)';
      if (!zeitraumVon) errs.zeitraumVon = 'Pflichtfeld';
      if (!zeitraumBis) errs.zeitraumBis = 'Pflichtfeld';
      if (zeitraumVon && zeitraumBis && zeitraumBis < zeitraumVon) errs.zeitraumBis = 'Rückkehr darf nicht vor Abfahrt liegen';
    }
    if (step === 1) {
      klassen.forEach((k, i) => {
        if (!Number.isInteger(k.schueler) || k.schueler < 0) errs[`k_${i}_schueler`] = 'Ganzzahl ≥ 0';
        if (!(k.begleiter >= 1)) errs[`k_${i}_begleiter`] = 'Mind. 1';
        if (!k.empfaenger.trim()) errs[`k_${i}_empfaenger`] = 'Pflichtfeld';
        if (!validateIBAN(k.iban)) errs[`k_${i}_iban`] = 'Gültige deutsche IBAN erforderlich';
      });
    }
    if (step === 2) {
      kostenzeilen.forEach((z, i) => {
        if (!z.bezeichnung.trim()) errs[`z_${i}_bezeichnung`] = 'Pflichtfeld';
      });
      if (!berechnung.ok) errs.berechnung = berechnung.fehler;
    }
    if (step === 3) {
      if (belege.length === 0) errs.belege = 'Mindestens ein Beleg ist erforderlich';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateBisAktuell = (): boolean => {
    for (let s = 0; s <= currentStep; s++) {
      if (!validateStep(s)) {
        if (s !== currentStep) setCurrentStep(s);
        return false;
      }
    }
    return true;
  };

  const handleWeiter = () => { if (validateBisAktuell()) setCurrentStep(currentStep + 1); };

  const handleEinreichen = async () => {
    if (!validateBisAktuell()) return;
    if (!berechnung.ok) { showToast(berechnung.fehler, 'error'); return; }
    if (!m40) { showToast('Förderverein (Mandant 40) ist nicht verfügbar.', 'error'); return; }
    setSubmitting(true);
    try {
      const result = await einreichenKlassenfahrt({
        mandantId: m40.id,
        einreicher,
        anlass, ziel, zeitraumVon, zeitraumBis,
        klassen,
        kostenzeilen: kostenzeilen.map(z => ({ ...z, betrag: zeileBetrag(z) })),
        unterschriftBild: unterschrift,
        belege,
        idempotenzKey,
      });
      navigate(`/erfolg/${result.belegNr}`, { state: { typ: 'klassenfahrt' } });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── M40-Verfügbarkeit ──
  if (mandantenLoading) {
    return <p className="text-center text-credo-500 py-16">Wird geladen …</p>;
  }
  if (!m40) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h2 className="text-xl font-bold text-credo-900 mb-3">Klassenfahrt-Abrechnung nicht verfügbar</h2>
        <p className="text-credo-500 mb-6">Der Förderverein (Mandant 40) ist derzeit nicht konfiguriert. Bitte wenden Sie sich an die Verwaltung.</p>
        <Link to="/" className="btn-secondary"><ArrowLeft className="w-4 h-4 mr-2" />Zurück zur Startseite</Link>
      </div>
    );
  }

  const summeS = klassen.reduce((s, k) => s + (k.schueler || 0), 0);
  const summeB = klassen.reduce((s, k) => s + rundeAufCent(k.begleiter || 0), 0);

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-credo-500 hover:text-credo-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Auswahl
      </Link>

      <h2 className="text-2xl font-bold text-credo-900 mb-1">Klassenfahrt-Abrechnung</h2>
      <p className="text-sm text-credo-500 mb-6">Förderverein-Zuschuss je Klasse · {m40.name}</p>

      {/* Stepper */}
      <div className="mb-8">
        <div className="hidden sm:flex items-center justify-between mb-2">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                index < currentStep ? 'bg-emerald-500 text-white'
                : index === currentStep ? 'bg-credo-600 text-white'
                : 'bg-credo-200 text-credo-500'
              }`}>
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-10 sm:w-16 lg:w-28 h-0.5 mx-2 ${index < currentStep ? 'bg-emerald-500' : 'bg-credo-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="sm:hidden mb-2">
          <p className="text-sm font-medium text-credo-700 mb-2">Schritt {currentStep + 1} von {STEPS.length}</p>
          <div className="w-full bg-credo-200 rounded-full h-1.5">
            <div className="bg-credo-600 h-1.5 rounded-full transition-all" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <p className="text-sm font-medium text-credo-700">Schritt {currentStep + 1}: {STEPS[currentStep]}</p>
      </div>

      <div className="card">
        {/* ── Schritt 1: Eckdaten ── */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="kf-vorname">Vorname (Einreicher) *</label>
                <input id="kf-vorname" maxLength={100} className={`input-field ${errors.vorname ? 'border-red-400' : ''}`}
                  value={einreicher.vorname} onChange={e => setEinreicher({ ...einreicher, vorname: e.target.value })} />
                {errors.vorname && <p className="text-xs text-red-500 mt-1">{errors.vorname}</p>}
              </div>
              <div>
                <label className="label" htmlFor="kf-nachname">Nachname (Einreicher) *</label>
                <input id="kf-nachname" maxLength={100} className={`input-field ${errors.nachname ? 'border-red-400' : ''}`}
                  value={einreicher.nachname} onChange={e => setEinreicher({ ...einreicher, nachname: e.target.value })} />
                {errors.nachname && <p className="text-xs text-red-500 mt-1">{errors.nachname}</p>}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="kf-pnr">Personalnummer <span className="text-credo-500 font-normal">(optional)</span></label>
              <input id="kf-pnr" maxLength={20} className="input-field" value={einreicher.personalNr}
                onChange={e => setEinreicher({ ...einreicher, personalNr: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="kf-anlass">Anlass der Fahrt *</label>
              <input id="kf-anlass" maxLength={500} className={`input-field ${errors.anlass ? 'border-red-400' : ''}`}
                placeholder="z.B. Jahrgangsfahrt Klasse 6" value={anlass} onChange={e => setAnlass(e.target.value)} />
              {errors.anlass && <p className="text-xs text-red-500 mt-1">{errors.anlass}</p>}
            </div>
            <div>
              <label className="label" htmlFor="kf-ziel">Ziel <span className="text-credo-500 font-normal">(optional)</span></label>
              <input id="kf-ziel" maxLength={500} className="input-field" placeholder="z.B. Willingen (Sauerland)" value={ziel} onChange={e => setZiel(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="kf-von">Zeitraum von *</label>
                <input id="kf-von" type="date" className={`input-field ${errors.zeitraumVon ? 'border-red-400' : ''}`}
                  value={zeitraumVon} onChange={e => setZeitraumVon(e.target.value)} />
                {errors.zeitraumVon && <p className="text-xs text-red-500 mt-1">{errors.zeitraumVon}</p>}
              </div>
              <div>
                <label className="label" htmlFor="kf-bis">Zeitraum bis *</label>
                <input id="kf-bis" type="date" className={`input-field ${errors.zeitraumBis ? 'border-red-400' : ''}`}
                  value={zeitraumBis} onChange={e => setZeitraumBis(e.target.value)} />
                {errors.zeitraumBis && <p className="text-xs text-red-500 mt-1">{errors.zeitraumBis}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Schritt 2: Klassen & Konten ── */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 bg-credo-50 border border-credo-200 rounded-lg p-3 text-xs text-credo-600">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-credo-500" aria-hidden="true" />
              <p>
                <strong>Datenschutzhinweis (Art. 13 DSGVO):</strong> Die hier erfassten Empfängernamen und
                Bankverbindungen (IBAN) werden ausschließlich zur Auszahlung des Fördervereins-Zuschusses auf die
                jeweiligen Klassenkonten verarbeitet und mit dieser Abrechnung an die Buchhaltung des {m40.name}
                {' '}übermittelt (Art. 6 Abs. 1 lit. b/e DSGVO). Eine darüber hinausgehende Nutzung erfolgt nicht.
              </p>
            </div>

            {klassen.map((k, i) => (
              <div key={i} className="border border-credo-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-credo-700">Klasse {i + 1}</h3>
                  {klassen.length > 1 && (
                    <button type="button" onClick={() => removeKlasse(i)}
                      className="text-credo-400 hover:text-red-500 transition-colors" aria-label={`Klasse ${i + 1} entfernen`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor={`k-bez-${i}`}>Bezeichnung <span className="text-credo-500 font-normal">(optional)</span></label>
                    <input id={`k-bez-${i}`} maxLength={100} className="input-field" placeholder="z.B. Klasse 6a"
                      value={k.bezeichnung} onChange={e => updateKlasse(i, { bezeichnung: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor={`k-s-${i}`}>Schüler *</label>
                      <input id={`k-s-${i}`} type="number" min={0} step={1}
                        className={`input-field ${errors[`k_${i}_schueler`] ? 'border-red-400' : ''}`}
                        value={Number.isFinite(k.schueler) ? k.schueler : 0}
                        onChange={e => updateKlasse(i, { schueler: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                      {errors[`k_${i}_schueler`] && <p className="text-xs text-red-500 mt-1">{errors[`k_${i}_schueler`]}</p>}
                    </div>
                    <div>
                      <label className="label" htmlFor={`k-b-${i}`}>Begleiter *</label>
                      <DezimalInput id={`k-b-${i}`}
                        className={`input-field ${errors[`k_${i}_begleiter`] ? 'border-red-400' : ''}`}
                        value={k.begleiter} onChange={n => updateKlasse(i, { begleiter: n })} />
                      {errors[`k_${i}_begleiter`] && <p className="text-xs text-red-500 mt-1">{errors[`k_${i}_begleiter`]}</p>}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor={`k-e-${i}`}>Empfänger (Kontoinhaber) *</label>
                  <input id={`k-e-${i}`} maxLength={200} className={`input-field ${errors[`k_${i}_empfaenger`] ? 'border-red-400' : ''}`}
                    placeholder="z.B. Klassenkasse 6a" value={k.empfaenger} onChange={e => updateKlasse(i, { empfaenger: e.target.value })} />
                  {errors[`k_${i}_empfaenger`] && <p className="text-xs text-red-500 mt-1">{errors[`k_${i}_empfaenger`]}</p>}
                </div>
                <div>
                  <label className="label" htmlFor={`k-iban-${i}`}>IBAN (Klassenkonto) *</label>
                  <IbanFeld id={`k-iban-${i}`} value={k.iban} onChange={v => updateKlasse(i, { iban: v })}
                    error={errors[`k_${i}_iban`]} aria-label={`IBAN Klasse ${i + 1}`} />
                </div>
              </div>
            ))}

            {klassen.length < KF_MAX_KLASSEN && (
              <button type="button" onClick={addKlasse}
                className="w-full border border-dashed border-credo-300 rounded-lg py-2.5 text-sm text-credo-600 hover:border-credo-400 hover:text-credo-800 transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" /> Weitere Klasse hinzufügen ({klassen.length}/{KF_MAX_KLASSEN})
              </button>
            )}
          </div>
        )}

        {/* ── Schritt 3: Kosten ── */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-credo-600">
              Erfassen Sie die Kosten der Fahrt. <strong>Anteilig</strong> verteilt nach Schülerzahl (gemeinsame Kosten wie Bus, Unterkunft),
              <strong> direkt</strong> = je Klasse selbst gebucht. Gutschriften/Rabatte als negativen Betrag eingeben.
            </p>

            {kostenzeilen.map((z, i) => (
              <div key={i} className="border border-credo-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-credo-700">Kostenzeile {i + 1}</h3>
                  {kostenzeilen.length > 1 && (
                    <button type="button" onClick={() => removeZeile(i)}
                      className="text-credo-400 hover:text-red-500 transition-colors" aria-label={`Kostenzeile ${i + 1} entfernen`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor={`z-kat-${i}`}>Kategorie</label>
                    <select id={`z-kat-${i}`} className="input-field" value={z.oberkategorie}
                      onChange={e => updateZeile(i, { oberkategorie: e.target.value as KfKostenzeileForm['oberkategorie'] })}>
                      {KF_OBERKATEGORIEN.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`z-bez-${i}`}>Bezeichnung *</label>
                    <input id={`z-bez-${i}`} maxLength={200} className={`input-field ${errors[`z_${i}_bezeichnung`] ? 'border-red-400' : ''}`}
                      placeholder="z.B. Bus, Unterkunft, Kartfahren" value={z.bezeichnung} onChange={e => updateZeile(i, { bezeichnung: e.target.value })} />
                    {errors[`z_${i}_bezeichnung`] && <p className="text-xs text-red-500 mt-1">{errors[`z_${i}_bezeichnung`]}</p>}
                  </div>
                </div>

                <fieldset>
                  <legend className="label">Verteilung</legend>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {(['PROPORTIONAL', 'DIREKT'] as KfVerteilmodus[]).map(m => (
                      <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors focus-within:ring-2 focus-within:ring-credo-500 focus-within:ring-offset-1 ${
                        z.modus === m ? 'border-credo-600 bg-credo-50' : 'border-credo-200 hover:border-credo-300'
                      }`}>
                        <input type="radio" name={`modus-${i}`} className="w-4 h-4 text-credo-600"
                          checked={z.modus === m} onChange={() => updateZeile(i, { modus: m })} />
                        <span className="font-medium text-credo-800">{m === 'PROPORTIONAL' ? 'anteilig (nach Schülern)' : 'direkt (je Klasse)'}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {z.modus === 'PROPORTIONAL' ? (
                  <div>
                    <label className="label" htmlFor={`z-betrag-${i}`}>Gesamtbetrag (EUR)</label>
                    <DezimalInput id={`z-betrag-${i}`} className="input-field" allowNegative
                      value={z.betrag} onChange={n => updateZeile(i, { betrag: n })} />
                  </div>
                ) : (
                  <div>
                    <label className="label">Betrag je Klasse (EUR)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {klassen.map((k, ki) => (
                        <div key={ki}>
                          <span className="text-xs text-credo-500 block mb-0.5">{k.bezeichnung || `Klasse ${ki + 1}`}</span>
                          <DezimalInput className="input-field" allowNegative
                            value={z.anteile[ki] ?? 0} onChange={n => updateAnteil(i, ki, n)}
                            aria-label={`Betrag ${k.bezeichnung || `Klasse ${ki + 1}`} für ${z.bezeichnung || `Kostenzeile ${i + 1}`}`} />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-credo-500 mt-1">Summe dieser Zeile: {formatCurrency(zeileBetrag(z))}</p>
                  </div>
                )}
              </div>
            ))}

            {kostenzeilen.length < KF_MAX_KOSTENZEILEN && (
              <button type="button" onClick={addZeile}
                className="w-full border border-dashed border-credo-300 rounded-lg py-2.5 text-sm text-credo-600 hover:border-credo-400 hover:text-credo-800 transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" /> Weitere Kostenzeile hinzufügen
              </button>
            )}

            {!berechnung.ok && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{berechnung.fehler}</div>
            )}
          </div>
        )}

        {/* ── Schritt 4: Belege ── */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-credo-600">Bitte laden Sie die Belege zur Fahrt hoch (Rechnungen, Quittungen). <strong>Mindestens ein Beleg ist erforderlich.</strong></p>
            <BelegUpload dateien={belege} onChange={setBelege} label="Belege zur Klassenfahrt (Pflicht)" />
            {errors.belege && <p className="text-xs text-red-500">{errors.belege}</p>}
          </div>
        )}

        {/* ── Schritt 5: Ergebnis & Unterschrift ── */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {!berechnung.ok ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                {berechnung.fehler} Bitte korrigieren Sie die Eingaben in den vorherigen Schritten.
              </div>
            ) : (
              <>
                {/* Gesamt-Zuschuss */}
                <div className="bg-credo-50 rounded-lg p-4 flex items-center justify-between">
                  <span className="font-semibold text-credo-800">Gesamt-Zuschuss Förderverein</span>
                  <span className="text-xl font-bold text-credo-900">{formatCurrency(berechnung.ergebnis.gesamtZuschuss)}</span>
                </div>

                {/* Auszahlung je Konto */}
                <div>
                  <h3 className="text-sm font-semibold text-credo-700 mb-2">Auszahlung je Klassenkonto</h3>
                  <div className="space-y-2">
                    {klassen.map((k, i) => (
                      <div key={i} className="flex items-center justify-between border border-credo-100 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-credo-800">{k.bezeichnung || `Klasse ${i + 1}`} <span className="text-credo-400 font-normal">· {k.empfaenger}</span></p>
                          <p className="text-xs text-credo-400 font-mono">{k.iban}</p>
                        </div>
                        <span className="font-semibold text-credo-900">{formatCurrency(berechnung.ergebnis.klassen[i].zuschuss)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transparenz-Matrix (Parität zum PDF) */}
                <div>
                  <h3 className="text-sm font-semibold text-credo-700 mb-2">Kostenaufteilung je Klasse <span className="text-credo-400 font-normal">(Beträge in EUR)</span></h3>
                  <div className="overflow-x-auto border border-credo-200 rounded-lg">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="bg-credo-50 text-xs">
                        <tr>
                          <th scope="col" className="text-left p-2 font-medium text-credo-700">Kostenzeile</th>
                          <th scope="col" className="text-right p-2 font-medium text-credo-700">Gesamt</th>
                          {klassen.map((k, i) => (
                            <th key={i} scope="col" className="text-right p-2 font-medium text-credo-700">{k.bezeichnung || `Kl. ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kostenzeilen.map((z, zi) => (
                          <tr key={zi} className="border-t border-credo-100">
                            <td className="p-2 text-credo-700">
                              {(KF_OBERKATEGORIEN.find(o => o.value === z.oberkategorie)?.label ?? z.oberkategorie)}: {z.bezeichnung || '—'}
                              <span className="text-credo-400"> · {z.modus === 'PROPORTIONAL' ? 'anteilig' : 'direkt'}</span>
                            </td>
                            <td className="p-2 text-right font-mono text-credo-700">{fmtNum(zeileBetrag(z))}</td>
                            {klassen.map((_, ki) => (
                              <td key={ki} className="p-2 text-right font-mono text-credo-700">{zelle(berechnung.ergebnis.verteilung[zi][ki])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-credo-300 text-xs">
                        <tr className="font-semibold text-credo-800">
                          <td className="p-2">Summe Kostenanteil (K)</td>
                          <td className="p-2 text-right font-mono">{fmtNum(klassen.reduce((s, _, i) => s + berechnung.ergebnis.klassen[i].kostenanteil, 0))}</td>
                          {klassen.map((_, i) => <td key={i} className="p-2 text-right font-mono">{fmtNum(berechnung.ergebnis.klassen[i].kostenanteil)}</td>)}
                        </tr>
                        <tr className="text-credo-600">
                          <td className="p-2">÷ Personen (Schüler + Begleiter)</td>
                          <td className="p-2"></td>
                          {klassen.map((k, i) => <td key={i} className="p-2 text-right font-mono">{fmtNum(k.schueler + rundeAufCent(k.begleiter)).replace(',00', '')}</td>)}
                        </tr>
                        <tr className="font-semibold text-credo-900">
                          <td className="p-2">= FV-Zuschuss je Klasse</td>
                          <td className="p-2 text-right font-mono">{fmtNum(berechnung.ergebnis.gesamtZuschuss)}</td>
                          {klassen.map((_, i) => <td key={i} className="p-2 text-right font-mono">{fmtNum(berechnung.ergebnis.klassen[i].zuschuss)}</td>)}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="text-xs text-credo-400 mt-1">{klassen.length} Klasse(n) · {summeS} Schüler · {fmtNum(summeB).replace(',00', '')} Begleiter · {belege.length} Beleg(e)</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                  Bitte prüfen Sie alle Angaben. Nach dem Einreichen sind keine Änderungen mehr möglich.
                </div>

                <SignaturPad onSignature={setUnterschrift} value={unterschrift} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button onClick={handleWeiter} className="btn-primary">Weiter<ArrowRight className="w-4 h-4 ml-2" /></button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            {!unterschrift && <p className="text-xs text-red-500">Bitte unterschreiben Sie zuerst</p>}
            <button onClick={handleEinreichen} disabled={submitting || !unterschrift || !berechnung.ok}
              className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'Wird eingereicht...' : (<><Check className="w-4 h-4 mr-2" />Verbindlich einreichen</>)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
