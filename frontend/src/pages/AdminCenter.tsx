import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Building2, DollarSign, Mail, Activity, Plus, Edit, ToggleLeft, ToggleRight, LogOut, Lock, Save, Trash2, Zap, CheckCircle, XCircle, Loader2, Send, X, Check, Layers, Info, Tags, RefreshCw, CalendarPlus } from 'lucide-react';
import { adminLogin, adminLogout, checkSession, adminFetch } from '@/lib/adminAuth';
import { useToast } from '@/components/Toast';
import { FALLBACK_LAND_KEY } from '@/lib/reisetage';
import { VORGANGSTYP_META, istKstAn, type KstField, type MandantAdmin, type Vorgangstyp } from '@/lib/types';

// Default-Flags für editForm: jeder Vorgangstyp ist standardmäßig "an".
const KST_DEFAULTS: Record<KstField, boolean> = Object.fromEntries(
  Object.values(VORGANGSTYP_META).map(v => [v.kstFlag, true]),
) as Record<KstField, boolean>;

const TABS = [
  { id: 'mandanten', label: 'Mandanten', icon: Building2 },
  { id: 'kostenstellen', label: 'Kostenstellen', icon: Layers },
  { id: 'kategorien', label: 'Kategorien', icon: Tags },
  { id: 'pauschalen', label: 'Pauschalen', icon: DollarSign },
  { id: 'versand', label: 'Versand & Integration', icon: Mail },
  { id: 'protokoll', label: 'Protokoll', icon: Activity },
];

