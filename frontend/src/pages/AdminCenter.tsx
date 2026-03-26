import { useState, useEffect } from 'react';
import { Building2, DollarSign, Mail, Activity, Plus, Edit, ToggleLeft, LogOut, Lock, Save } from 'lucide-react';
import { adminLogin, adminLogout, checkSession } from '@/lib/adminAuth';

const TABS = [
  { id: 'mandanten', label: 'Mandanten', icon: Building2 },
  { id: 'pauschalen', label: 'Pauschalen', icon: DollarSign },
  { id: 'versand', label: 'Versand & Integration', icon: Mail },
  { id: 'protokoll', label: 'Protokoll', icon: Activity },
];

const DEMO_MANDANTEN = [
  { nr: 10, name: 'Grundschule Haddenhausen', kategorie: 'Grundschulen', dmsEmail: 'fibu-gs-haddenhausen@docubit.credo.de', farbe: '#2563EB', aktiv: true },
  { nr: 11, name: 'Grundschule Stemwede', kategorie: 'Grundschulen', dmsEmail: 'fibu-gs-stemwede@docubit.credo.de', farbe: '#2563EB', aktiv: true },
  { nr: 12, name: 'Grundschule Minderheide', kategorie: 'Grundschulen', dmsEmail: 'fibu-gs-minderheide@docubit.credo.de', farbe: '#2563EB', aktiv: true },
  { nr: 30, name: 'Gesamtschule', kategorie: 'Weiterführende Schulen', dmsEmail: 'fibu-gesamtschule@docubit.credo.de', farbe: '#059669', aktiv: true },
  { nr: 31, name: 'Gymnasium', kategorie: 'Weiterführende Schulen', dmsEmail: 'fibu-gymnasium@docubit.credo.de', farbe: '#DC2626', aktiv: true },
  { nr: 32, name: 'Berufskolleg', kategorie: 'Weiterführende Schulen', dmsEmail: 'fibu-berufskolleg@docubit.credo.de', farbe: '#7C3AED', aktiv: true },
  { nr: 40, name: 'CREDO Verwaltung', kategorie: 'Verwaltung', dmsEmail: 'fibu-verwaltung@docubit.credo.de', farbe: '#6B7280', aktiv: true },
];

export function AdminCenter() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('mandanten');

  useEffect(() => {
    checkSession().then(ok => {
      setAuthenticated(ok);
      setChecking(false);
    });
  }, []);

  const handleLogout = async () => {
    await adminLogout();
    setAuthenticated(false);
  };

  if (checking) {
    return <div className="text-center py-20 text-credo-500">Prüfe Anmeldung...</div>;
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-credo-900">AdminCenter</h2>
        <button onClick={handleLogout} className="btn-secondary text-sm py-2">
          <LogOut className="w-4 h-4 mr-1.5" />
          Abmelden
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-credo-100 rounded-lg p-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-white text-credo-900 shadow-sm'
                : 'text-credo-500 hover:text-credo-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'mandanten' && <MandantenTab />}
      {activeTab === 'pauschalen' && <PauschalenTab />}
      {activeTab === 'versand' && <VersandTab />}
      {activeTab === 'protokoll' && <ProtokollTab />}
    </div>
  );
}

