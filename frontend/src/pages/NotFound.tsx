import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="text-center py-16">
      <h2 className="text-4xl font-bold text-credo-900 mb-4">404</h2>
      <p className="text-credo-600 mb-6">Diese Seite wurde nicht gefunden.</p>
      <Link to="/" className="btn-primary inline-flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Startseite
      </Link>
    </div>
  );
}
