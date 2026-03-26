import { useNavigate } from 'react-router-dom';
import { Car, Receipt } from 'lucide-react';

export function Startseite() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      {/* CREDO Logo + Begrüßung */}
      <div className="text-center mb-10">
        <img
          src="/credo_logo_claim.svg"
          alt="CREDO — Glauben. Leben. Lernen."
          className="h-16 sm:h-20 mx-auto mb-6"
        />
        <h2 className="text-3xl font-bold text-credo-900 mb-3">
          Finanzportal
        </h2>
        <p className="text-lg text-credo-500 max-w-md">
          Was möchten Sie einreichen?
        </p>
      </div>

      {/* Auswahl-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Reisekostenabrechnung */}
        <button
          onClick={() => navigate('/reisekosten')}
          className="card-hover group text-left p-8"
        >
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
            <Car className="w-7 h-7 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-credo-900 mb-2">
            Reisekostenabrechnung
          </h3>
          <p className="text-sm text-credo-500 leading-relaxed">
            Dienstreisen mit Fahrtkosten, Verpflegungsmehraufwand und Übernachtung
          </p>
        </button>

        {/* Kostenerstattung */}
        <button
          onClick={() => navigate('/erstattung')}
          className="card-hover group text-left p-8"
        >
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
            <Receipt className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold text-credo-900 mb-2">
            Kostenerstattung
          </h3>
          <p className="text-sm text-credo-500 leading-relaxed">
            Auslagen für Material, Bürobedarf, Fachliteratur und Sonstiges
          </p>
        </button>
      </div>

      {/* Hinweis */}
      <p className="mt-10 text-xs text-credo-500 text-center max-w-md">
        Ihre Einreichung wird direkt an die zuständige Buchhaltung weitergeleitet.
        Sie benötigen Ihre Personalnummer, IBAN und die zugehörigen Belege.
      </p>
    </div>
  );
}
