import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { PersoenlicheDatenStep } from '@/components/forms/PersoenlicheDatenStep';
import { VerpflegungStep } from '@/components/forms/VerpflegungStep';
import { BelegUpload } from '@/components/forms/BelegUpload';
import { SignaturPad } from '@/components/forms/SignaturPad';
import { berechneReisetage, berechneKmBetrag, berechneVmaGesamt, berechneVmaTag, berechneVmaTagAusland, AUSLANDSPAUSCHALEN } from '@/lib/vma';
import { formatCurrency, formatIBAN, validateIBAN } from '@/lib/utils';
import { einreichenReisekosten } from '@/lib/api';
import { pruefeDreiMonatsFrist, speichereReiseziel } from '@/lib/dreiMonatsFrist';
import type { PersoenlicheDaten, Reisetag, WeitereKostenPosition, ReisekostenFormData } from '@/lib/types';
import { VERKEHRSMITTEL, WEITERE_KOSTEN_TYPEN } from '@/lib/types';

const STEPS = [
  'Persönliche Daten',
  'Reisedaten',
  'Fahrkosten',
  'Verpflegung',
  'Weitere Kosten & Belege',
  'Zusammenfassung',
];

const INITIAL_PERSOENLICH: PersoenlicheDaten = {
  vorname: '', nachname: '', personalNr: '',
  iban: '', kontoinhaber: '',
  mandantId: '', kostenstelleId: '',
};

