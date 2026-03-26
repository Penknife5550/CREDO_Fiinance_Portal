import { useParams, Link } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export function Erfolg() {
  const { belegNr } = useParams();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-emerald-600" />
      </div>

      <h2 className="text-2xl font-bold text-credo-900 mb-2">
        Erfolgreich eingereicht!
      </h2>

      <p className="text-credo-500 mb-2 max-w-md">
        Ihre Einreichung wurde an die zuständige Buchhaltung weitergeleitet
        und wird dort bearbeitet.
      </p>
      <p className="text-sm text-credo-600 mb-6 max-w-md">
        Ihre Einreichung wird in der Regel innerhalb von 5 Werktagen bearbeitet.
        Bei Fragen wenden Sie sich bitte an die Buchhaltung.
      </p>

      <div className="card inline-block mb-8">
        <p className="text-sm text-credo-500 mb-1">Ihre Belegnummer</p>
        <p className="text-2xl font-bold font-mono text-credo-900">{belegNr}</p>
      </div>

      <p className="text-xs text-credo-400 mb-8 max-w-sm">
        Bitte notieren Sie sich die Belegnummer für eventuelle Rückfragen.
        Ein PDF mit allen Angaben wurde automatisch an die Buchhaltung gesendet.
      </p>

      <Link to="/" className="btn-primary">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Zurück zur Startseite
      </Link>
    </div>
  );
}
