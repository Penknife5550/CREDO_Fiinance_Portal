import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import { PersoenlicheDatenStep } from '@/components/forms/PersoenlicheDatenStep';
import { FahrtenListe } from '@/components/forms/FahrtenListe';
import { BelegUpload } from '@/components/forms/BelegUpload';
import { SignaturPad } from '@/components/forms/SignaturPad';
import { formatCurrency, formatIBAN, validateIBAN } from '@/lib/utils';
import { einreichenSammelfahrt } from '@/lib/api';
import { berechneFahrtenSummen, satzFuer } from '@/lib/sammelfahrt';
import type { PersoenlicheDaten, Fahrt, SammelfahrtVerkehrsmittel } from '@/lib/types';

const STEPS = ['Persönliche Daten', 'Fahrten', 'Zusammenfassung'];

const INITIAL_PERSOENLICH: PersoenlicheDaten = {
  vorname: '', nachname: '', personalNr: '',
  iban: '', kontoinhaber: '',
  mandantId: '', kostenstelleId: '',
};

const NEUE_FAHRT: Fahrt = { datum: '', startOrt: '', ziel: '', km: 0, kmBetrag: 0 };

export function SammelfahrtFormular() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [persoenlich, setPersoenlich] = useState<PersoenlicheDaten>(INITIAL_PERSOENLICH);
  const [reiseanlass, setReiseanlass] = useState('');
  const [verkehrsmittel, setVerkehrsmittel] = useState<SammelfahrtVerkehrsmittel>('PKW');
  const [defaultStartOrt, setDefaultStartOrt] = useState('');
  const [fahrten, setFahrten] = useState<Fahrt[]>([{ ...NEUE_FAHRT }, { ...NEUE_FAHRT }]);
  const [belege, setBelege] = useState<File[]>([]);
  const [unterschrift, setUnterschrift] = useState<string | undefined>();

  // Beträge live ableiten — Single Source of Truth, kein zusätzlicher Effect-Sync.
  const { kmSumme, gesamtbetrag, fahrten: fahrtenMitBetrag } = useMemo(
    () => berechneFahrtenSummen(fahrten, verkehrsmittel),
    [fahrten, verkehrsmittel],
  );

  // Datenverlust-Warnung
  const hasData = persoenlich.vorname || persoenlich.nachname || reiseanlass || fahrten.some(f => f.datum || f.ziel || f.km > 0);
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasData) e.preventDefault();
  }, [hasData]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 0) {
      if (!persoenlich.vorname.trim()) errs.vorname = 'Pflichtfeld';
      if (!persoenlich.nachname.trim()) errs.nachname = 'Pflichtfeld';
      if (!persoenlich.iban || !validateIBAN(persoenlich.iban)) errs.iban = 'Gültige deutsche IBAN erforderlich';
      if (!persoenlich.kontoinhaber.trim()) errs.kontoinhaber = 'Pflichtfeld';
      if (!persoenlich.mandantId) errs.mandantId = 'Bitte wählen';
    }

    if (step === 1) {
      if (reiseanlass.trim().length < 10) errs.reiseanlass = 'Mindestens 10 Zeichen';
      if (fahrten.length < 2) errs.fahrten = 'Bitte mindestens 2 Fahrten erfassen';
      fahrten.forEach((f, i) => {
        if (!f.datum) errs[`fahrt_${i}_datum`] = 'Pflicht';
        if (!f.startOrt.trim()) errs[`fahrt_${i}_startOrt`] = 'Pflicht';
        if (!f.ziel.trim()) errs[`fahrt_${i}_ziel`] = 'Pflicht';
        if (!f.km || f.km <= 0) errs[`fahrt_${i}_km`] = 'km > 0';
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
      const result = await einreichenSammelfahrt({
        persoenlich,
        reiseanlass,
        verkehrsmittel,
        fahrten: fahrtenMitBetrag,
        kmSumme,
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

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-credo-500 hover:text-credo-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Auswahl
      </Link>

      <h2 className="text-2xl font-bold text-credo-900 mb-6">Fahrtkostensammelantrag</h2>

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
                <div className={`w-16 sm:w-32 lg:w-48 h-0.5 mx-2 ${index < currentStep ? 'bg-emerald-500' : 'bg-credo-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="sm:hidden mb-2">
          <p className="text-sm font-medium text-credo-700 mb-2">Schritt {currentStep + 1} von {STEPS.length}</p>
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
          <PersoenlicheDatenStep data={persoenlich} onChange={setPersoenlich} errors={errors} vorgangstyp="sammelfahrt" />
        )}

        {/* Step 2: Anlass + Verkehrsmittel + Fahrten */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <label className="label">Anlass *</label>
              <input
                type="text"
                className={`input-field ${errors.reiseanlass ? 'border-red-400' : ''}`}
                placeholder="z.B. Praktikumsbesuche Frühjahr 2026"
                value={reiseanlass}
                onChange={e => setReiseanlass(e.target.value)}
              />
              {errors.reiseanlass && <p className="text-xs text-red-500 mt-1">{errors.reiseanlass}</p>}
            </div>

            <fieldset>
              <legend className="label">Verkehrsmittel *</legend>
              <div className="grid grid-cols-2 gap-3 mt-1">
                {(['PKW', 'MOTORRAD'] as const).map(v => (
                  <label
                    key={v}
                    className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-credo-500 focus-within:ring-offset-1 ${
                      verkehrsmittel === v
                        ? 'border-credo-600 bg-credo-50'
                        : 'border-credo-200 hover:border-credo-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="verkehrsmittel"
                        className="w-4 h-4 text-credo-600"
                        checked={verkehrsmittel === v}
                        onChange={() => setVerkehrsmittel(v)}
                      />
                      <span className="text-sm font-medium text-credo-800">{v === 'PKW' ? 'PKW' : 'Motorrad'}</span>
                    </div>
                    <span className="text-xs font-mono text-credo-500">
                      {satzFuer(v).toFixed(2).replace('.', ',')} EUR/km
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="label">
                Üblicher Abfahrtsort <span className="text-credo-500 font-normal">(optional, wird in jede neue Fahrt vorausgefüllt)</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="z.B. Wohnung Minden"
                value={defaultStartOrt}
                onChange={e => setDefaultStartOrt(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-credo-700 mb-3">Ihre Fahrten</h3>
              {errors.fahrten && <p className="text-xs text-red-500 mb-2">{errors.fahrten}</p>}
              <FahrtenListe
                fahrten={fahrtenMitBetrag}
                onChange={setFahrten}
                verkehrsmittel={verkehrsmittel}
                defaultStartOrt={defaultStartOrt}
                errors={errors}
              />
            </div>

            <div className="border-t border-credo-200 pt-5">
              <BelegUpload dateien={belege} onChange={setBelege} label="Optionale Belege (z.B. Praktikantenliste, Tankquittungen)" />
            </div>

            <div className="bg-credo-50 border border-credo-200 rounded-lg p-3 text-xs text-credo-600">
              Sammelfahrten enthalten <strong>keine Verpflegungspauschale</strong> — jede Fahrt wird als Tagesfahrt unter 8 Stunden gewertet. Falls Sie eine längere Dienstreise mit Verpflegungsmehraufwand abrechnen möchten, nutzen Sie bitte die normale <Link to="/reisekosten" className="underline">Reisekostenabrechnung</Link>.
            </div>
          </div>
        )}

        {/* Step 3: Zusammenfassung + Unterschrift */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800 font-medium">
                Bitte prüfen Sie alle Angaben sorgfältig. Nach dem Einreichen können keine Änderungen mehr vorgenommen werden.
              </p>
            </div>

            <div className="bg-credo-50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="text-credo-500">Name:</span> <span className="font-medium">{persoenlich.vorname} {persoenlich.nachname}</span></p>
              <p><span className="text-credo-500">Personalnr.:</span> <span className="font-medium">{persoenlich.personalNr || '—'}</span></p>
              <p><span className="text-credo-500">Anlass:</span> <span className="font-medium">{reiseanlass}</span></p>
              <p><span className="text-credo-500">Verkehrsmittel:</span> <span className="font-medium">{verkehrsmittel === 'PKW' ? 'PKW' : 'Motorrad'} ({satzFuer(verkehrsmittel).toFixed(2).replace('.', ',')} EUR/km)</span></p>
            </div>

            <div className="border border-credo-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-credo-50 text-xs">
                  <tr>
                    <th scope="col" className="text-left p-2.5 font-medium text-credo-700">Datum</th>
                    <th scope="col" className="text-left p-2.5 font-medium text-credo-700">Von</th>
                    <th scope="col" className="text-left p-2.5 font-medium text-credo-700">Nach</th>
                    <th scope="col" className="text-right p-2.5 font-medium text-credo-700">km</th>
                    <th scope="col" className="text-right p-2.5 font-medium text-credo-700">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {fahrtenMitBetrag.map((f, i) => (
                    <tr key={i} className={`border-t border-credo-100 ${i % 2 === 0 ? '' : 'bg-credo-50/30'}`}>
                      <td className="p-2.5 text-credo-700">{f.datum}</td>
                      <td className="p-2.5 text-credo-700">{f.startOrt}</td>
                      <td className="p-2.5 text-credo-700">{f.ziel}</td>
                      <td className="p-2.5 text-right font-mono">{f.km.toFixed(2).replace('.', ',')}</td>
                      <td className="p-2.5 text-right font-medium">{formatCurrency(f.kmBetrag)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-credo-100 text-sm">
                <span className="text-credo-500">Gesamt-Kilometer</span>
                <span className="font-mono">{kmSumme.toFixed(2).replace('.', ',')} km</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-credo-900">
                <span className="text-lg font-bold text-credo-900">Gesamtbetrag</span>
                <span className="text-lg font-bold text-credo-900">{formatCurrency(gesamtbetrag)}</span>
              </div>
            </div>

            <div className="bg-credo-50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="text-credo-500">Kontoinhaber:</span> <span className="font-medium">{persoenlich.kontoinhaber}</span></p>
              <p><span className="text-credo-500">IBAN:</span> <span className="font-medium font-mono">{formatIBAN(persoenlich.iban)}</span></p>
            </div>

            {belege.length > 0 && (
              <div className="text-sm">
                <p className="text-credo-500">{belege.length} Beleg{belege.length > 1 ? 'e' : ''} angehängt</p>
              </div>
            )}

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
            {!unterschrift && (
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