// Pills für die Kostenstellen-Sichtbarkeit pro Vorgangstyp.
// Liest die Werte aus der übergebenen `flags`-Map (im Read-Modus aus dem Mandanten,
// im Edit-Modus aus dem editForm) und ruft `onToggle(field, neuerWert)` auf.
function KstPills({
  flags,
  onToggle,
  disabled,
}: {
  flags: Partial<Record<KstField, boolean>>;
  onToggle: (field: KstField, neuerWert: boolean) => void;
  disabled?: boolean;
}) {
  const vorgangstypen = Object.keys(VORGANGSTYP_META) as Vorgangstyp[];

  return (
    <div className="flex gap-1 justify-center">
      {vorgangstypen.map(t => {
        const { kuerzel, label, kstFlag: field } = VORGANGSTYP_META[t];
        const aktiv = istKstAn(flags as Partial<MandantAdmin>, t);
        const stateText = aktiv ? 'sichtbar' : 'ausgeblendet';
        return (
          <button
            key={field}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(field, !aktiv)}
            aria-pressed={aktiv}
            aria-label={`Kostenstelle bei ${label}: ${stateText} — klicken zum Umschalten`}
            title={`Kostenstelle bei ${label}: ${stateText}`}
            className={`min-w-[2.25rem] px-2 py-1 rounded text-xs font-mono font-semibold transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-credo-500 focus-visible:ring-offset-1
              disabled:opacity-50 disabled:cursor-not-allowed ${
              aktiv
                ? 'bg-credo-700 text-white hover:bg-credo-800'
                : 'bg-credo-100 text-credo-700 line-through hover:bg-credo-200'
            }`}
          >
            <span aria-hidden="true">{kuerzel}</span>
          </button>
        );
      })}
    </div>
  );
}

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
      {activeTab === 'kostenstellen' && <KostenstellenTab />}
      {activeTab === 'kategorien' && <KategorienTab />}
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
  const { showToast } = useToast();
  const [mandanten, setMandanten] = useState<MandantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    mandantNr: '',
    name: '',
    kategorie: '',
    dmsEmail: '',
    primaerfarbe: '#6B7280',
  });
  const [createFehler, setCreateFehler] = useState('');

  // Edit form state. KST-Flags kommen aus den VORGANGSTYP_META-Defaults,
  // damit ein neuer Vorgangstyp automatisch mitwächst.
  const [editForm, setEditForm] = useState({
    name: '',
    kategorie: '',
    dmsEmail: '',
    primaerfarbe: '#6B7280',
    active: true,
    ...KST_DEFAULTS,
  });

  const loadMandanten = async () => {
    try {
      setFehler('');
      const res = await adminFetch('/api/admin/mandanten');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setMandanten(data);
    } catch (err) {
      console.error('[AdminCenter] loadMandanten:', err);
      setFehler('Mandanten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMandanten(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFehler('');
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/mandanten', {
        method: 'POST',
        body: JSON.stringify({
          mandantNr: parseInt(createForm.mandantNr, 10),
          name: createForm.name,
          kategorie: createForm.kategorie,
          dmsEmail: createForm.dmsEmail,
          primaerfarbe: createForm.primaerfarbe,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler beim Anlegen' }));
        throw new Error(err.error || 'Fehler beim Anlegen');
      }
      setShowCreate(false);
      setCreateForm({ mandantNr: '', name: '', kategorie: '', dmsEmail: '', primaerfarbe: '#6B7280' });
      await loadMandanten();
    } catch (err) {
      setCreateFehler(err instanceof Error ? err.message : 'Fehler beim Anlegen');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m: MandantAdmin) => {
    setEditingId(m.id);
    // KST-Flags aus dem Mandanten ableiten — istKstAn behandelt undefined/null defensive als true.
    const kstFlags = (Object.values(VORGANGSTYP_META).map(v => v.kstFlag) as KstField[]).reduce(
      (acc, field) => {
        acc[field] = m[field] !== false;
        return acc;
      },
      {} as Record<KstField, boolean>,
    );
    setEditForm({
      name: m.name,
      kategorie: m.kategorie,
      dmsEmail: m.dmsEmail,
      primaerfarbe: m.primaerfarbe,
      active: m.active,
      ...kstFlags,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/mandanten/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler beim Speichern' }));
        throw new Error(err.error || 'Fehler beim Speichern');
      }
      setEditingId(null);
      await loadMandanten();
    } catch (err) {
      console.error('[AdminCenter] handleSaveEdit:', err);
      showToast(err instanceof Error ? err.message : 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Optimistic Update: lokalen State sofort flippen, bei Fehler vom Server reseten.
  const handleToggleActive = async (m: MandantAdmin) => {
    const neuerWert = !m.active;
    setMandanten(prev => prev.map(x => (x.id === m.id ? { ...x, active: neuerWert } : x)));
    try {
      const res = await adminFetch(`/api/admin/mandanten/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: neuerWert }),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern');
    } catch (err) {
      console.error('[AdminCenter] handleToggleActive:', err);
      // Authoritative State vom Server holen statt blind invertieren — robust gegen
      // parallele Toggles und zwischenzeitliche Server-Änderungen.
      await loadMandanten();
      showToast('Status konnte nicht geändert werden.', 'error');
    }
  };

  // Read-Modus: direkter Toggle gegen die DB mit Optimistic Update.
  const handleToggleKstReadMode = async (m: MandantAdmin, field: KstField, neuerWert: boolean) => {
    setMandanten(prev => prev.map(x => (x.id === m.id ? { ...x, [field]: neuerWert } : x)));
    try {
      const res = await adminFetch(`/api/admin/mandanten/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: neuerWert }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[AdminCenter] handleToggleKst:', err);
      await loadMandanten();
      showToast('Kostenstellen-Sichtbarkeit konnte nicht geändert werden.', 'error');
    }
  };

  // Edit-Modus: Toggle ändert nur das editForm, persistiert wird beim "Speichern".
  const handleToggleKstEditMode = (field: KstField, neuerWert: boolean) => {
    setEditForm(prev => ({ ...prev, [field]: neuerWert }));
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-credo-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Mandanten werden geladen...
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-credo-900">Mandanten & DMS-E-Mail</h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm py-2">
          <Plus className="w-4 h-4 mr-1.5" />
          Mandant anlegen
        </button>
      </div>

      {fehler && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
          {fehler}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-credo-900">Neuen Mandanten anlegen</h3>
              <button onClick={() => setShowCreate(false)} className="text-credo-400 hover:text-credo-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Mandant-Nr.</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="z.B. 50"
                  value={createForm.mandantNr}
                  onChange={e => setCreateForm({ ...createForm, mandantNr: e.target.value })}
                  required
                  min={1}
                />
              </div>
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="z.B. Grundschule Musterstadt"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Kategorie</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="z.B. Grundschulen"
                  value={createForm.kategorie}
                  onChange={e => setCreateForm({ ...createForm, kategorie: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">DMS-E-Mail</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="z.B. fibu-schule@docubit.credo.de"
                  value={createForm.dmsEmail}
                  onChange={e => setCreateForm({ ...createForm, dmsEmail: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Primärfarbe</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded cursor-pointer border border-credo-200"
                    value={createForm.primaerfarbe}
                    onChange={e => setCreateForm({ ...createForm, primaerfarbe: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input-field flex-1 font-mono"
                    value={createForm.primaerfarbe}
                    onChange={e => setCreateForm({ ...createForm, primaerfarbe: e.target.value })}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    required
                  />
                </div>
              </div>

              {createFehler && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {createFehler}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">
                  Abbrechen
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Anlegen...' : 'Anlegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-credo-50 border-b border-credo-200">
            <tr>
              <th className="text-left p-3 font-medium text-credo-700">Nr.</th>
              <th className="text-left p-3 font-medium text-credo-700">Farbe</th>
              <th className="text-left p-3 font-medium text-credo-700">Name</th>
              <th className="text-left p-3 font-medium text-credo-700">Kategorie</th>
              <th className="text-left p-3 font-medium text-credo-700">DMS-E-Mail</th>
              <th className="text-center p-3 font-medium text-credo-700" title="Kostenstellen-Anzeige pro Vorgangstyp">KST</th>
              <th className="text-center p-3 font-medium text-credo-700">Aktiv</th>
              <th className="text-right p-3 font-medium text-credo-700">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {mandanten.map((m, i) => (
              <tr key={m.id} className={`border-b border-credo-100 ${i % 2 === 0 ? '' : 'bg-credo-50/50'}`}>
                {editingId === m.id ? (
                  <>
                    <td className="p-3 font-mono font-medium">{m.mandantNr}</td>
                    <td className="p-3">
                      <input
                        type="color"
                        className="w-6 h-6 rounded cursor-pointer border border-credo-200"
                        value={editForm.primaerfarbe}
                        onChange={e => setEditForm({ ...editForm, primaerfarbe: e.target.value })}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        className="input-field py-1 px-2 text-sm"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        className="input-field py-1 px-2 text-sm"
                        value={editForm.kategorie}
                        onChange={e => setEditForm({ ...editForm, kategorie: e.target.value })}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="email"
                        className="input-field py-1 px-2 text-sm font-mono text-xs"
                        value={editForm.dmsEmail}
                        onChange={e => setEditForm({ ...editForm, dmsEmail: e.target.value })}
                      />
                    </td>
                    <td className="p-3">
                      <KstPills flags={editForm} onToggle={handleToggleKstEditMode} />
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => setEditForm({ ...editForm, active: !editForm.active })} className="p-1">
                        {editForm.active ? (
                          <ToggleRight className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-red-400" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleSaveEdit(m.id)}
                        disabled={saving}
                        className="text-emerald-500 hover:text-emerald-700 p-1 disabled:opacity-50"
                        title="Speichern"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="text-credo-400 hover:text-credo-600 p-1 ml-1" title="Abbrechen">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 font-mono font-medium">{m.mandantNr}</td>
                    <td className="p-3"><div className="w-6 h-6 rounded-full" style={{ backgroundColor: m.primaerfarbe }} /></td>
                    <td className="p-3 font-medium text-credo-900">{m.name}</td>
                    <td className="p-3 text-credo-500">{m.kategorie}</td>
                    <td className="p-3 font-mono text-xs text-credo-600">{m.dmsEmail}</td>
                    <td className="p-3">
                      <KstPills flags={m} onToggle={(field, neuerWert) => handleToggleKstReadMode(m, field, neuerWert)} />
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleToggleActive(m)} title={m.active ? 'Deaktivieren' : 'Aktivieren'}>
                        <span className={`inline-block w-3 h-3 rounded-full ${m.active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => startEdit(m)} className="text-credo-400 hover:text-credo-600 p-1"><Edit className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {mandanten.length === 0 && !fehler && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-credo-400">
                  Keine Mandanten vorhanden. Legen Sie den ersten Mandanten an.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Kostenstellen Tab ─────────────────────────────────

interface Kostenstelle {
  id: string;
  mandantId: string;
  bezeichnung: string;
  nummer: string;
  active: boolean;
}

function KostenstellenTab() {
  const { showToast } = useToast();
  const [mandanten, setMandanten] = useState<MandantAdmin[]>([]);
  const [selectedMandantId, setSelectedMandantId] = useState('');
  const [kostenstellen, setKostenstellen] = useState<Kostenstelle[]>([]);
  const [loading, setLoading] = useState(true);
  const [ksLoading, setKsLoading] = useState(false);
  const [fehler, setFehler] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ bezeichnung: '', nummer: '' });
  const [createFehler, setCreateFehler] = useState('');
  const [editForm, setEditForm] = useState({ bezeichnung: '', nummer: '', active: true });

  // Mandanten laden
  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/mandanten');
        if (!res.ok) throw new Error('Fehler beim Laden');
        const data: MandantAdmin[] = await res.json();
        setMandanten(data.filter(m => m.active));
        if (data.length > 0) setSelectedMandantId(data.filter(m => m.active)[0]?.id || '');
      } catch {
        setFehler('Mandanten konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Kostenstellen laden wenn Mandant wechselt — mit AbortController gegen Race Conditions
  const ksAbortRef = useRef<AbortController | null>(null);

  const loadKostenstellen = async (mandantId: string) => {
    if (!mandantId) { setKostenstellen([]); return; }
    ksAbortRef.current?.abort();
    const controller = new AbortController();
    ksAbortRef.current = controller;
    setKsLoading(true);
    setFehler('');
    try {
      const res = await adminFetch(`/api/admin/kostenstellen/${mandantId}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error('Fehler');
      setKostenstellen(await res.json());
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || controller.signal.aborted) return;
      setFehler('Kostenstellen konnten nicht geladen werden.');
    } finally {
      if (!controller.signal.aborted) setKsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMandantId) loadKostenstellen(selectedMandantId);
    return () => ksAbortRef.current?.abort();
  }, [selectedMandantId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFehler('');
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/kostenstellen', {
        method: 'POST',
        body: JSON.stringify({
          mandantId: selectedMandantId,
          bezeichnung: createForm.bezeichnung,
          nummer: createForm.nummer,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler beim Anlegen' }));
        throw new Error(err.error || 'Fehler beim Anlegen');
      }
      setShowCreate(false);
      setCreateForm({ bezeichnung: '', nummer: '' });
      await loadKostenstellen(selectedMandantId);
    } catch (err) {
      setCreateFehler(err instanceof Error ? err.message : 'Fehler beim Anlegen');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (ks: Kostenstelle) => {
    setEditingId(ks.id);
    setEditForm({ bezeichnung: ks.bezeichnung, nummer: ks.nummer, active: ks.active });
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/kostenstellen/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern');
      setEditingId(null);
      await loadKostenstellen(selectedMandantId);
    } catch (err) {
      console.error('[KostenstellenTab] handleSaveEdit:', err);
      showToast(err instanceof Error ? err.message : 'Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (ks: Kostenstelle) => {
    try {
      const res = await adminFetch(`/api/admin/kostenstellen/${ks.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !ks.active }),
      });
      if (!res.ok) throw new Error('Fehler');
      await loadKostenstellen(selectedMandantId);
    } catch (err) {
      console.error('[KostenstellenTab] handleToggleActive:', err);
      showToast('Status konnte nicht geändert werden.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await adminFetch(`/api/admin/kostenstellen/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler');
      setDeletingId(null);
      await loadKostenstellen(selectedMandantId);
    } catch (err) {
      console.error('[KostenstellenTab] handleDelete:', err);
      showToast('Kostenstelle konnte nicht gelöscht werden.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-credo-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Lade...
      </div>
    );
  }

  const selectedMandant = mandanten.find(m => m.id === selectedMandantId);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-credo-900">Kostenstellen pro Mandant</h3>
          <p className="text-sm text-credo-500 mt-0.5">Verwalten Sie Kostenstellen für jeden Mandanten</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!selectedMandantId}
          className="btn-primary text-sm py-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Kostenstelle anlegen
        </button>
      </div>

      {/* Mandant-Auswahl */}
      <div className="mb-4">
        <label className="label">Mandant auswählen</label>
        <select
          className="input-field max-w-md"
          value={selectedMandantId}
          onChange={e => setSelectedMandantId(e.target.value)}
        >
          {mandanten.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.mandantNr})
            </option>
          ))}
        </select>
      </div>

      {fehler && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{fehler}</div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-credo-900">Neue Kostenstelle</h3>
              <button onClick={() => setShowCreate(false)} className="text-credo-400 hover:text-credo-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-credo-500 mb-4">
              Für: <span className="font-medium text-credo-700">{selectedMandant?.name}</span>
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Nummer</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="z.B. 5000"
                  value={createForm.nummer}
                  onChange={e => setCreateForm({ ...createForm, nummer: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Bezeichnung</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="z.B. Schulbetrieb"
                  value={createForm.bezeichnung}
                  onChange={e => setCreateForm({ ...createForm, bezeichnung: e.target.value })}
                  required
                />
              </div>

              {createFehler && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{createFehler}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Abbrechen</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Anlegen...' : 'Anlegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ksLoading ? (
        <div className="text-center py-8 text-credo-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Kostenstellen werden geladen...
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-credo-50 border-b border-credo-200">
              <tr>
                <th className="text-left p-3 font-medium text-credo-700">Nummer</th>
                <th className="text-left p-3 font-medium text-credo-700">Bezeichnung</th>
                <th className="text-center p-3 font-medium text-credo-700">Aktiv</th>
                <th className="text-right p-3 font-medium text-credo-700">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {kostenstellen.map((ks, i) => (
                <tr key={ks.id} className={`border-b border-credo-100 ${i % 2 === 0 ? '' : 'bg-credo-50/50'}`}>
                  {editingId === ks.id ? (
                    <>
                      <td className="p-3">
                        <input
                          type="text"
                          className="input-field py-1 px-2 text-sm font-mono"
                          value={editForm.nummer}
                          onChange={e => setEditForm({ ...editForm, nummer: e.target.value })}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          className="input-field py-1 px-2 text-sm"
                          value={editForm.bezeichnung}
                          onChange={e => setEditForm({ ...editForm, bezeichnung: e.target.value })}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => setEditForm({ ...editForm, active: !editForm.active })} className="p-1">
                          {editForm.active
                            ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                            : <ToggleLeft className="w-6 h-6 text-red-400" />
                          }
                        </button>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleSaveEdit(ks.id)}
                          disabled={saving}
                          className="text-emerald-500 hover:text-emerald-700 p-1 disabled:opacity-50"
                          title="Speichern"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-credo-400 hover:text-credo-600 p-1 ml-1" title="Abbrechen">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 font-mono font-medium">{ks.nummer}</td>
                      <td className="p-3 font-medium text-credo-900">{ks.bezeichnung}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleToggleActive(ks)} title={ks.active ? 'Deaktivieren' : 'Aktivieren'}>
                          <span className={`inline-block w-3 h-3 rounded-full ${ks.active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        </button>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(ks)} className="text-credo-400 hover:text-credo-600 p-1" title="Bearbeiten">
                          <Edit className="w-4 h-4" />
                        </button>
                        {deletingId === ks.id ? (
                          <span className="inline-flex items-center gap-1 ml-1">
                            <button onClick={() => handleDelete(ks.id)} className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded hover:bg-red-100">Ja</button>
                            <button onClick={() => setDeletingId(null)} className="text-xs text-credo-500 px-2 py-1">Nein</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingId(ks.id)} className="text-credo-400 hover:text-red-500 p-1" title="Löschen">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {kostenstellen.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-credo-400">
                    Keine Kostenstellen für diesen Mandanten. Legen Sie die erste Kostenstelle an.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pauschalen Tab (read-only) ─────────────────────────
// Pauschalen werden im Code gepflegt (backend/src/lib/kmSaetze.ts und
// frontend/src/lib/vma.ts). Eine UI-Editierung wäre irreführend, weil die
// Berechnungen serverseitig hardgecodet sind.

const INLANDSPAUSCHALEN_2026: Array<{ label: string; value: string; suffix: string }> = [
  { label: 'Kilometerpauschale PKW', value: '0,30', suffix: 'EUR/km' },
  { label: 'Kilometerpauschale Motorrad', value: '0,20', suffix: 'EUR/km' },
  { label: 'VMA > 8h (eintägig)', value: '14,00', suffix: 'EUR' },
  { label: 'VMA 24h (Ganztag)', value: '28,00', suffix: 'EUR' },
  { label: 'VMA An-/Abreisetag', value: '14,00', suffix: 'EUR' },
  { label: 'Kürzung Frühstück', value: '20', suffix: '%' },
  { label: 'Kürzung Mittagessen', value: '40', suffix: '%' },
  { label: 'Kürzung Abendessen', value: '40', suffix: '%' },
];

interface AuslandsPauschaleAdmin {
  landKey: string;
  /** Erster Gültigkeitstag 'YYYY-MM-DD' — mit landKey der Schlüssel des Satzstands. */
  gueltigVon: string;
  quelle: string;
  tagessatz24h: number;
  tagessatz8h: number;
  uebernachtung: number;
  /** Beim Anlegen optional: ohne Angabe übernimmt der Server die Sortierung des Vorgängerstands (neues Land 9999). */
  reihenfolge?: number;
  updatedAt?: string;
}

/** Schlüssel eines Satzstands (Land + gültig ab). */
const standSchluessel = (e: AuslandsPauschaleAdmin) => `${e.landKey}|${e.gueltigVon}`;
/** Admin-URL eines Satzstands: /api/admin/pauschalen-ausland/:landKey/:gueltigVon */
const standUrl = (e: AuslandsPauschaleAdmin) =>
  `/api/admin/pauschalen-ausland/${encodeURIComponent(e.landKey)}/${e.gueltigVon}`;
/** 'YYYY-MM-DD' → 'TT.MM.JJJJ' (ohne Date-Objekt, also ohne Zeitzonenverschiebung). */
const datumDe = (datum: string) => datum.split('-').reverse().join('.');

// Spalten ab lg: Land | gültig ab | Quelle | 24 h | 8 h | Übernachtung | Sortierung | Aktionen
const PAUSCHALEN_SPALTEN = 'lg:grid-cols-[minmax(0,1.6fr)_8.5rem_minmax(0,1.4fr)_4.5rem_4.5rem_5.5rem_4rem_6rem]';
// Unter lg fehlt die Kopfzeile: Werte und Eingaben tragen dort eine eigene Bezeichnung.
const SPALTEN_LABEL = 'lg:hidden text-xs text-credo-400 font-sans';

const LUXEMBURG_SPERRE =
  'Gesetzlicher Ersatzsatz für nicht aufgeführte Staaten und Seetage: Der erste Luxemburg-Stand eines Jahres kann nicht gelöscht werden, solange andere Länder Sätze für dieses Jahr haben.';

// Plausibilität wie der Server (backend/src/lib/satzstaende.ts) — Grenzen und Meldungen gleich halten.
// MAX_TAGESSATZ ist zugleich der Deckel der Tagesbeträge in der Einreichung: ein höherer Satz ließe jede Einreichung scheitern.
const MAX_TAGESSATZ = 200;
const MAX_UEBERNACHTUNG = 9999;
// Keine Steuer-, Format- oder Zeilentrennzeichen (CR/LF, TAB, Bidi-Overrides, U+2028/U+2029 …).
const OHNE_STEUERZEICHEN = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]*$/u;
const LAND_ZEICHEN = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}%]*$/u;
const MELDUNG_8H_UEBER_24H = 'Der 8-h-Satz darf nicht größer als der 24-h-Satz sein.';
const meldungOhneJahresstand = (jahr: string) =>
  `Für ${jahr} ist noch kein Jahresstand eingespielt. Neue Jahresstände werden zentral per BMF-Import eingespielt; hier nur Korrekturen in bereits eingespielten Jahren.`;

/** Feldbezeichnungen (wie im Editor) für Validierungsfehler der Admin-API. */
const PAUSCHALEN_FELDER: Record<string, string> = {
  landKey: 'Land / Stadt',
  gueltigVon: 'Gültig ab',
  quelle: 'Quelle',
  tagessatz24h: '24h (€)',
  tagessatz8h: '8h (€)',
  uebernachtung: 'Übernachtung (€)',
  reihenfolge: 'Sortierung',
};

/**
 * Fehlertext einer Admin-Antwort: Zod-Details ({ path, code, message }) als deutsche Feldhinweise
 * („Bitte prüfen – 24h (€): Höchstens 200 €“) statt nur „Validierungsfehler“, sonst `error`.
 */
function pauschalenFehlertext(
  body: { error?: string; details?: Array<{ path?: unknown[]; code?: string; message?: string }> },
  status: number,
): string {
  if (!Array.isArray(body.details) || body.details.length === 0) return body.error || 'HTTP ' + status;
  const hinweise = body.details.map(d => {
    const feld = PAUSCHALEN_FELDER[String(d.path?.[0] ?? '')] ?? 'Eingabe';
    // Typfehler kommen ohne eigene deutsche Meldung vom Server (Zod-Standardtext).
    return `${feld}: ${d.code === 'invalid_type' ? 'fehlt oder ist ungültig' : d.message ?? 'ungültig'}`;
  });
  return `Bitte prüfen – ${[...new Set(hinweise)].join('; ')}`;
}

function PauschalenTab() {
  const { showToast } = useToast();
  const [auslandsListe, setAuslandsListe] = useState<AuslandsPauschaleAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Formular „Neuer Satzstand“: leer (neues Land) oder Vorlage aus einem bestehenden Stand; null = zu.
  const [neuerStand, setNeuerStand] = useState<AuslandsPauschaleAdmin | null>(null);
  // Filter nach Stand (Jahr von „gültig ab“): '' = Vorgabe (aktuelles bzw. jüngstes Jahr), 'alle' = alle Stände.
  const [standFilter, setStandFilter] = useState('');

  const loadAusland = async () => {
    try {
      const res = await adminFetch('/api/admin/pauschalen-ausland');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setAuslandsListe(await res.json());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Auslandspauschalen konnten nicht geladen werden', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAusland();
  }, []);

  const jahre = [...new Set(auslandsListe.map(e => e.gueltigVon.slice(0, 4)))].sort();
  const aktuellesJahr = String(new Date().getFullYear());
  const vorgabeJahr = jahre.includes(aktuellesJahr) ? aktuellesJahr : jahre[jahre.length - 1] ?? 'alle';
  // Gewähltes Jahr nur, solange es Stände hat (z. B. nach dem Löschen des einzigen Stands eines Jahres).
  const jahr = standFilter === 'alle' || jahre.includes(standFilter) ? standFilter : vorgabeJahr;
  const sichtbar = jahr === 'alle' ? auslandsListe : auslandsListe.filter(e => e.gueltigVon.startsWith(`${jahr}-`));
  const laenderKeys = [...new Set(auslandsListe.map(e => e.landKey))].sort((a, b) => a.localeCompare(b, 'de'));
  // Jahre mit eingespieltem Jahresstand (= Luxemburg-Stand): nur dort lassen sich Stände anlegen (wie der Server).
  const jahresstandJahre = new Set(auslandsListe.filter(e => e.landKey === FALLBACK_LAND_KEY).map(e => e.gueltigVon.slice(0, 4)));

  // Luxemburg = gesetzlicher Ersatzsatz für nicht aufgeführte Staaten und Seetage. Wie der Server
  // (admin.ts luxemburgLoeschbar): löschbar, wenn im selben Jahr ein früherer Luxemburg-Stand bleibt
  // (Korrektur) oder das Jahr keine Stände anderer Länder hat (z. B. Tippfehler im Datum).
  const darfLoeschen = (e: AuslandsPauschaleAdmin) => {
    if (e.landKey !== FALLBACK_LAND_KEY) return true;
    const imJahr = (a: AuslandsPauschaleAdmin) => a.gueltigVon.slice(0, 4) === e.gueltigVon.slice(0, 4);
    return auslandsListe.some(a => a.landKey === FALLBACK_LAND_KEY && imJahr(a) && a.gueltigVon < e.gueltigVon) ||
      !auslandsListe.some(a => a.landKey !== FALLBACK_LAND_KEY && imJahr(a));
  };

  const handleSave = async (eintrag: AuslandsPauschaleAdmin, isNew: boolean) => {
    try {
      // Schlüssel (Land + gültig ab) steht beim Ändern in der URL; der Server ignoriert ihn im Body.
      const res = await adminFetch(isNew ? '/api/admin/pauschalen-ausland' : standUrl(eintrag), {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eintrag),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Speichern fehlgeschlagen' }));
        throw new Error(pauschalenFehlertext(err, res.status));
      }
      showToast(isNew ? 'Satzstand angelegt' : 'Satzstand aktualisiert', 'success');
      setEditingKey(null);
      setNeuerStand(null);
      // Neuer Stand eines anderen Jahres: Filter mitnehmen, damit er sichtbar ist.
      if (isNew && jahr !== 'alle') setStandFilter(eintrag.gueltigVon.slice(0, 4));
      void loadAusland();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Speichern fehlgeschlagen', 'error');
    }
  };

  const handleDelete = async (eintrag: AuslandsPauschaleAdmin) => {
    if (!confirm(`Satzstand „${eintrag.landKey}“ ab ${datumDe(eintrag.gueltigVon)} wirklich löschen?`)) return;
    try {
      const res = await adminFetch(standUrl(eintrag), { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Löschen fehlgeschlagen' }));
        throw new Error(err.error || 'HTTP ' + res.status);
      }
      showToast('Satzstand gelöscht', 'success');
      void loadAusland();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Löschen fehlgeschlagen', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card border border-blue-200 bg-blue-50/40">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-credo-700">
            <strong className="block text-credo-900 mb-1">Inland im Code, Ausland in der Datenbank</strong>
            Inlandspauschalen (Kilometer, VMA, Mahlzeitenkürzungen) ändern sich praktisch nie und werden
            im Code gepflegt (<code className="text-xs">frontend/src/lib/vma.ts</code>).
            <strong> Auslandspauschalen</strong> erscheinen jährlich in einem neuen BMF-Schreiben — sie sind
            unten editierbar und werden direkt vom Reisekosten-Wizard gelesen.
          </div>
        </div>
      </div>

      {/* Inlandspauschalen — read-only */}
      <div className="card">
        <h3 className="text-lg font-semibold text-credo-900 mb-4">Inlandspauschalen 2026 (read-only)</h3>
        <div className="space-y-3">
          {INLANDSPAUSCHALEN_2026.map(p => (
            <div key={p.label} className="flex justify-between items-center py-2 border-b border-credo-100 last:border-0">
              <span className="text-credo-600">{p.label}</span>
              <span className="font-medium font-mono">{p.value} {p.suffix}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Auslandspauschalen — je Land und Satzstand editierbar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-credo-900">Auslandspauschalen</h3>
            <p className="text-xs text-credo-500 mt-0.5">
              Je Land ein Satzstand pro BMF-Schreiben. Für einen Reisetag gilt der jüngste Stand bis zu diesem Tag
              aus demselben Kalenderjahr — fehlt er, lehnt das Portal die Abrechnung mit einem Hinweis ab.
              Neues BMF-Schreiben (meist Anfang Dezember): bitte an die IT geben — die vollständige Jahrestabelle
              wird bis zum 31.12. zentral eingespielt. Hier nur Korrekturen in bereits eingespielten Jahren:
              einzelne Stände anlegen, ändern oder löschen.
              „Gültig ab“ ist der erste Tag, ab dem ein Satz gilt (Jahresstand: 01.01.), nicht das Datum des
              Schreibens. Sortierung unter 1000 erscheint im Reisekosten-Formular unter „Häufige Ziele“.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label htmlFor="pauschalen-stand" className="sr-only">Stand</label>
            <select
              id="pauschalen-stand"
              className="input-field !w-auto !py-1.5 text-sm"
              value={jahr}
              onChange={e => setStandFilter(e.target.value)}
            >
              {jahre.map(j => (
                <option key={j} value={j}>Stand {j}</option>
              ))}
              <option value="alle">Alle Stände</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setNeuerStand({ landKey: '', gueltigVon: '', quelle: '', tagessatz24h: 0, tagessatz8h: 0, uebernachtung: 0 });
                setEditingKey(null);
              }}
              // Ohne eingespielten Jahresstand gibt es nichts zu korrigieren (neue Jahre nur per BMF-Import).
              disabled={neuerStand !== null || jahresstandJahre.size === 0}
              title={!loading && jahresstandJahre.size === 0 ? 'Noch kein Jahresstand eingespielt – neue Jahresstände kommen zentral per BMF-Import.' : undefined}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-credo-600 text-white text-sm font-medium hover:bg-credo-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Neuer Satzstand
            </button>
          </div>
        </div>

        {/* Vorschläge für das Land beim Anlegen (neuer Stand eines bestehenden Landes) */}
        <datalist id="pauschalen-laender">
          {laenderKeys.map(k => (
            <option key={k} value={k} />
          ))}
        </datalist>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-credo-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Lade Auslandspauschalen...
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className={`hidden lg:grid ${PAUSCHALEN_SPALTEN} gap-3 px-3 py-2 text-xs font-medium text-credo-500 uppercase tracking-wider`}>
              <span>Land / Stadt</span>
              <span>Gültig ab</span>
              <span>Quelle</span>
              <span className="text-right">24h</span>
              <span className="text-right">8h</span>
              <span className="text-right">Übernachtung</span>
              <span className="text-right">Sort.</span>
              <span></span>
            </div>

            {/* Neuer Satzstand */}
            {neuerStand && (
              <PauschaleZeile
                eintrag={neuerStand}
                isNew
                jahresstandJahre={jahresstandJahre}
                onSave={p => handleSave(p, true)}
                onCancel={() => setNeuerStand(null)}
              />
            )}

            {/* Bestehende Satzstände */}
            {sichtbar.map(eintrag => (
              editingKey === standSchluessel(eintrag) ? (
                <PauschaleZeile
                  key={standSchluessel(eintrag)}
                  eintrag={eintrag}
                  onSave={p => handleSave(p, false)}
                  onCancel={() => setEditingKey(null)}
                />
              ) : (
                <div
                  key={standSchluessel(eintrag)}
                  className={`grid grid-cols-2 ${PAUSCHALEN_SPALTEN} gap-3 px-3 py-3 border border-credo-100 rounded-lg hover:bg-credo-50/40 items-center`}
                >
                  <span className="font-medium text-credo-800 col-span-2 lg:col-span-1">{eintrag.landKey}</span>
                  <span className="text-sm text-credo-700">
                    <span className="lg:hidden text-credo-400">ab </span>{datumDe(eintrag.gueltigVon)}
                  </span>
                  <span className="text-xs text-credo-500 leading-snug break-words">{eintrag.quelle}</span>
                  <span className="text-right font-mono text-sm"><span className={SPALTEN_LABEL}>24h </span>{eintrag.tagessatz24h.toFixed(2)} €</span>
                  <span className="text-right font-mono text-sm"><span className={SPALTEN_LABEL}>8h </span>{eintrag.tagessatz8h.toFixed(2)} €</span>
                  <span className="text-right font-mono text-sm"><span className={SPALTEN_LABEL}>Übern. </span>{eintrag.uebernachtung.toFixed(2)} €</span>
                  <span className="text-right text-xs text-credo-400"><span className={SPALTEN_LABEL}>Sort. </span>{eintrag.reihenfolge}</span>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => { setEditingKey(standSchluessel(eintrag)); setNeuerStand(null); }}
                      className="p-1.5 text-credo-500 hover:text-credo-700 hover:bg-credo-100 rounded"
                      aria-label={`${eintrag.landKey} ab ${datumDe(eintrag.gueltigVon)} bearbeiten`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {/* Neuer Stand statt Überschreiben: Sätze als Vorlage, Datum und Quelle neu eingeben */}
                    <button
                      type="button"
                      onClick={() => {
                        setNeuerStand({ ...eintrag, gueltigVon: '', quelle: '', reihenfolge: undefined });
                        setEditingKey(null);
                      }}
                      className="p-1.5 text-credo-500 hover:text-credo-700 hover:bg-credo-100 rounded"
                      aria-label={`Neuer Satzstand für ${eintrag.landKey}`}
                      title="Neuer Satzstand für dieses Land"
                    >
                      <CalendarPlus className="w-4 h-4" />
                    </button>
                    {/* Gesperrt (erster Luxemburg-Stand eines genutzten Jahres): sichtbar, mit Begründung */}
                    <span className="inline-flex" title={darfLoeschen(eintrag) ? undefined : LUXEMBURG_SPERRE}>
                      <button
                        type="button"
                        onClick={() => handleDelete(eintrag)}
                        disabled={!darfLoeschen(eintrag)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        aria-label={darfLoeschen(eintrag)
                          ? `${eintrag.landKey} ab ${datumDe(eintrag.gueltigVon)} löschen`
                          : `${eintrag.landKey} ab ${datumDe(eintrag.gueltigVon)} kann nicht gelöscht werden. ${LUXEMBURG_SPERRE}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                </div>
              )
            ))}

            {!loading && sichtbar.length === 0 && !neuerStand && (
              <p className="text-sm text-credo-500 text-center py-6">
                {auslandsListe.length === 0 ? 'Keine Auslandspauschalen hinterlegt.' : `Keine Satzstände für ${jahr}.`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Eingabe im Inline-Editor; unter lg (ohne Kopfzeile) mit sichtbarer Bezeichnung. */
function EditorFeld({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={`${SPALTEN_LABEL} block mb-1`}>{label}</span>
      {children}
    </label>
  );
}

// Inline-Editor fuer einen Satzstand (Edit oder Neu). Land und „gültig ab“ sind der Schlüssel:
// nur beim Anlegen editierbar (anderes Datum = neuen Stand anlegen, alten löschen).
function PauschaleZeile({
  eintrag,
  isNew = false,
  jahresstandJahre = new Set<string>(),
  onSave,
  onCancel,
}: {
  eintrag: AuslandsPauschaleAdmin;
  isNew?: boolean;
  /** Nur beim Anlegen: Jahre mit eingespieltem Jahresstand (Luxemburg-Stand). */
  jahresstandJahre?: ReadonlySet<string>;
  onSave: (e: AuslandsPauschaleAdmin) => void;
  onCancel: () => void;
}) {
  const [landKey, setLandKey] = useState(eintrag.landKey);
  const [gueltigVon, setGueltigVon] = useState(eintrag.gueltigVon);
  const [quelle, setQuelle] = useState(eintrag.quelle);
  // Leeres Formular (neues Land): Beträge leer statt „0“ — der Platzhalter bleibt sichtbar, und ein
  // vergessenes Feld wird nicht als 0,00 € gespeichert. Neuer Stand aus Vorlage: deren Beträge.
  const betragText = (n: number) => (isNew && !eintrag.landKey ? '' : String(n));
  const [t24, setT24] = useState(betragText(eintrag.tagessatz24h));
  const [t8, setT8] = useState(betragText(eintrag.tagessatz8h));
  const [uebern, setUebern] = useState(betragText(eintrag.uebernachtung));
  // Leer = Sortierung des Vorgängerstands übernehmen (nur beim Anlegen) bzw. unverändert lassen.
  const [reihenfolge, setReihenfolge] = useState(eintrag.reihenfolge === undefined ? '' : String(eintrag.reihenfolge));
  const [versucht, setVersucht] = useState(false);

  const parsed: AuslandsPauschaleAdmin = {
    landKey: landKey.trim(),
    gueltigVon,
    quelle: quelle.trim(),
    tagessatz24h: Number(t24.replace(',', '.')),
    tagessatz8h: Number(t8.replace(',', '.')),
    uebernachtung: Number(uebern.replace(',', '.')),
    reihenfolge: reihenfolge.trim() === '' ? undefined : Number(reihenfolge),
  };
  // Wie der Server (backend/src/lib/satzstaende.ts): Tagessätze > 0 (das BMF kennt keine 0-€-Sätze)
  // und höchstens MAX_TAGESSATZ, 8h ≤ 24h, Übernachtung 0 bis 9.999, Sortierung ganze Zahl ≥ 0,
  // Datum 20JJ-MM-TT, Land ohne Steuerzeichen und „%“, Quelle ohne Steuerzeichen; leeres Feld = ungültig.
  const betragUngueltig = (text: string, wert: number, max: number, nullErlaubt: boolean) =>
    text.trim() === '' || !Number.isFinite(wert) || wert > max || (nullErlaubt ? wert < 0 : wert <= 0);
  const achtUeber24 = parsed.tagessatz8h > parsed.tagessatz24h; // NaN (leer/ungültig) ergibt false
  const ungueltig = {
    landKey: !parsed.landKey || !LAND_ZEICHEN.test(parsed.landKey),
    gueltigVon: !/^20\d{2}-\d{2}-\d{2}$/.test(parsed.gueltigVon),
    quelle: !parsed.quelle || !OHNE_STEUERZEICHEN.test(parsed.quelle),
    t24: betragUngueltig(t24, parsed.tagessatz24h, MAX_TAGESSATZ, false),
    t8: betragUngueltig(t8, parsed.tagessatz8h, MAX_TAGESSATZ, false) || achtUeber24,
    uebern: betragUngueltig(uebern, parsed.uebernachtung, MAX_UEBERNACHTUNG, true),
    reihenfolge: parsed.reihenfolge !== undefined && !(Number.isInteger(parsed.reihenfolge) && parsed.reihenfolge >= 0),
  };
  // Wie der Server: neue Stände nur in Jahren mit eingespieltem Jahresstand — sofort anzeigen, nicht erst beim Speichern.
  const standJahr = gueltigVon.slice(0, 4);
  const ohneJahresstand = isNew && !ungueltig.gueltigVon && !jahresstandJahre.has(standJahr);
  // Pflichtfelder erst nach dem ersten Speicherversuch rot markieren.
  const rahmen = (feld: keyof typeof ungueltig) =>
    ((versucht && ungueltig[feld]) || (feld === 'gueltigVon' && ohneJahresstand) ? 'border-red-400' : '');
  // Datumsauswahl beim Anlegen auf die eingespielten Jahre begrenzen.
  const jahresstandSortiert = [...jahresstandJahre].sort();

  const submit = () => {
    setVersucht(true);
    if (Object.values(ungueltig).some(Boolean) || ohneJahresstand) return;
    onSave(parsed);
  };

  // Neuer Stand mit „gültig ab“ nicht am 01.01.: Korrektur im laufenden Jahr, kein Jahresstand.
  const istKorrektur = isNew && !ungueltig.gueltigVon && !ohneJahresstand && !gueltigVon.endsWith('-01-01');

  return (
    <div className={`grid grid-cols-2 ${PAUSCHALEN_SPALTEN} gap-3 px-3 py-3 border-2 border-credo-400 bg-credo-50/30 rounded-lg items-center`}>
      <EditorFeld label="Land / Stadt" className="col-span-2 lg:col-span-1">
        <input
          type="text"
          maxLength={100}
          className={`input-field !py-1.5 ${rahmen('landKey')}`}
          placeholder="z.B. Frankreich — Paris"
          list={isNew ? 'pauschalen-laender' : undefined}
          aria-label="Land / Stadt"
          value={landKey}
          onChange={e => setLandKey(e.target.value)}
          disabled={!isNew}
          // Neuer Stand: erstes offenes Feld fokussieren — holt das Formular (oben in der Liste) in den Blick.
          autoFocus={isNew && !eintrag.landKey}
        />
      </EditorFeld>
      <EditorFeld label="Gültig ab">
        <input
          type="date"
          className={`input-field !px-2 !py-1.5 ${rahmen('gueltigVon')}`}
          aria-label="Gültig ab"
          autoFocus={isNew && !!eintrag.landKey}
          min={isNew && jahresstandSortiert.length > 0 ? `${jahresstandSortiert[0]}-01-01` : undefined}
          max={isNew && jahresstandSortiert.length > 0 ? `${jahresstandSortiert[jahresstandSortiert.length - 1]}-12-31` : undefined}
          value={gueltigVon}
          onChange={e => setGueltigVon(e.target.value)}
          disabled={!isNew}
        />
      </EditorFeld>
      <EditorFeld label="Quelle">
        <input
          type="text"
          maxLength={200}
          className={`input-field !py-1.5 ${rahmen('quelle')}`}
          placeholder="z.B. BMF-Schreiben vom 05.12.2025"
          aria-label="Quelle"
          value={quelle}
          onChange={e => setQuelle(e.target.value)}
        />
      </EditorFeld>
      <EditorFeld label="24h (€)">
        <input
          type="text"
          inputMode="decimal"
          className={`input-field !px-2 !py-1.5 text-right font-mono ${rahmen('t24')}`}
          placeholder="0,00"
          aria-label="Tagessatz 24h"
          value={t24}
          onChange={e => setT24(e.target.value)}
        />
      </EditorFeld>
      <EditorFeld label="8h (€)">
        <input
          type="text"
          inputMode="decimal"
          className={`input-field !px-2 !py-1.5 text-right font-mono ${rahmen('t8')}`}
          placeholder="0,00"
          aria-label="Tagessatz 8h"
          value={t8}
          onChange={e => setT8(e.target.value)}
        />
      </EditorFeld>
      <EditorFeld label="Übernachtung (€)">
        <input
          type="text"
          inputMode="decimal"
          className={`input-field !px-2 !py-1.5 text-right font-mono ${rahmen('uebern')}`}
          placeholder="0,00"
          aria-label="Übernachtung"
          value={uebern}
          onChange={e => setUebern(e.target.value)}
        />
      </EditorFeld>
      <EditorFeld label="Sortierung">
        <input
          type="text"
          inputMode="numeric"
          className={`input-field !px-2 !py-1.5 text-right ${rahmen('reihenfolge')}`}
          placeholder={isNew ? 'auto' : undefined}
          title={isNew ? 'Leer = Sortierung des bisherigen Stands (neues Land: 9999)' : undefined}
          aria-label="Sortierung"
          value={reihenfolge}
          onChange={e => setReihenfolge(e.target.value)}
        />
      </EditorFeld>
      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={submit}
          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
          aria-label="Speichern"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-credo-500 hover:bg-credo-100 rounded"
          aria-label="Abbrechen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {istKorrektur && (
        <p className="col-span-2 lg:col-span-8 text-xs text-amber-700">
          Gilt ab {datumDe(gueltigVon)} als Korrektur im laufenden Jahr; Reisetage davor behalten den bisherigen Stand.
          Ein Jahresstand beginnt am 01.01.
        </p>
      )}
      {ohneJahresstand && (
        <p role="alert" className="col-span-2 lg:col-span-8 text-xs text-red-600">
          {meldungOhneJahresstand(standJahr)}
        </p>
      )}
      {versucht && Object.values(ungueltig).some(Boolean) && (
        <p role="alert" className="col-span-2 lg:col-span-8 text-xs text-red-600">
          {achtUeber24 && `${MELDUNG_8H_UEBER_24H} `}
          Bitte die rot markierten Felder prüfen: Land, „gültig ab“ und Quelle sind Pflicht (ohne Zeilenumbrüche
          oder Steuerzeichen, im Land kein %); 24h und 8h größer als 0 € und höchstens {MAX_TAGESSATZ} €, 8h nicht
          größer als 24h; Übernachtung 0 bis 9.999 €, Sortierung leer oder ganze Zahl ab 0.
        </p>
      )}
    </div>
  );
}

// ── Kategorien Tab (pro Mandant) ───────────────────────

interface KategorieAdmin {
  id: string;
  mandantId: string;
  key: string;
  label: string;
  reihenfolge: number;
  active: boolean;
}

function KategorienTab() {
  const { showToast } = useToast();
  const [mandanten, setMandanten] = useState<MandantAdmin[]>([]);
  const [selectedMandantId, setSelectedMandantId] = useState('');
  const [kategorien, setKategorien] = useState<KategorieAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [katLoading, setKatLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Mandanten laden
  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/mandanten');
        if (!res.ok) throw new Error('Fehler beim Laden');
        const data: MandantAdmin[] = await res.json();
        const aktive = data.filter(m => m.active);
        setMandanten(aktive);
        if (aktive.length > 0) setSelectedMandantId(aktive[0].id);
      } catch {
        showToast('Mandanten konnten nicht geladen werden.', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Kategorien laden wenn Mandant wechselt — mit AbortController gegen Race Conditions
  const katAbortRef = useRef<AbortController | null>(null);
  const loadKategorien = async (mandantId: string) => {
    if (!mandantId) { setKategorien([]); return; }
    katAbortRef.current?.abort();
    const controller = new AbortController();
    katAbortRef.current = controller;
    setKatLoading(true);
    try {
      const res = await adminFetch(`/api/admin/kategorien/${mandantId}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error('Fehler');
      setKategorien(await res.json());
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || controller.signal.aborted) return;
      showToast('Kategorien konnten nicht geladen werden.', 'error');
    } finally {
      if (!controller.signal.aborted) setKatLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMandantId) loadKategorien(selectedMandantId);
    return () => katAbortRef.current?.abort();
  }, [selectedMandantId]);

  const handleSave = async (form: { label: string; reihenfolge: number }, id: string | null) => {
    try {
      const url = id ? `/api/admin/kategorien/${id}` : '/api/admin/kategorien';
      const res = await adminFetch(url, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(id ? form : { mandantId: selectedMandantId, ...form }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Speichern fehlgeschlagen' }));
        throw new Error(err.error || 'HTTP ' + res.status);
      }
      showToast(id ? 'Kategorie aktualisiert' : 'Kategorie angelegt', 'success');
      setEditingId(null);
      setCreating(false);
      await loadKategorien(selectedMandantId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Speichern fehlgeschlagen', 'error');
    }
  };

  const handleToggleActive = async (kat: KategorieAdmin) => {
    try {
      const res = await adminFetch(`/api/admin/kategorien/${kat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !kat.active }),
      });
      if (!res.ok) throw new Error('Fehler');
      await loadKategorien(selectedMandantId);
    } catch {
      showToast('Status konnte nicht geändert werden.', 'error');
    }
  };

  const handleDelete = async (kat: KategorieAdmin) => {
    if (!confirm(`Kategorie „${kat.label}" wirklich löschen?`)) return;
    try {
      const res = await adminFetch(`/api/admin/kategorien/${kat.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler');
      showToast('Kategorie gelöscht', 'success');
      await loadKategorien(selectedMandantId);
    } catch {
      showToast('Kategorie konnte nicht gelöscht werden.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-credo-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Lade...
      </div>
    );
  }

  const naechsteReihenfolge = (kategorien.at(-1)?.reihenfolge ?? 0) + 10;

  return (
    <div className="space-y-6">
      <div className="card border border-blue-200 bg-blue-50/40">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-credo-700">
            <strong className="block text-credo-900 mb-1">Kategorien der Kostenerstattung — pro Mandant</strong>
            Diese Kategorien erscheinen im Erstattungs-Formular (Schritt „Positionen &amp; Belege"). Sie sind
            pro Mandant frei pflegbar. Bereits eingereichte Positionen behalten ihre gespeicherte Kategorie.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-credo-900">Kategorien</h3>
            <p className="text-sm text-credo-500 mt-0.5">Mandant wählen und Kategorien pflegen.</p>
          </div>
          <button
            type="button"
            onClick={() => { setCreating(true); setEditingId(null); }}
            disabled={!selectedMandantId || creating}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-credo-600 text-white text-sm font-medium hover:bg-credo-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Neue Kategorie
          </button>
        </div>

        {/* Mandant-Auswahl */}
        <div className="mb-4">
          <label className="label">Mandant</label>
          <select
            className="input-field"
            value={selectedMandantId}
            onChange={e => { setSelectedMandantId(e.target.value); setCreating(false); setEditingId(null); }}
          >
            {mandanten.map(m => (
              <option key={m.id} value={m.id}>{m.mandantNr} — {m.name}</option>
            ))}
          </select>
        </div>

        {katLoading ? (
          <div className="flex items-center justify-center py-8 text-credo-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Lade Kategorien...
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-[2fr_0.7fr_auto] gap-3 px-3 py-2 text-xs font-medium text-credo-500 uppercase tracking-wider">
              <span>Bezeichnung</span>
              <span className="text-right">Sortierung</span>
              <span></span>
            </div>

            {/* Neuer Eintrag */}
            {creating && (
              <KategorieZeile
                eintrag={{ label: '', reihenfolge: naechsteReihenfolge }}
                isNew
                onSave={form => handleSave(form, null)}
                onCancel={() => setCreating(false)}
              />
            )}

            {/* Bestehende Eintraege */}
            {kategorien.map(kat => (
              editingId === kat.id ? (
                <KategorieZeile
                  key={kat.id}
                  eintrag={{ label: kat.label, reihenfolge: kat.reihenfolge }}
                  onSave={form => handleSave(form, kat.id)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  key={kat.id}
                  className={`grid grid-cols-2 sm:grid-cols-[2fr_0.7fr_auto] gap-3 px-3 py-3 border border-credo-100 rounded-lg hover:bg-credo-50/40 items-center ${kat.active ? '' : 'opacity-50'}`}
                >
                  <span className="font-medium text-credo-800 col-span-2 sm:col-span-1">
                    {kat.label}
                    {!kat.active && <span className="ml-2 text-xs font-normal text-credo-400">(ausgeblendet)</span>}
                  </span>
                  <span className="text-right text-xs text-credo-400">{kat.reihenfolge}</span>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(kat)}
                      className="p-1.5 text-credo-500 hover:text-credo-700 hover:bg-credo-100 rounded"
                      aria-label={kat.active ? `${kat.label} ausblenden` : `${kat.label} einblenden`}
                    >
                      {kat.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(kat.id); setCreating(false); }}
                      className="p-1.5 text-credo-500 hover:text-credo-700 hover:bg-credo-100 rounded"
                      aria-label={`${kat.label} bearbeiten`}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(kat)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      aria-label={`${kat.label} löschen`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            ))}

            {!katLoading && kategorien.length === 0 && !creating && (
              <p className="text-sm text-credo-500 text-center py-6">Keine Kategorien für diesen Mandanten. Legen Sie die erste an.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline-Editor fuer eine Kategorie-Zeile (Edit oder Neu). Nur Bezeichnung + Reihenfolge;
// der interne Key wird serverseitig aus der Bezeichnung abgeleitet und bleibt stabil.
function KategorieZeile({
  eintrag,
  isNew = false,
  onSave,
  onCancel,
}: {
  eintrag: { label: string; reihenfolge: number };
  isNew?: boolean;
  onSave: (form: { label: string; reihenfolge: number }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(eintrag.label);
  const [reihenfolge, setReihenfolge] = useState(String(eintrag.reihenfolge));

  const submit = () => {
    const trimmed = label.trim();
    const rf = Number(reihenfolge);
    if (!trimmed || !Number.isFinite(rf)) return;
    onSave({ label: trimmed, reihenfolge: rf });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-[2fr_0.7fr_auto] gap-3 px-3 py-3 border-2 border-credo-400 bg-credo-50/30 rounded-lg items-center">
      <input
        type="text"
        className="input-field !py-1.5 col-span-2 sm:col-span-1"
        placeholder="z.B. Schulleiterbudget"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        autoFocus={isNew}
      />
      <input
        type="number"
        className="input-field !py-1.5 text-right"
        value={reihenfolge}
        onChange={e => setReihenfolge(e.target.value)}
      />
      <div className="flex items-center gap-1 justify-end">
        <button type="button" onClick={submit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" aria-label="Speichern">
          <Check className="w-4 h-4" />
        </button>
        <button type="button" onClick={onCancel} className="p-1.5 text-credo-500 hover:bg-credo-100 rounded" aria-label="Abbrechen">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Versand Tab ────────────────────────────────────────

interface WebhookConfig {
  id: string;
  aktiv: boolean;
  url: string | null;
  secret: string | null;
  authType: 'NONE' | 'BASIC' | 'HEADER';
  authUser: string | null;
  authPass: string | null;
  authHeaderName: string | null;
  authHeaderValue: string | null;
  typFilter: TypFilter;
  eventEingereicht: boolean;
  eventStatusGeaendert: boolean;
  eventFehler: boolean;
  updatedAt: string;
}

type TypFilter = 'ALLE' | 'REISEKOSTEN' | 'ERSTATTUNG' | 'SAMMELFAHRT';

const TYP_FILTER_LABELS: Record<TypFilter, string> = {
  ALLE: 'Alle Einreichungen',
  REISEKOSTEN: 'Nur Reisekosten',
  ERSTATTUNG: 'Nur Erstattungen',
  SAMMELFAHRT: 'Nur Sammelfahrten',
};

const AUTH_TYPE_LABELS: Record<string, string> = {
  NONE: 'Keine',
  BASIC: 'Basic Auth',
  HEADER: 'Header Auth',
};

interface EmailConfigForm {
  versandMethode: string;
  smtpServer: string;
  smtpPort: number | '';
  smtpUser: string;
  smtpPasswort: string;
  absenderName: string;
  absenderEmail: string;
  maxVersuche: number;
  fehlerEmail: string;
}

const LEERE_CONFIG: EmailConfigForm = {
  versandMethode: 'SMTP',
  smtpServer: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPasswort: '',
  absenderName: 'CREDO Finanzportal',
  absenderEmail: '',
  maxVersuche: 3,
  fehlerEmail: '',
};

function VersandTab() {
  const { showToast } = useToast();
  const [form, setForm] = useState<EmailConfigForm>(LEERE_CONFIG);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [methodeSaving, setMethodeSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  const set = <K extends keyof EmailConfigForm>(key: K, value: EmailConfigForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  useEffect(() => {
    adminFetch('/api/admin/email-config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setForm({
            versandMethode: data.versandMethode || 'SMTP',
            smtpServer: data.smtpServer || '',
            smtpPort: data.smtpPort ?? 587,
            smtpUser: data.smtpUser || '',
            smtpPasswort: '',
            absenderName: data.absenderName || 'CREDO Finanzportal',
            absenderEmail: data.absenderEmail || '',
            maxVersuche: data.maxVersuche ?? 3,
            fehlerEmail: data.fehlerEmail || '',
          });
          setHasPassword(data.smtpPasswortEncrypted === '***');
          setTestEmail(data.fehlerEmail || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Versandmethode wird sofort gespeichert (Schnellumschalter, wie zuvor).
  const handleMethodeChange = async (methode: string) => {
    const previous = form.versandMethode;
    set('versandMethode', methode);
    setMethodeSaving(true);
    try {
      const res = await adminFetch('/api/admin/email-config', {
        method: 'PUT',
        body: JSON.stringify({ versandMethode: methode }),
      });
      if (!res.ok) throw new Error('Speichern fehlgeschlagen');
      showToast(methode === 'SMTP' ? 'Versand: eigener SMTP-Server' : 'Versand: n8n-Webhook', 'success');
    } catch {
      set('versandMethode', previous);
      showToast('Versandmethode konnte nicht gespeichert werden.', 'error');
    } finally {
      setMethodeSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        smtpServer: form.smtpServer || null,
        smtpPort: form.smtpPort === '' ? null : Number(form.smtpPort),
        smtpUser: form.smtpUser || null,
        // '' + vorhandenes Passwort → '***' (unveraendert); sonst neuer Wert.
        smtpPasswort: form.smtpPasswort !== '' ? form.smtpPasswort : (hasPassword ? '***' : ''),
        absenderName: form.absenderName,
        absenderEmail: form.absenderEmail,
        maxVersuche: form.maxVersuche,
        fehlerEmail: form.fehlerEmail || null,
      };
      const res = await adminFetch('/api/admin/email-config', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Speichern fehlgeschlagen' }));
        throw new Error(err.error || 'HTTP ' + res.status);
      }
      if (form.smtpPasswort !== '') setHasPassword(true);
      set('smtpPasswort', '');
      showToast('E-Mail-Konfiguration gespeichert', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) { showToast('Bitte eine Test-E-Mail-Adresse eintragen.', 'error'); return; }
    setTesting(true);
    try {
      const res = await adminFetch('/api/admin/email-config/test', {
        method: 'POST',
        body: JSON.stringify({ testEmail }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        showToast(`Test-E-Mail gesendet (${data.durationMs} ms). Bitte Postfach prüfen.`, 'success');
      } else {
        showToast(`Test fehlgeschlagen: ${data?.error || 'Unbekannter Fehler'}`, 'error');
      }
    } catch {
      showToast('Test konnte nicht durchgeführt werden.', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-credo-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Lade...
      </div>
    );
  }

  const smtpAktiv = form.versandMethode === 'SMTP';

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-credo-900 mb-4">Versandmethode</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Wie sollen Einreichungen versendet werden?</label>
            <select
              className="input-field"
              value={form.versandMethode}
              onChange={e => handleMethodeChange(e.target.value)}
              disabled={methodeSaving}
            >
              <option value="SMTP">SMTP (eigener Mailserver — empfohlen)</option>
              <option value="WEBHOOK">Webhook (n8n / Outlook — Fallback)</option>
            </select>
            <p className="mt-2 text-sm text-gray-500">
              {smtpAktiv
                ? 'Das Finanzportal versendet direkt per SMTP an die DMS-Adresse — E-Mail (Zusammenfassung) inkl. PDF-Anhang (Deckblatt mit QR).'
                : 'E-Mails werden per Webhook an n8n gesendet. n8n übernimmt den Versand inkl. PDF-Anhang über Outlook.'}
            </p>
          </div>
        </div>
      </div>

      {/* SMTP-Konfig immer sichtbar — so laesst sie sich im WEBHOOK-Modus vorab
          konfigurieren + testen, bevor live auf SMTP umgeschaltet wird (kein Cutover-Loch). */}
        <>
          <div className="card">
            <h3 className="text-lg font-semibold text-credo-900 mb-4">SMTP-Konfiguration</h3>
            {!smtpAktiv && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>SMTP ist aktuell <strong>nicht</strong> der aktive Kanal. Hier vorab konfigurieren, speichern und per Test-E-Mail prüfen — dann oben auf „SMTP" umschalten. So entsteht beim Umstieg keine Zustelllücke.</span>
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">SMTP-Server</label>
                  <input type="text" className="input-field" placeholder="smtp.office365.com"
                    value={form.smtpServer} onChange={e => set('smtpServer', e.target.value)} />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input type="number" className="input-field" placeholder="587"
                    value={form.smtpPort} onChange={e => set('smtpPort', e.target.value === '' ? '' : Number(e.target.value))} />
                  <p className="mt-1 text-xs text-credo-400">465 = SSL, 587 = STARTTLS</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Benutzer</label>
                  <input type="text" className="input-field" placeholder="finanzportal@credo.de" autoComplete="off"
                    value={form.smtpUser} onChange={e => set('smtpUser', e.target.value)} />
                </div>
                <div>
                  <label className="label">Passwort {hasPassword && <span className="text-xs text-green-600">(gesetzt)</span>}</label>
                  <input type="password" className="input-field" autoComplete="new-password"
                    placeholder={hasPassword ? '•••••••• (unverändert lassen)' : 'Passwort eingeben'}
                    value={form.smtpPasswort} onChange={e => set('smtpPasswort', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Absender-Name</label>
                  <input type="text" className="input-field"
                    value={form.absenderName} onChange={e => set('absenderName', e.target.value)} />
                </div>
                <div>
                  <label className="label">Absender-E-Mail</label>
                  <input type="email" className="input-field" placeholder="finanzportal@credo.de"
                    value={form.absenderEmail} onChange={e => set('absenderEmail', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Max. Versuche</label>
                  <input type="number" min={1} max={10} className="input-field"
                    value={form.maxVersuche} onChange={e => set('maxVersuche', Number(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="label">Fehler-Benachrichtigung an</label>
                  <input type="email" className="input-field" placeholder="admin@credo.de"
                    value={form.fehlerEmail} onChange={e => set('fehlerEmail', e.target.value)} />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 inline-flex items-center">
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Konfiguration speichern
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-credo-900 mb-1">Verbindung testen</h3>
            <p className="text-sm text-credo-500 mb-4">Sendet eine Test-E-Mail mit der aktuell gespeicherten SMTP-Konfiguration.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="label">Test-Empfänger</label>
                <input type="email" className="input-field" placeholder="ich@credo.de"
                  value={testEmail} onChange={e => setTestEmail(e.target.value)} />
              </div>
              <button onClick={handleTest} disabled={testing} className="btn-secondary text-sm py-2 inline-flex items-center justify-center">
                {testing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                Test-E-Mail senden
              </button>
            </div>
          </div>
        </>

      <FehlgeschlageneVersaende />
      <VersandProtokoll />
      <WebhookSection />
    </div>
  );
}

// ── Fehlgeschlagene Versände (manueller Requeue, Befund G) ─────────

interface FehlversandRow {
  id: string;
  belegNr: string;
  typ: string;
  emailStatus: string;
  emailVersuche: number;
  emailLetzterFehler: string | null;
  submittedAt: string;
  hatPdf: boolean;
  mandantName: string | null;
  dmsEmail: string | null;
}

function FehlgeschlageneVersaende() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<FehlversandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const laden = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/versand/fehlgeschlagen');
      if (res.ok) setRows(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { laden(); }, []);

  const handleResend = async (row: FehlversandRow) => {
    setResendingId(row.id);
    try {
      const res = await adminFetch(`/api/admin/einreichungen/${row.id}/resend`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.erfolg) {
        showToast(`${row.belegNr} erfolgreich versendet.`, 'success');
        await laden();
      } else {
        showToast(`Erneuter Versand fehlgeschlagen: ${data?.fehler || 'Unbekannter Fehler'}`, 'error');
      }
    } catch {
      showToast('Erneuter Versand fehlgeschlagen.', 'error');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-credo-900">Fehlgeschlagene Versände</h3>
          <p className="text-sm text-credo-500 mt-0.5">Offene/fehlerhafte Zustellungen erneut anstoßen.</p>
        </div>
        <button onClick={laden} className="btn-secondary text-sm py-1.5 inline-flex items-center">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Aktualisieren
        </button>
      </div>

      {loading && <p className="text-credo-500 text-sm">Lade...</p>}

      {!loading && rows.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-credo-200 rounded-lg">
          <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-credo-500 text-sm">Keine offenen Versände — alles zugestellt.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-credo-200 text-left text-credo-500">
                <th className="p-2 font-medium">Beleg-Nr</th>
                <th className="p-2 font-medium">Mandant / DMS</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Letzter Fehler</th>
                <th className="p-2 font-medium text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-credo-100 align-top">
                  <td className="p-2 font-medium text-credo-800 whitespace-nowrap">{r.belegNr}</td>
                  <td className="p-2 text-credo-600">
                    <div>{r.mandantName || '—'}</div>
                    <div className="text-xs text-credo-400">{r.dmsEmail || '—'}</div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${r.emailStatus === 'FEHLER' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.emailStatus} ({r.emailVersuche})
                    </span>
                  </td>
                  <td className="p-2 text-xs text-credo-500 max-w-xs truncate" title={r.emailLetzterFehler || ''}>
                    {r.emailLetzterFehler || '—'}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleResend(r)}
                      disabled={resendingId === r.id || !r.hatPdf}
                      title={r.hatPdf ? 'Erneut versenden' : 'Kein PDF vorhanden'}
                      className="btn-secondary text-xs py-1 px-2 inline-flex items-center disabled:opacity-50"
                    >
                      {resendingId === r.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                      Erneut senden
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Versandprotokoll (email_log) ───────────────────────────────────

interface EmailLogRow {
  id: string;
  belegNr: string | null;
  kanal: string;
  status: string;
  empfaenger: string | null;
  betreff: string | null;
  fehler: string | null;
  versuche: number;
  istTest: boolean;
  createdAt: string;
}

function VersandProtokoll() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const laden = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/email-log');
      if (res.ok) setRows(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { laden(); }, []);

  const statusFarbe = (status: string) =>
    status === 'SENT' ? 'bg-green-50 text-green-700'
    : status === 'FAILED' ? 'bg-red-50 text-red-700'
    : 'bg-credo-100 text-credo-600';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-credo-900">Versandprotokoll</h3>
          <p className="text-sm text-credo-500 mt-0.5">Letzte 100 Zustellversuche (SMTP &amp; Webhook).</p>
        </div>
        <button onClick={laden} className="btn-secondary text-sm py-1.5 inline-flex items-center">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Aktualisieren
        </button>
      </div>

      {loading && <p className="text-credo-500 text-sm">Lade...</p>}

      {!loading && rows.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-credo-200 rounded-lg">
          <Activity className="w-8 h-8 text-credo-300 mx-auto mb-2" />
          <p className="text-credo-500 text-sm">Noch keine Versände protokolliert.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-credo-200 text-left text-credo-500">
                <th className="p-2 font-medium">Zeitpunkt</th>
                <th className="p-2 font-medium">Beleg-Nr</th>
                <th className="p-2 font-medium">Kanal</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Empfänger</th>
                <th className="p-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-credo-100 align-top">
                  <td className="p-2 text-credo-500 whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString('de-DE')}</td>
                  <td className="p-2 font-medium text-credo-800 whitespace-nowrap">
                    {r.belegNr || '—'}{r.istTest && <span className="ml-1 text-xs text-credo-400">(Test)</span>}
                  </td>
                  <td className="p-2 text-credo-600 whitespace-nowrap">{r.kanal}</td>
                  <td className="p-2 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusFarbe(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="p-2 text-credo-500 text-xs max-w-[12rem] truncate" title={r.empfaenger || ''}>{r.empfaenger || '—'}</td>
                  <td className="p-2 text-credo-500 text-xs max-w-xs truncate" title={r.fehler || r.betreff || ''}>
                    {r.fehler || r.betreff || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Webhook-Verwaltung ─────────────────────────────────

function WebhookSection() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const laden = async () => {
    try {
      const res = await adminFetch('/api/admin/webhooks');
      if (res.ok) setWebhooks(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { laden(); }, []);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-credo-900">n8n Webhooks</h3>
          <p className="text-sm text-credo-500 mt-0.5">Benachrichtigungen an n8n bei neuen Einreichungen</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2">
          <Plus className="w-4 h-4 mr-1.5" />
          Webhook anlegen
        </button>
      </div>

      {loading && <p className="text-credo-500 text-sm">Lade...</p>}

      {!loading && webhooks.length === 0 && !showNew && (
        <div className="text-center py-8 border-2 border-dashed border-credo-200 rounded-lg">
          <Zap className="w-8 h-8 text-credo-300 mx-auto mb-2" />
          <p className="text-credo-500 text-sm">Noch keine Webhooks konfiguriert</p>
          <p className="text-credo-400 text-xs mt-1">Verbinde das Finanzportal mit deinen n8n-Workflows</p>
        </div>
      )}

      {showNew && (
        <WebhookForm
          onSave={async (data) => {
            const res = await adminFetch('/api/admin/webhooks', {
              method: 'POST',
              body: JSON.stringify(data),
            });
            if (res.ok) {
              setShowNew(false);
              laden();
            }
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="space-y-3 mt-4">
        {webhooks.map(wh => (
          <WebhookCard key={wh.id} webhook={wh} onUpdate={laden} />
        ))}
      </div>
    </div>
  );
}

function WebhookCard({ webhook, onUpdate }: { webhook: WebhookConfig; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ erfolg: boolean; status?: number; fehler?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleAktiv = async () => {
    await adminFetch(`/api/admin/webhooks/${webhook.id}`, {
      method: 'PUT',
      body: JSON.stringify({ aktiv: !webhook.aktiv }),
    });
    onUpdate();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminFetch(`/api/admin/webhooks/${webhook.id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ erfolg: false, fehler: 'Netzwerkfehler' });
    }
    setTesting(false);
  };

  const handleDelete = async () => {
    await adminFetch(`/api/admin/webhooks/${webhook.id}`, { method: 'DELETE' });
    onUpdate();
  };

  if (editing) {
    return (
      <WebhookForm
        initial={webhook}
        onSave={async (data) => {
          await adminFetch(`/api/admin/webhooks/${webhook.id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
          });
          setEditing(false);
          onUpdate();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${webhook.aktiv ? 'border-emerald-200 bg-emerald-50/30' : 'border-credo-200 bg-credo-50/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={toggleAktiv} title={webhook.aktiv ? 'Deaktivieren' : 'Aktivieren'}>
              {webhook.aktiv
                ? <ToggleRight className="w-6 h-6 text-emerald-600" />
                : <ToggleLeft className="w-6 h-6 text-credo-400" />
              }
            </button>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${webhook.aktiv ? 'bg-emerald-100 text-emerald-700' : 'bg-credo-200 text-credo-500'}`}>
              {webhook.aktiv ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
          <p className="font-mono text-sm text-credo-700 truncate mt-2">{webhook.url || '—'}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-credo-500">
            <span className="bg-credo-100 text-credo-700 px-1.5 py-0.5 rounded font-medium">{TYP_FILTER_LABELS[webhook.typFilter] || 'Alle'}</span>
            {webhook.eventEingereicht && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Eingereicht</span>}
            {webhook.eventStatusGeaendert && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Status</span>}
            {webhook.eventFehler && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Fehler</span>}
            {webhook.authType && webhook.authType !== 'NONE' && (
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{AUTH_TYPE_LABELS[webhook.authType] || webhook.authType}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleTest}
            disabled={testing || !webhook.url}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            title="Test-Webhook senden"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Test
          </button>
          <button onClick={() => setEditing(true)} className="p-1.5 text-credo-400 hover:text-credo-600 rounded" title="Bearbeiten">
            <Edit className="w-4 h-4" />
          </button>
          {deleting ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded hover:bg-red-100">Ja</button>
              <button onClick={() => setDeleting(false)} className="text-xs text-credo-500 px-2 py-1">Nein</button>
            </div>
          ) : (
            <button onClick={() => setDeleting(true)} className="p-1.5 text-credo-400 hover:text-red-500 rounded" title="Löschen">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {testResult && (
        <div className={`mt-3 p-2 rounded text-xs flex items-center gap-2 ${testResult.erfolg ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {testResult.erfolg ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          <span>
            {testResult.erfolg
              ? `Erfolgreich (HTTP ${testResult.status})`
              : `Fehlgeschlagen: ${testResult.fehler || `HTTP ${testResult.status}`}`
            }
          </span>
        </div>
      )}
    </div>
  );
}

function WebhookForm({ initial, onSave, onCancel }: {
  initial?: WebhookConfig;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(initial?.url || 'https://n8n.fes-minden.de/webhook/');
  const [authType, setAuthType] = useState<'NONE' | 'BASIC' | 'HEADER'>(initial?.authType || 'NONE');
  const [authUser, setAuthUser] = useState(initial?.authUser || '');
  const [authPass, setAuthPass] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState(initial?.authHeaderName || '');
  const [authHeaderValue, setAuthHeaderValue] = useState('');
  const [typFilter, setTypFilter] = useState<TypFilter>(initial?.typFilter || 'ALLE');
  const [aktiv, setAktiv] = useState(initial?.aktiv ?? true);
  const [eventEingereicht, setEventEingereicht] = useState(initial?.eventEingereicht ?? true);
  const [eventStatusGeaendert, setEventStatusGeaendert] = useState(initial?.eventStatusGeaendert ?? true);
  const [eventFehler, setEventFehler] = useState(initial?.eventFehler ?? true);
  const [saving, setSaving] = useState(false);
  const [testingUrl, setTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ erfolg: boolean; status?: number; fehler?: string } | null>(null);

  const handleTestUrl = async () => {
    setTestingUrl(true);
    setTestResult(null);
    try {
      const res = await adminFetch('/api/admin/webhooks/test-url', {
        method: 'POST',
        body: JSON.stringify({
          url,
          authType,
          authUser: authType === 'BASIC' ? authUser : null,
          authPass: authType === 'BASIC' ? (authPass || null) : null,
          authHeaderName: authType === 'HEADER' ? authHeaderName : null,
          authHeaderValue: authType === 'HEADER' ? (authHeaderValue || null) : null,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ erfolg: false, fehler: 'Netzwerkfehler' });
    }
    setTestingUrl(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      url,
      authType,
      authUser: authType === 'BASIC' ? authUser : null,
      authPass: authType === 'BASIC' ? (authPass || (initial?.authPass === '***' ? '***' : '')) : null,
      authHeaderName: authType === 'HEADER' ? authHeaderName : null,
      authHeaderValue: authType === 'HEADER' ? (authHeaderValue || (initial?.authHeaderValue === '***' ? '***' : '')) : null,
      typFilter,
      aktiv,
      eventEingereicht,
      eventStatusGeaendert,
      eventFehler,
    });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 space-y-4">
      <h4 className="font-semibold text-credo-900">{initial ? 'Webhook bearbeiten' : 'Neuer Webhook'}</h4>

      <div>
        <label className="label">Einreichungstyp</label>
        <select
          className="input-field"
          value={typFilter}
          onChange={e => setTypFilter(e.target.value as TypFilter)}
        >
          {(Object.keys(TYP_FILTER_LABELS) as TypFilter[]).map(k => (
            <option key={k} value={k}>{TYP_FILTER_LABELS[k]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Webhook-URL (n8n)</label>
        <div className="flex gap-2">
          <input
            type="url"
            className="input-field flex-1"
            placeholder="https://n8n.fes-minden.de/webhook/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={handleTestUrl}
            disabled={testingUrl || !url}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 whitespace-nowrap"
          >
            {testingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Testen
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`p-2 rounded text-xs flex items-center gap-2 ${testResult.erfolg ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {testResult.erfolg ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {testResult.erfolg
            ? `Erfolgreich (HTTP ${testResult.status})`
            : `Fehlgeschlagen: ${testResult.fehler || `HTTP ${testResult.status}`}`
          }
        </div>
      )}

      <div>
        <label className="label">Authentifizierung</label>
        <select
          className="input-field"
          value={authType}
          onChange={e => setAuthType(e.target.value as 'NONE' | 'BASIC' | 'HEADER')}
        >
          <option value="NONE">Keine</option>
          <option value="BASIC">Basic Auth</option>
          <option value="HEADER">Header Auth</option>
        </select>
      </div>

      {authType === 'BASIC' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Benutzername</label>
            <input
              type="text"
              className="input-field"
              placeholder="Benutzername"
              value={authUser}
              onChange={e => setAuthUser(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input
              type="password"
              className="input-field"
              placeholder={initial?.authPass ? '••• gesetzt — leer lassen um beizubehalten' : 'Passwort'}
              value={authPass}
              onChange={e => setAuthPass(e.target.value)}
            />
          </div>
        </div>
      )}

      {authType === 'HEADER' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Header-Name</label>
            <input
              type="text"
              className="input-field font-mono"
              placeholder="z.B. X-Api-Key"
              value={authHeaderName}
              onChange={e => setAuthHeaderName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Header-Wert</label>
            <input
              type="password"
              className="input-field font-mono"
              placeholder={initial?.authHeaderValue ? '••• gesetzt — leer lassen um beizubehalten' : 'Wert'}
              value={authHeaderValue}
              onChange={e => setAuthHeaderValue(e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <label className="label mb-2">Events</label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded border-credo-300" checked={eventEingereicht} onChange={e => setEventEingereicht(e.target.checked)} />
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">Neue Einreichung</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded border-credo-300" checked={eventStatusGeaendert} onChange={e => setEventStatusGeaendert(e.target.checked)} />
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">Statusänderung</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded border-credo-300" checked={eventFehler} onChange={e => setEventFehler(e.target.checked)} />
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">Fehler</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="rounded border-credo-300" checked={aktiv} onChange={e => setAktiv(e.target.checked)} />
          Sofort aktivieren
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="btn-primary text-sm py-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          {initial ? 'Speichern' : 'Webhook anlegen'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm py-2">Abbrechen</button>
      </div>
    </form>
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
