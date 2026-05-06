import { useState, useEffect } from 'react';
import { useUnsavedWarning } from '@/lib/hooks';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { PersoenlicheDatenStep } from '@/components/forms/PersoenlicheDatenStep';
import { BelegUpload } from '@/components/forms/BelegUpload';
import { SignaturPad } from '@/components/forms/SignaturPad';
import { formatCurrency, formatIBAN, validateIBAN, parseGermanDecimal } from '@/lib/utils';
import { einreichenErstattung } from '@/lib/api';
import type { PersoenlicheDaten, ErstattungPosition } from '@/lib/types';
import { ERSTATTUNG_KATEGORIEN } from '@/lib/types';

const STEPS = ['Persönliche Daten', 'Positionen & Belege', 'Zusammenfassung'];

const INITIAL_PERSOENLICH: PersoenlicheDaten = {
  vorname: '', nachname: '', personalNr: '',
  iban: '', kontoinhaber: '',
  mandantId: '', kostenstelleId: '',
};

const EMPTY_POSITION: ErstattungPosition = {
  beschreibung: '', kategorie: '', datum: '', betrag: 0,
};

export function ErstattungFormular() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [persoenlich, setPersoenlich] = useState<PersoenlicheDaten>(INITIAL_PERSOENLICH);
  const [positionen, setPositionen] = useState<ErstattungPosition[]>([{ ...EMPTY_POSITION }]);
  const [belege, setBelege] = useState<File[]>([]);
  const [unterschrift, setUnterschrift] = useState<string | undefined>();

  const gesamt = positionen.reduce((sum, p) => sum + (p.betrag || 0), 0);

  // Warnung bei Datenverlust (Browser-Reload / Schliessen)
  const hasData = !!(persoenlich.vorname || persoenlich.nachname || positionen.some(p => p.beschreibung));
  useUnsavedWarning(hasData);

  // ── Positionen-Verwaltung ──────────────────────────
  const addPosition = () => setPositionen([...positionen, { ...EMPTY_POSITION }]);

  const updatePosition = (index: number, field: keyof ErstattungPosition, value: string | number) => {
    setPositionen(positionen.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removePosition = (index: number) => {
    if (positionen.length > 1) setPositionen(positionen.filter((_, i) => i !== index));
  };

  // ── Validierung ────────────────────────────────────
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
      positionen.forEach((pos, i) => {
        if (pos.beschreibung.trim().length < 5) errs[`pos_${i}_beschreibung`] = 'Mindestens 5 Zeichen';
        if (!pos.kategorie) errs[`pos_${i}_kategorie`] = 'Bitte wählen';
        if (!pos.datum) errs[`pos_${i}_datum`] = 'Pflichtfeld';
        if (!pos.betrag || pos.betrag <= 0) errs[`pos_${i}_betrag`] = 'Betrag > 0';
      });
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleWeiter = () => {
    if (validateStep(currentStep)) setCurrentStep(currentStep + 1);
  };

  const handleEinreichen = async () => {
    setSubmitting(true);
    try {
      const result = await einreichenErstattung({
        persoenlich,
        positionen,
        gesamtbetrag: gesamt,
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

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-credo-500 hover:text-credo-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Auswahl
      </Link>

      <h2 className="text-2xl font-bold text-credo-900 mb-6">Kostenerstattung</h2>

      {/* Stepper */}
      <div className="mb-8">
        {/* Desktop: Kreise */}
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
                <div className={`w-16 sm:w-32 lg:w-48 h-0.5 mx-2 ${index < currentStep ? 'bg-emerald-500' : 'bg-credo-200'}`} />
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

      <div className="card">
        {/* Step 1: Persönliche Daten */}
        {currentStep === 0 && (
          <PersoenlicheDatenStep data={persoenlich} onChange={setPersoenlich} errors={errors} vorgangstyp="erstattung" />
        )}

        {/* Step 2: Positionen & Belege */}
        {currentStep === 1 && (
          <div className="space-y-5">
            {positionen.map((pos, index) => (
              <div key={index} className="border border-credo-200 rounded-lg p-4 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-credo-700">Position {index + 1}</span>
                  {positionen.length > 1 && (
                    <button onClick={() => removePosition(index)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Beschreibung *</label>
                    <input
                      type="text"
                      className={`input-field ${errors[`pos_${index}_beschreibung`] ? 'border-red-400' : ''}`}
                      placeholder="Was wurde gekauft/bezahlt?"
                      value={pos.beschreibung}
                      onChange={e => updatePosition(index, 'beschreibung', e.target.value)}
                    />
                    {errors[`pos_${index}_beschreibung`] && (
                      <p className="text-xs text-red-500 mt-1">{errors[`pos_${index}_beschreibung`]}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">Kategorie *</label>
                      <select
                        className={`input-field ${errors[`pos_${index}_kategorie`] ? 'border-red-400' : ''}`}
                        value={pos.kategorie}
                        onChange={e => updatePosition(index, 'kategorie', e.target.value)}
                      >
                        <option value="">Wählen...</option>
                        {ERSTATTUNG_KATEGORIEN.map(k => (
                          <option key={k.value} value={k.value}>{k.label}</option>
                        ))}
                      </select>
                      {errors[`pos_${index}_kategorie`] && (
                        <p className="text-xs text-red-500 mt-1">{errors[`pos_${index}_kategorie`]}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">Datum *</label>
                      <input
                        type="date"
                        className={`input-field ${errors[`pos_${index}_datum`] ? 'border-red-400' : ''}`}
                        value={pos.datum}
                        onChange={e => updatePosition(index, 'datum', e.target.value)}
                      />
                      {errors[`pos_${index}_datum`] && (
                        <p className="text-xs text-red-500 mt-1">{errors[`pos_${index}_datum`]}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">Betrag (brutto) *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`input-field ${errors[`pos_${index}_betrag`] ? 'border-red-400' : ''}`}
                        placeholder="0,00"
                        value={pos.betrag || ''}
                        onChange={e => updatePosition(index, 'betrag', parseGermanDecimal(e.target.value))}
                      />
                      {errors[`pos_${index}_betrag`] && (
                        <p className="text-xs text-red-500 mt-1">{errors[`pos_${index}_betrag`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button onClick={addPosition} className="btn-secondary w-full">
              <Plus className="w-4 h-4 mr-2" />
              Weitere Position hinzufügen
            </button>

            {/* Zwischensumme */}
            <div className="bg-credo-50 rounded-lg p-4 flex justify-between items-center">
              <span className="font-medium text-credo-700">
                Zwischensumme ({positionen.length} Position{positionen.length > 1 ? 'en' : ''})
              </span>
              <span className="text-lg font-bold text-credo-900">{formatCurrency(gesamt)}</span>
            </div>

            {/* Belege */}
            <div className="border-t border-credo-200 pt-5 mt-2">
              <BelegUpload dateien={belege} onChange={setBelege} label="Belege hochladen" />
            </div>

            {/* § 14 UStG Hinweis */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
              <p className="font-semibold mb-1">Was sollte auf Ihrem Beleg stehen?</p>
              <p>Ihr Beleg sollte enthalten: Wer hat die Rechnung ausgestellt? Datum, Art der Leistung und Betrag. Bei Beträgen über 250 EUR werden ggf. zusätzliche Angaben benötigt — laden Sie den Beleg trotzdem hoch.</p>
            </div>
          </div>
        )}

        {/* Step 3: Zusammenfassung */}
        {currentStep === 2 && (
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
            </div>

            {/* Positionen */}
            <div className="space-y-2">
              {positionen.map((pos, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-credo-100">
                  <div>
                    <span className="text-credo-700">{pos.beschreibung || `Position ${i + 1}`}</span>
                    <span className="text-xs text-credo-500 ml-2">
                      {ERSTATTUNG_KATEGORIEN.find(k => k.value === pos.kategorie)?.label}
                    </span>
                  </div>
                  <span className="font-medium">{formatCurrency(pos.betrag || 0)}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 border-t-2 border-credo-900">
                <span className="text-lg font-bold text-credo-900">Gesamtbetrag</span>
                <span className="text-lg font-bold text-credo-900">{formatCurrency(gesamt)}</span>
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
                <p className="text-credo-500">{belege.length} Beleg{belege.length > 1 ? 'e' : ''} angehängt</p>
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
              {submitting ? 'Wird eingereicht...' : (
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
