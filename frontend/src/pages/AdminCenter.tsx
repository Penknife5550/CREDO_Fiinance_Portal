import { useState, useEffect } from 'react';
import { Building2, DollarSign, Mail, Activity, Plus, Edit, ToggleLeft, ToggleRight, LogOut, Lock, Save, Trash2, Zap, CheckCircle, XCircle, Loader2, Send, X, Check } from 'lucide-react';
import { adminLogin, adminLogout, checkSession, adminFetch } from '@/lib/adminAuth';

const TABS = [
  { id: 'mandanten', label: 'Mandanten', icon: Building2 },
  { id: 'pauschalen', label: 'Pauschalen', icon: DollarSign },
  { id: 'versand', label: 'Versand & Integration', icon: Mail },
  { id: 'protokoll', label: 'Protokoll', icon: Activity },
];

interface Mandant {
  id: string;
  mandantNr: number;
  name: string;
  kategorie: string;
  dmsEmail: string;
  primaerfarbe: string;
  logo: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
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
  const [mandanten, setMandanten] = useState<Mandant[]>([]);
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

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    kategorie: '',
    dmsEmail: '',
    primaerfarbe: '#6B7280',
    active: true,
  });

  const loadMandanten = async () => {
    try {
      setFehler('');
      const res = await adminFetch('/api/admin/mandanten');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setMandanten(data);
    } catch {
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

  const startEdit = (m: Mandant) => {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      kategorie: m.kategorie,
      dmsEmail: m.dmsEmail,
      primaerfarbe: m.primaerfarbe,
      active: m.active,
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
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m: Mandant) => {
    try {
      const res = await adminFetch(`/api/admin/mandanten/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !m.active }),
      });
      if (!res.ok) throw new Error('Fehler');
      await loadMandanten();
    } catch {
      alert('Status konnte nicht geändert werden.');
    }
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
                <td colSpan={7} className="p-6 text-center text-credo-400">
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

// ── Pauschalen Tab (editierbar) ────────────────────────

interface AuslandRow {
  id: number;
  land: string;
  t8h: string;
  t24h: string;
  ueb: string;
}

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

  // Auslandspauschalen state
  const [ausland, setAusland] = useState<AuslandRow[]>([
    { id: 1, land: 'Österreich', t8h: '27,00', t24h: '40,00', ueb: '105,00' },
    { id: 2, land: 'Schweiz', t8h: '43,00', t24h: '64,00', ueb: '180,00' },
    { id: 3, land: 'Niederlande', t8h: '32,00', t24h: '47,00', ueb: '125,00' },
    { id: 4, land: 'Frankreich', t8h: '39,00', t24h: '58,00', ueb: '148,00' },
  ]);
  const [nextId, setNextId] = useState(5);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<AuslandRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState<Omit<AuslandRow, 'id'>>({ land: '', t8h: '', t24h: '', ueb: '' });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const updatePauschale = (key: keyof typeof pauschalen, value: string) => {
    setPauschalen({ ...pauschalen, [key]: value });
  };

  const handleSave = () => {
    // TODO: API-Call PUT /api/admin/pauschalen
    setEditing(false);
    alert('Pauschalen gespeichert');
  };

  const startEditRow = (row: AuslandRow) => {
    setEditingRowId(row.id);
    setEditDraft({ ...row });
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    setEditDraft(null);
  };

  const saveEditRow = () => {
    if (!editDraft) return;
    setAusland(prev => prev.map(r => r.id === editDraft.id ? editDraft : r));
    setEditingRowId(null);
    setEditDraft(null);
  };

  const handleAddRow = () => {
    if (!newRow.land.trim()) return;
    setAusland(prev => [...prev, { id: nextId, ...newRow }]);
    setNextId(n => n + 1);
    setNewRow({ land: '', t8h: '', t24h: '', ueb: '' });
    setShowAddForm(false);
  };

  const handleDeleteRow = (id: number) => {
    setAusland(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
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
          <button onClick={() => { setShowAddForm(true); setNewRow({ land: '', t8h: '', t24h: '', ueb: '' }); }} className="btn-secondary text-sm py-2">
            <Plus className="w-4 h-4 mr-1.5" />
            Land hinzufügen
          </button>
        </div>

        {/* Add new country form */}
        {showAddForm && (
          <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 mb-4 space-y-3">
            <h4 className="font-semibold text-credo-900 text-sm">Neues Land hinzufügen</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Land</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="z.B. Belgien"
                  value={newRow.land}
                  onChange={e => setNewRow({ ...newRow, land: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Tagessatz &gt;8h (EUR)</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="0,00"
                  value={newRow.t8h}
                  onChange={e => setNewRow({ ...newRow, t8h: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tagessatz 24h (EUR)</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="0,00"
                  value={newRow.t24h}
                  onChange={e => setNewRow({ ...newRow, t24h: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Übernachtung (EUR)</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="0,00"
                  value={newRow.ueb}
                  onChange={e => setNewRow({ ...newRow, ueb: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAddRow} disabled={!newRow.land.trim()} className="btn-primary text-sm py-2 disabled:opacity-50">
                <Check className="w-4 h-4 mr-1.5" />
                Hinzufügen
              </button>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary text-sm py-2">
                Abbrechen
              </button>
            </div>
          </div>
        )}

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
              {ausland.map((row, i) => (
                <tr key={row.id} className={`border-t border-credo-100 ${i % 2 ? 'bg-credo-50/30' : ''}`}>
                  {editingRowId === row.id && editDraft ? (
                    <>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input-field py-1.5 px-2 text-sm"
                          value={editDraft.land}
                          onChange={e => setEditDraft({ ...editDraft, land: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input-field py-1.5 px-2 text-right font-mono text-sm w-24 ml-auto"
                          value={editDraft.t8h}
                          onChange={e => setEditDraft({ ...editDraft, t8h: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input-field py-1.5 px-2 text-right font-mono text-sm w-24 ml-auto"
                          value={editDraft.t24h}
                          onChange={e => setEditDraft({ ...editDraft, t24h: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input-field py-1.5 px-2 text-right font-mono text-sm w-24 ml-auto"
                          value={editDraft.ueb}
                          onChange={e => setEditDraft({ ...editDraft, ueb: e.target.value })}
                        />
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <button onClick={saveEditRow} className="text-emerald-600 hover:text-emerald-700 p-1" title="Speichern">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEditRow} className="text-credo-400 hover:text-credo-600 p-1" title="Abbrechen">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 font-medium text-credo-900">{row.land}</td>
                      <td className="p-3 text-right font-mono">{row.t8h} EUR</td>
                      <td className="p-3 text-right font-mono">{row.t24h} EUR</td>
                      <td className="p-3 text-right font-mono">{row.ueb} EUR</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button onClick={() => startEditRow(row)} className="text-credo-400 hover:text-credo-600 p-1" title="Bearbeiten">
                          <Edit className="w-4 h-4" />
                        </button>
                        {deletingId === row.id ? (
                          <span className="inline-flex items-center gap-1 ml-1">
                            <button onClick={() => handleDeleteRow(row.id)} className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 rounded hover:bg-red-100">Ja</button>
                            <button onClick={() => setDeletingId(null)} className="text-xs text-credo-500 px-2 py-1">Nein</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingId(row.id)} className="text-credo-400 hover:text-red-500 p-1" title="Löschen">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {ausland.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-credo-400 text-sm">
                    Keine Auslandspauschalen vorhanden. Klicken Sie auf &quot;Land hinzufügen&quot;.
                  </td>
                </tr>
              )}
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
  eventEingereicht: boolean;
  eventStatusGeaendert: boolean;
  eventFehler: boolean;
  updatedAt: string;
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  NONE: 'Keine',
  BASIC: 'Basic Auth',
  HEADER: 'Header Auth',
};

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

      <WebhookSection />
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
          <div className="flex gap-3 mt-2 text-xs text-credo-500">
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
