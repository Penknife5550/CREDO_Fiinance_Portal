import { Outlet, Link, useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { getToken } from '@/lib/adminAuth';

export function Layout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-credo-50 flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded focus:shadow-lg">
        Zum Hauptinhalt springen
      </a>
      {/* Header */}
      <header className="bg-white border-b border-credo-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/credo_logo.svg"
                alt="CREDO"
                className="h-8"
              />
              <div className="hidden sm:block border-l border-credo-200 pl-3">
                <h1 className="text-sm font-semibold text-credo-700 leading-tight">Finanzportal</h1>
                <p className="text-xs text-credo-500">Reisekosten & Erstattungen</p>
              </div>
            </Link>

            <Link
              to="/admin"
              className={`p-2 rounded-lg transition-colors ${
                isAdmin
                  ? 'bg-credo-100 text-credo-700'
                  : 'text-credo-400 hover:text-credo-600 hover:bg-credo-50'
              }`}
              title="AdminCenter"
              aria-label="Admin-Bereich öffnen"
            >
              <Settings className="w-5 h-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-credo-200 bg-credo-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <img
              src="/credo_logo_weiss.svg"
              alt="CREDO"
              className="h-5 opacity-60"
            />
            <p className="text-xs text-credo-500">
              Nur für den internen Gebrauch — Freie Evangelische Schulen
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
