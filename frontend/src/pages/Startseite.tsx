import { useNavigate } from 'react-router-dom';
import { Car, Receipt, MapPin, Tent, type LucideIcon } from 'lucide-react';

interface KartenAuswahl {
  pfad: string;
  icon: LucideIcon;
  titel: string;
  beschreibung: string;
  beispiel: string;
  akzent: string; // CREDO-Akzentfarbe als HEX
}

const KARTEN: KartenAuswahl[] = [
  {
    pfad: '/reisekosten',
    icon: Car,
    titel: 'Reisekostenabrechnung',
    beschreibung: 'Einzelne Dienstreise mit Fahrtkosten, Verpflegung und ggf. Übernachtung.',
    beispiel: 'z. B. Konferenz in Köln, Fortbildung in Berlin',
    akzent: '#FBC900', // CREDO-Gelb
  },
  {
    pfad: '/erstattung',
    icon: Receipt,
    titel: 'Kostenerstattung',
    beschreibung: 'Auslagen für Material, Bürobedarf, Fachliteratur oder Sonstiges.',
    beispiel: 'z. B. Schulmaterial, Fachbuch, Tablet-Hülle',
    akzent: '#6BAA24', // CREDO-Grün
  },
  {
    pfad: '/sammelfahrt',
    icon: MapPin,
    titel: 'Sammelfahrten',
    beschreibung: 'Mehrere wiederkehrende Tagesfahrten zusammenfassen — nur Kilometerpauschale, ohne Verpflegung. Mindestens zwei Fahrten.',
    beispiel: 'z. B. wöchentliche Praktikumsbesuche',
    akzent: '#009AC6', // CREDO-Blau
  },
  {
    pfad: '/klassenfahrt',
    icon: Tent,
    titel: 'Klassenfahrt',
    beschreibung: 'Klassenfahrt abrechnen und den Förderverein-Zuschuss je Klasse berechnen — Auszahlung getrennt je Klassenkonto.',
    beispiel: 'z. B. Jahrgangsfahrt Klasse 6 nach Willingen',
    akzent: '#DC2626', // CREDO-Rot
  },
];

export function Startseite() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-16 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-credo-900 tracking-tight mb-4">
          Finanzportal
        </h1>
        <p className="text-lg sm:text-xl text-credo-500 font-light">
          Was möchten Sie einreichen?
        </p>
      </div>

      {/* Auswahl-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
        {KARTEN.map(karte => {
          const Icon = karte.icon;
          return (
            <button
              key={karte.pfad}
              onClick={() => navigate(karte.pfad)}
              className="group relative bg-white rounded-2xl text-left p-8 sm:p-10
                         border border-credo-100
                         shadow-[0_1px_3px_rgba(0,0,0,0.04)]
                         hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]
                         hover:-translate-y-1
                         transition-all duration-300 ease-out
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-credo-600 focus-visible:ring-offset-2
                         overflow-hidden"
            >
              {/* Akzent-Strich oben */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: karte.akzent }}
                aria-hidden="true"
              />

              {/* Icon */}
              <Icon
                className="w-9 h-9 text-credo-700 mb-6 transition-transform duration-300 ease-out group-hover:scale-110"
                strokeWidth={1.5}
                aria-hidden="true"
              />

              {/* Titel */}
              <h2 className="text-xl font-semibold text-credo-900 mb-2 tracking-tight">
                {karte.titel}
              </h2>

              {/* Beschreibung */}
              <p className="text-sm text-credo-600 leading-relaxed mb-3">
                {karte.beschreibung}
              </p>

              {/* Beispiel */}
              <p className="text-xs text-credo-400 italic">
                {karte.beispiel}
              </p>
            </button>
          );
        })}
      </div>

      {/* Entscheidungshilfe */}
      <p className="mt-10 text-sm text-credo-500 text-center">
        Einzelne Konferenz oder Fortbildung? →{' '}
        <button
          type="button"
          onClick={() => navigate('/reisekosten')}
          className="text-credo-700 underline underline-offset-2 hover:text-credo-900 transition-colors"
        >
          Reisekostenabrechnung
        </button>
      </p>

      {/* Beleg-Hinweis */}
      <p className="mt-12 text-xs text-credo-400 text-center max-w-md">
        Ihre Einreichung wird direkt an die zuständige Buchhaltung weitergeleitet.
        Sie benötigen Ihre Personalnummer, IBAN und die zugehörigen Belege.
      </p>
    </div>
  );
}