export function ReisekostenFormular() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ── State ──────────────────────────────────────────
  const [persoenlich, setPersoenlich] = useState<PersoenlicheDaten>(INITIAL_PERSOENLICH);
  const [reiseanlass, setReiseanlass] = useState('');
  const [reiseziel, setReiseziel] = useState('');
  const [abfahrtOrt, setAbfahrtOrt] = useState<'WOHNUNG' | 'TAETIGKEIT'>('WOHNUNG');
  const [abfahrtZeit, setAbfahrtZeit] = useState('');
  const [rueckkehrZeit, setRueckkehrZeit] = useState('');
  const [inlandAusland, setInlandAusland] = useState<'inland' | 'ausland'>('inland');
  const [auslandsLand, setAuslandsLand] = useState('');
  const [verkehrsmittel, setVerkehrsmittel] = useState('');
  const [kmGefahren, setKmGefahren] = useState<number>(0);
  const [reisetage, setReisetage] = useState<Reisetag[]>([]);
  const [weitereKosten, setWeitereKosten] = useState<WeitereKostenPosition[]>([]);
  const [belege, setBelege] = useState<File[]>([]);
  const [unterschrift, setUnterschrift] = useState<string | undefined>();

  // ── Warnung bei Datenverlust ──────────────────────
  const hasData = persoenlich.vorname || persoenlich.nachname || reiseanlass || reiseziel;
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasData) {
      e.preventDefault();
    }
  }, [hasData]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  // ── 3-Monats-Frist prüfen ─────────────────────────
  const dreiMonatsFrist = pruefeDreiMonatsFrist(reiseziel);

  // ── Berechnete Werte ───────────────────────────────
  const kmBetrag = berechneKmBetrag(kmGefahren, verkehrsmittel);
  const vmaGesamt = berechneVmaGesamt(reisetage);
  const weitereKostenSumme = weitereKosten.reduce((sum, k) => sum + (k.betrag || 0), 0);
  const gesamtbetrag = kmBetrag + vmaGesamt + weitereKostenSumme;

  // ── Aktives Auslandsland für VMA ─────────────────────
  const aktivesAuslandsLand = inlandAusland === 'ausland' && auslandsLand ? AUSLANDSPAUSCHALEN[auslandsLand] : null;

  // ── Reisetage automatisch berechnen ────────────────
  useEffect(() => {
    const tage = berechneReisetage(abfahrtZeit, rueckkehrZeit);
    if (aktivesAuslandsLand) {
      setReisetage(tage.map(t => berechneVmaTagAusland(t, aktivesAuslandsLand.tagessatz24h)));
    } else {
      setReisetage(tage.map(t => berechneVmaTag(t)));
    }
  }, [abfahrtZeit, rueckkehrZeit, auslandsLand, inlandAusland]);

  // ── Validierung pro Step ───────────────────────────
  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!persoenlich.vorname.trim()) errs.vorname = 'Pflichtfeld';
      if (!persoenlich.nachname.trim()) errs.nachname = 'Pflichtfeld';
      // personalNr ist optional
      if (!persoenlich.iban || !validateIBAN(persoenlich.iban)) errs.iban = 'Gültige deutsche IBAN erforderlich';
      if (!persoenlich.kontoinhaber.trim()) errs.kontoinhaber = 'Pflichtfeld';
      if (!persoenlich.mandantId) errs.mandantId = 'Bitte wählen';
      // kostenstelleId ist optional
    }

    if (step === 1) {
      if (reiseanlass.trim().length < 10) errs.reiseanlass = 'Mindestens 10 Zeichen';
      if (!reiseziel.trim()) errs.reiseziel = 'Pflichtfeld';
      if (!abfahrtZeit) errs.abfahrtZeit = 'Pflichtfeld';
      if (!rueckkehrZeit) errs.rueckkehrZeit = 'Pflichtfeld';
      if (abfahrtZeit && rueckkehrZeit && new Date(rueckkehrZeit) <= new Date(abfahrtZeit)) {
        errs.rueckkehrZeit = 'Rückkehr muss nach Abfahrt liegen';
      }
    }

    if (step === 2) {
      if (!verkehrsmittel) errs.verkehrsmittel = 'Bitte wählen';
      if ((verkehrsmittel === 'PKW' || verkehrsmittel === 'MOTORRAD') && (!kmGefahren || kmGefahren <= 0)) {
        errs.kmGefahren = 'Kilometer angeben';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleWeiter = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleEinreichen = async () => {
    setSubmitting(true);
    try {
      // Reiseziel für 3-Monats-Frist speichern
      speichereReiseziel(reiseziel);

      const result = await einreichenReisekosten({
        persoenlich,
        reiseanlass,
        reiseziel,
        abfahrtOrt,
        abfahrtZeit,
        rueckkehrZeit,
        land: inlandAusland === 'ausland' && auslandsLand ? auslandsLand : null,
        verkehrsmittel,
        kmGefahren,
        kmBetrag,
        reisetage,
        vmaNetto: vmaGesamt,
        weitereKosten,
        weitereKostenSumme,
        gesamtbetrag,
        unterschriftBild: unterschrift,
        belege,
      });
      navigate(`/erfolg/${result.belegNr}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Weitere Kosten ─────────────────────────────────
  const addWeitereKosten = () => {
    setWeitereKosten([...weitereKosten, { typ: '', beschreibung: '', betrag: 0 }]);
  };

  const updateWeitereKosten = (index: number, field: keyof WeitereKostenPosition, value: string | number) => {
    setWeitereKosten(weitereKosten.map((k, i) => i === index ? { ...k, [field]: value } : k));
  };

  const removeWeitereKosten = (index: number) => {
    setWeitereKosten(weitereKosten.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-credo-500 hover:text-credo-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Auswahl
      </Link>

      <h2 className="text-2xl font-bold text-credo-900 mb-6">Reisekostenabrechnung</h2>

      {/* Stepper */}
      <div className="mb-8">
        {/* Desktop: Kreise */}
        <div className="hidden sm:flex items-center justify-between mb-2">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  index < currentStep
                    ? 'bg-emerald-500 text-white'
                    : index === currentStep
                    ? 'bg-credo-600 text-white'
                    : 'bg-credo-200 text-credo-500'
                }`}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-8 lg:w-16 h-0.5 mx-1 ${index < currentStep ? 'bg-emerald-500' : 'bg-credo-200'}`} />
              )}
            </div>
          ))}
        </div>
        {/* Mobile: Text + Fortschrittsbalken */}
        <div className="sm:hidden mb-2">
          <p className="text-sm font-medium text-credo-700 mb-2">
            Schritt {currentStep + 1} von {STEPS.length}
          </p>
          <div className="w-full bg-credo-200 rounded-full h-1.5">
            <div
              className="bg-credo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
        <p className="text-sm font-medium text-credo-700">
          Schritt {currentStep + 1}: {STEPS[currentStep]}
        </p>
      </div>

      {/* Formular-Inhalt */}
      <div className="card">
        {/* Step 1: Persönliche Daten */}
        {currentStep === 0 && (
          <PersoenlicheDatenStep data={persoenlich} onChange={setPersoenlich} errors={errors} vorgangstyp="reisekosten" />
        )}

        {/* Step 2: Reisedaten */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <label className="label">Dienstreiseanlass *</label>
              <input
                type="text"
                className={`input-field ${errors.reiseanlass ? 'border-red-400' : ''}`}
                placeholder="z.B. Fortbildung Medienkompetenz in Köln"
                value={reiseanlass}
                onChange={e => setReiseanlass(e.target.value)}
              />
              {errors.reiseanlass && <p className="text-xs text-red-500 mt-1">{errors.reiseanlass}</p>}
            </div>
            <div>
              <label className="label">Reiseziel *</label>
              <input
                type="text"
                className={`input-field ${errors.reiseziel ? 'border-red-400' : ''}`}
                placeholder="z.B. Köln, Messehalle 5"
                value={reiseziel}
                onChange={e => setReiseziel(e.target.value)}
              />
              {errors.reiseziel && <p className="text-xs text-red-500 mt-1">{errors.reiseziel}</p>}
              {dreiMonatsFrist.warnung && reiseziel.trim().length > 0 && (
                <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Hinweis:</strong> Sie haben in den letzten 3 Monaten bereits {dreiMonatsFrist.anzahl} Reise{dreiMonatsFrist.anzahl > 1 ? 'n' : ''} nach {reiseziel.trim()} eingereicht (seit {new Date(dreiMonatsFrist.ersteSeit!).toLocaleDateString('de-DE')}). Nach &sect; 9 Abs. 4a EStG sind Verpflegungspauschalen bei derselben T&auml;tigkeitsst&auml;tte nach 3 Monaten nicht mehr steuerfrei.
                </div>
              )}
            </div>
            <div>
              <label className="label">Abfahrtsort *</label>
              <div className="flex gap-6 mt-1">
                {(['WOHNUNG', 'TAETIGKEIT'] as const).map(ort => (
                  <label key={ort} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="abfahrt"
                      className="w-4 h-4 text-credo-600"
                      checked={abfahrtOrt === ort}
                      onChange={() => setAbfahrtOrt(ort)}
                    />
                    <span className="text-sm text-credo-700">
                      {ort === 'WOHNUNG' ? 'Wohnung' : 'Erste Tätigkeitsstätte'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Abfahrt (Datum + Uhrzeit) *</label>
                <input
                  type="datetime-local"
                  className={`input-field ${errors.abfahrtZeit ? 'border-red-400' : ''}`}
                  value={abfahrtZeit}
                  onChange={e => setAbfahrtZeit(e.target.value)}
                />
                {errors.abfahrtZeit && <p className="text-xs text-red-500 mt-1">{errors.abfahrtZeit}</p>}
              </div>
              <div>
                <label className="label">Rückkehr (Datum + Uhrzeit) *</label>
                <input
                  type="datetime-local"
                  className={`input-field ${errors.rueckkehrZeit ? 'border-red-400' : ''}`}
                  value={rueckkehrZeit}
                  onChange={e => setRueckkehrZeit(e.target.value)}
                />
                {errors.rueckkehrZeit && <p className="text-xs text-red-500 mt-1">{errors.rueckkehrZeit}</p>}
              </div>
            </div>
            {abfahrtZeit && rueckkehrZeit && reisetage.length > 0 && (
              <div className="bg-credo-50 rounded-lg p-3 text-sm text-credo-600">
                Reisedauer: <strong>{reisetage.length} {reisetage.length === 1 ? 'Tag' : 'Tage'}</strong>
                {reisetage.length === 1 && reisetage[0].vmaBrutto === 0 && ' (unter 8 Stunden — kein VMA)'}
              </div>
            )}
            <div>
              <label className="label">Inland / Ausland</label>
              <select
                className="input-field"
                value={inlandAusland}
                onChange={e => {
                  setInlandAusland(e.target.value as 'inland' | 'ausland');
                  if (e.target.value === 'inland') setAuslandsLand('');
                }}
              >
                <option value="inland">Inland (Deutschland)</option>
                <option value="ausland">Ausland</option>
              </select>
            </div>
            {inlandAusland === 'ausland' && (
              <div>
                <label className="label">Land *</label>
                <select
                  className="input-field"
                  value={auslandsLand}
                  onChange={e => setAuslandsLand(e.target.value)}
                >
                  <option value="">Bitte Land wählen...</option>
                  {Object.keys(AUSLANDSPAUSCHALEN).map(land => (
                    <option key={land} value={land}>{land}</option>
                  ))}
                </select>
                {auslandsLand && AUSLANDSPAUSCHALEN[auslandsLand] && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                    Tagessatz {auslandsLand}: {AUSLANDSPAUSCHALEN[auslandsLand].tagessatz24h},00 EUR (24h) / {AUSLANDSPAUSCHALEN[auslandsLand].tagessatz8h},00 EUR (8h) | Übernachtung: {AUSLANDSPAUSCHALEN[auslandsLand].uebernachtung},00 EUR
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Fahrkosten */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div>
              <label className="label">Verkehrsmittel *</label>
              <select
                className={`input-field ${errors.verkehrsmittel ? 'border-red-400' : ''}`}
                value={verkehrsmittel}
                onChange={e => setVerkehrsmittel(e.target.value)}
              >
                <option value="">Bitte wählen...</option>
                {VERKEHRSMITTEL.map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
              {errors.verkehrsmittel && <p className="text-xs text-red-500 mt-1">{errors.verkehrsmittel}</p>}
            </div>

            {(verkehrsmittel === 'PKW' || verkehrsmittel === 'MOTORRAD') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Gefahrene Kilometer *</label>
                  <input
                    type="number"
                    min="0"
                    className={`input-field ${errors.kmGefahren ? 'border-red-400' : ''}`}
                    placeholder="86"
                    value={kmGefahren || ''}
                    onChange={e => setKmGefahren(parseFloat(e.target.value) || 0)}
                  />
                  {errors.kmGefahren && <p className="text-xs text-red-500 mt-1">{errors.kmGefahren}</p>}
                </div>
                <div>
                  <label className="label">Berechneter Betrag</label>
                  <div className="input-field bg-emerald-50 text-emerald-700 font-semibold border-emerald-200">
                    {kmGefahren > 0
                      ? `${kmGefahren} km × ${verkehrsmittel === 'PKW' ? '0,30' : '0,20'} EUR = ${formatCurrency(kmBetrag)}`
                      : '—'
                    }
                  </div>
                </div>
              </div>
            )}

            {verkehrsmittel && !['PKW', 'MOTORRAD'].includes(verkehrsmittel) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                Bitte laden Sie Ihr Ticket als Beleg in Schritt 5 hoch und geben Sie den Betrag unter "Weitere Kosten" ein.
              </div>
            )}

            <p className="text-xs text-credo-500">
              Pauschale: PKW 0,30 EUR/km, Motorrad 0,20 EUR/km.
            </p>
          </div>
        )}

        {/* Step 4: Verpflegung */}
        {currentStep === 3 && (
          <VerpflegungStep reisetage={reisetage} onChange={setReisetage} auslandsTagessatz24h={aktivesAuslandsLand?.tagessatz24h} />
        )}

        {/* Step 5: Weitere Kosten & Belege */}
        {currentStep === 4 && (
          <div className="space-y-5">
            {/* Weitere Kosten */}
            {weitereKosten.map((kosten, index) => (
              <div key={index} className="border border-credo-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-credo-700">Kosten {index + 1}</span>
                  <button
                    onClick={() => removeWeitereKosten(index)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Entfernen
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Art</label>
                    <select
                      className="input-field"
                      value={kosten.typ}
                      onChange={e => updateWeitereKosten(index, 'typ', e.target.value)}
                    >
                      <option value="">Wählen...</option>
                      {WEITERE_KOSTEN_TYPEN.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Beschreibung</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="z.B. Parkhaus Köln"
                      value={kosten.beschreibung}
                      onChange={e => updateWeitereKosten(index, 'beschreibung', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Betrag (brutto)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field"
                      placeholder="0,00"
                      value={kosten.betrag || ''}
                      onChange={e => updateWeitereKosten(index, 'betrag', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button onClick={addWeitereKosten} className="btn-secondary w-full">
              + Weitere Kosten hinzufügen
            </button>

            {weitereKostenSumme > 0 && (
              <div className="bg-credo-50 rounded-lg p-3 flex justify-between">
                <span className="text-sm text-credo-600">Summe weitere Kosten</span>
                <span className="font-semibold">{formatCurrency(weitereKostenSumme)}</span>
              </div>
            )}

            {/* Beleg-Upload */}
            <div className="border-t border-credo-200 pt-5 mt-5">
              <BelegUpload dateien={belege} onChange={setBelege} label="Belege hochladen" />
            </div>

            {/* § 14 UStG Hinweis */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
              <p className="font-semibold mb-1">Was sollte auf Ihrem Beleg stehen?</p>
              <p>Ihr Beleg sollte enthalten: Wer hat die Rechnung ausgestellt? Datum, Art der Leistung und Betrag. Bei Beträgen über 250 EUR werden ggf. zusätzliche Angaben benötigt — laden Sie den Beleg trotzdem hoch.</p>
            </div>
          </div>
        )}

        {/* Step 6: Zusammenfassung */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800 font-medium">
                Bitte prüfen Sie alle Angaben sorgfältig. Nach dem Einreichen können keine Änderungen mehr vorgenommen werden.
              </p>
            </div>

            {/* Persönliche Daten */}
            <div className="bg-credo-50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="text-credo-500">Name:</span> <span className="font-medium">{persoenlich.vorname} {persoenlich.nachname}</span></p>
              <p><span className="text-credo-500">Personalnr.:</span> <span className="font-medium">{persoenlich.personalNr}</span></p>
              <p><span className="text-credo-500">Anlass:</span> <span className="font-medium">{reiseanlass}</span></p>
              <p><span className="text-credo-500">Ziel:</span> <span className="font-medium">{reiseziel}</span></p>
            </div>

            {/* Beträge */}
            <div className="space-y-2">
              {kmBetrag > 0 && (
                <div className="flex justify-between py-2 border-b border-credo-100">
                  <span className="text-credo-500">Fahrkosten ({kmGefahren} km × {verkehrsmittel === 'PKW' ? '0,30' : '0,20'} EUR)</span>
                  <span className="font-medium">{formatCurrency(kmBetrag)}</span>
                </div>
              )}
              {vmaGesamt > 0 && (
                <div className="flex justify-between py-2 border-b border-credo-100">
                  <span className="text-credo-500">Verpflegungsmehraufwand ({reisetage.length} {reisetage.length === 1 ? 'Tag' : 'Tage'})</span>
                  <span className="font-medium">{formatCurrency(vmaGesamt)}</span>
                </div>
              )}
              {weitereKostenSumme > 0 && (
                <div className="flex justify-between py-2 border-b border-credo-100">
                  <span className="text-credo-500">Weitere Kosten</span>
                  <span className="font-medium">{formatCurrency(weitereKostenSumme)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t-2 border-credo-900">
                <span className="text-lg font-bold text-credo-900">Gesamtbetrag</span>
                <span className="text-lg font-bold text-credo-900">{formatCurrency(gesamtbetrag)}</span>
              </div>
            </div>

            {/* Bankdaten */}
            <div className="bg-credo-50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="text-credo-500">Kontoinhaber:</span> <span className="font-medium">{persoenlich.kontoinhaber}</span></p>
              <p><span className="text-credo-500">IBAN:</span> <span className="font-medium font-mono">{formatIBAN(persoenlich.iban)}</span></p>
            </div>

            {/* Belege */}
            {belege.length > 0 && (
              <div className="text-sm">
                <p className="text-credo-500 mb-1">{belege.length} Beleg{belege.length > 1 ? 'e' : ''} angehängt</p>
              </div>
            )}

            {/* Unterschrift */}
            <SignaturPad onSignature={setUnterschrift} value={unterschrift} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => { setErrors({}); setCurrentStep(Math.max(0, currentStep - 1)); }}
          disabled={currentStep === 0}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button onClick={handleWeiter} className="btn-primary">
            Weiter
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        ) : (
          <div className="flex flex-col items-end gap-1">
            {currentStep === STEPS.length - 1 && !unterschrift && (
              <p className="text-xs text-red-500">Bitte unterschreiben Sie zuerst</p>
            )}
            <button
              onClick={handleEinreichen}
              disabled={submitting || !unterschrift}
              className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span>Wird eingereicht...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Verbindlich einreichen
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