// ── Admin Login ────────────────────────────────────────

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler('');
    setLoading(true);

    try {
      await adminLogin(email, passwort);
      onSuccess();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-credo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-credo-600" />
          </div>
          <h2 className="text-xl font-bold text-credo-900">AdminCenter</h2>
          <p className="text-sm text-credo-500 mt-1">Anmeldung erforderlich</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">E-Mail</label>
            <input
              type="email"
              className="input-field"
              placeholder="admin@credo.de"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={passwort}
              onChange={e => setPasswort(e.target.value)}
              required
            />
          </div>

          {fehler && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {fehler}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Mandanten Tab ──────────────────────────────────────

function MandantenTab() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-credo-900">Mandanten & DMS-E-Mail</h3>
        <button className="btn-primary text-sm py-2">
          <Plus className="w-4 h-4 mr-1.5" />
          Mandant anlegen
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-credo-50 border-b border-credo-200">
            <tr>
              <th className="text-left p-3 font-medium text-credo-700">Nr.</th>
              <th className="text-left p-3 font-medium text-credo-700">Farbe</th>
              <th className="text-left p-3 font-medium text-credo-700">Name</th>
              <th className="text-left p-3 font-medium text-credo-700">Kategorie</th>
              <th className="text-left p-3 font-medium text-credo-700">DMS-E-Mail</th>
              <th className="text-center p-3 font-medium text-credo-700">Aktiv</th>
              <th className="text-right p-3 font-medium text-credo-700">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_MANDANTEN.map((m, i) => (
              <tr key={m.nr} className={`border-b border-credo-100 ${i % 2 === 0 ? '' : 'bg-credo-50/50'}`}>
                <td className="p-3 font-mono font-medium">{m.nr}</td>
                <td className="p-3"><div className="w-6 h-6 rounded-full" style={{ backgroundColor: m.farbe }} /></td>
                <td className="p-3 font-medium text-credo-900">{m.name}</td>
                <td className="p-3 text-credo-500">{m.kategorie}</td>
                <td className="p-3 font-mono text-xs text-credo-600">{m.dmsEmail}</td>
                <td className="p-3 text-center">
                  <span className={`inline-block w-3 h-3 rounded-full ${m.aktiv ? 'bg-emerald-500' : 'bg-red-400'}`} />
                </td>
                <td className="p-3 text-right">
                  <button className="text-credo-400 hover:text-credo-600 p-1"><Edit className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pauschalen Tab (editierbar) ────────────────────────

function PauschalenTab() {
  const [editing, setEditing] = useState(false);
  const [pauschalen, setPauschalen] = useState({
    kmPkw: '0,30',
    kmMotorrad: '0,20',
    vma8h: '14,00',
    vma24h: '28,00',
    vmaAnreisetag: '14,00',
    kuerzungFruehstueck: '20',
    kuerzungMittag: '40',
    kuerzungAbend: '40',
  });

  const updatePauschale = (key: keyof typeof pauschalen, value: string) => {
    setPauschalen({ ...pauschalen, [key]: value });
  };

  const handleSave = () => {
    // TODO: API-Call PUT /api/admin/pauschalen
    setEditing(false);
    alert('Pauschalen gespeichert');
  };

  return (
    <div className="space-y-6">
      {/* Inlandspauschalen */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-credo-900">Inlandspauschalen 2026</h3>
          {editing ? (
            <button onClick={handleSave} className="btn-primary text-sm py-2">
              <Save className="w-4 h-4 mr-1.5" />
              Speichern
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm py-2">
              <Edit className="w-4 h-4 mr-1.5" />
              Bearbeiten
            </button>
          )}
        </div>

        <div className="space-y-3">
          <PauschaleRow label="Kilometerpauschale PKW" value={pauschalen.kmPkw} suffix="EUR/km" editing={editing} onChange={v => updatePauschale('kmPkw', v)} />
          <PauschaleRow label="Kilometerpauschale Motorrad" value={pauschalen.kmMotorrad} suffix="EUR/km" editing={editing} onChange={v => updatePauschale('kmMotorrad', v)} />
          <PauschaleRow label="VMA > 8h (eintägig)" value={pauschalen.vma8h} suffix="EUR" editing={editing} onChange={v => updatePauschale('vma8h', v)} />
          <PauschaleRow label="VMA 24h (Ganztag)" value={pauschalen.vma24h} suffix="EUR" editing={editing} onChange={v => updatePauschale('vma24h', v)} />
          <PauschaleRow label="VMA An-/Abreisetag" value={pauschalen.vmaAnreisetag} suffix="EUR" editing={editing} onChange={v => updatePauschale('vmaAnreisetag', v)} />
          <PauschaleRow label="Kürzung Frühstück" value={pauschalen.kuerzungFruehstueck} suffix="%" editing={editing} onChange={v => updatePauschale('kuerzungFruehstueck', v)} />
          <PauschaleRow label="Kürzung Mittagessen" value={pauschalen.kuerzungMittag} suffix="%" editing={editing} onChange={v => updatePauschale('kuerzungMittag', v)} />
          <PauschaleRow label="Kürzung Abendessen" value={pauschalen.kuerzungAbend} suffix="%" editing={editing} onChange={v => updatePauschale('kuerzungAbend', v)} />
        </div>
      </div>

      {/* Auslandspauschalen */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-credo-900">Auslandspauschalen (BMF)</h3>
          <button className="btn-secondary text-sm py-2">
            <Plus className="w-4 h-4 mr-1.5" />
            Land hinzufügen
          </button>
        </div>

        <div className="border border-credo-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-credo-50">
              <tr>
                <th className="text-left p-3 font-medium text-credo-700">Land</th>
                <th className="text-right p-3 font-medium text-credo-700">Tagessatz &gt;8h</th>
                <th className="text-right p-3 font-medium text-credo-700">Tagessatz 24h</th>
                <th className="text-right p-3 font-medium text-credo-700">Übernachtung</th>
                <th className="text-right p-3 font-medium text-credo-700">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {[
                { land: 'Österreich', t8h: '27,00', t24h: '40,00', ueb: '105,00' },
                { land: 'Schweiz', t8h: '43,00', t24h: '64,00', ueb: '180,00' },
                { land: 'Niederlande', t8h: '32,00', t24h: '47,00', ueb: '125,00' },
                { land: 'Frankreich', t8h: '39,00', t24h: '58,00', ueb: '148,00' },
              ].map((row, i) => (
                <tr key={row.land} className={`border-t border-credo-100 ${i % 2 ? 'bg-credo-50/30' : ''}`}>
                  <td className="p-3 font-medium text-credo-900">{row.land}</td>
                  <td className="p-3 text-right font-mono">{row.t8h} EUR</td>
                  <td className="p-3 text-right font-mono">{row.t24h} EUR</td>
                  <td className="p-3 text-right font-mono">{row.ueb} EUR</td>
                  <td className="p-3 text-right">
                    <button className="text-credo-400 hover:text-credo-600 p-1"><Edit className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-credo-400 mt-2">
          Basierend auf den BMF-Pauschalen. CSV-Import für jährliche Aktualisierung geplant.
        </p>
      </div>
    </div>
  );
}

function PauschaleRow({ label, value, suffix, editing, onChange }: {
  label: string; value: string; suffix: string; editing: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-credo-100 last:border-0">
      <span className="text-credo-600">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input-field w-24 text-right py-1.5 px-2 font-mono"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
          <span className="text-xs text-credo-400 w-10">{suffix}</span>
        </div>
      ) : (
        <span className="font-medium font-mono">{value} {suffix}</span>
      )}
    </div>
  );
}

// ── Versand Tab ────────────────────────────────────────

function VersandTab() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-credo-900 mb-4">E-Mail-Konfiguration</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Versandmethode</label>
            <select className="input-field">
              <option value="SMTP">SMTP (beliebiger Mailserver)</option>
              <option value="MS365">Microsoft 365 (Graph API)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">SMTP-Server</label>
              <input type="text" className="input-field" placeholder="smtp.office365.com" />
            </div>
            <div>
              <label className="label">Port</label>
              <input type="number" className="input-field" placeholder="587" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Benutzer</label>
              <input type="text" className="input-field" placeholder="finanzportal@credo.de" />
            </div>
            <div>
              <label className="label">Passwort</label>
              <input type="password" className="input-field" placeholder="••••••••" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Absender-Name</label>
              <input type="text" className="input-field" defaultValue="CREDO Finanzportal" />
            </div>
            <div>
              <label className="label">Absender-E-Mail</label>
              <input type="email" className="input-field" defaultValue="finanzportal@credo.de" />
            </div>
          </div>
          <button className="btn-primary text-sm py-2">Test-E-Mail senden</button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-credo-900 mb-4">Retry & Fehlerbehandlung</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Max. Versuche</label>
            <input type="number" className="input-field" defaultValue="3" />
          </div>
          <div>
            <label className="label">Fehler-Benachrichtigung an</label>
            <input type="email" className="input-field" placeholder="admin@credo.de" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-credo-900">Webhook (optional)</h3>
          <button className="flex items-center gap-2 text-sm text-credo-500">
            <ToggleLeft className="w-5 h-5" />
            Deaktiviert
          </button>
        </div>
        <div className="space-y-4 opacity-50">
          <div>
            <label className="label">Webhook-URL</label>
            <input type="url" className="input-field" placeholder="https://n8n.credo.de/webhook/..." disabled />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Protokoll Tab ──────────────────────────────────────

function ProtokollTab() {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-credo-900 mb-4">Versand-Log</h3>
      <p className="text-credo-500 text-sm">Noch keine Einreichungen vorhanden.</p>
    </div>
  );
}
