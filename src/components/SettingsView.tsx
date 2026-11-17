import React, { useEffect, useState } from 'react';
import { Calendar, Database, Download, Plus, ShieldCheck } from 'lucide-react';
import type { AuditLog, CensusPeriod, UserAccount } from '../types.ts';
import { apiRequest, getSessionToken } from '../lib/api.ts';

interface SettingsViewProps {
  currentUser: UserAccount;
  onPeriodChanged: () => void;
}

export function SettingsView({ currentUser, onPeriodChanged }: SettingsViewProps) {
  const [periods, setPeriods] = useState<CensusPeriod[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dbSizeBytes, setDbSizeBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('2027-01-05');
  const [endDate, setEndDate] = useState('2027-03-31');
  const [activateNow, setActivateNow] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        periods: CensusPeriod[];
        auditLogs: AuditLog[];
        dbSizeBytes: number;
      }>('/settings');
      setPeriods(res.periods);
      setAuditLogs(res.auditLogs);
      setDbSizeBytes(res.dbSizeBytes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/settings/periods', {
      method: 'POST',
      body: JSON.stringify({
        code,
        name,
        year: Number(startDate.slice(0, 4)) || 2027,
        start_date: startDate,
        end_date: endDate,
        activate: activateNow,
      }),
    });
    setCode('');
    setName('');
    setFeedback('Periode sensus baru berhasil dibuat.');
    await loadSettings();
    onPeriodChanged();
  };

  const handleUpdatePeriodStatus = async (id: number, status: 'Aktif' | 'Ditutup') => {
    await apiRequest(`/settings/periods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setFeedback(`Status periode sensus berhasil diubah menjadi ${status}.`);
    await loadSettings();
    onPeriodChanged();
  };

  const handleDownloadBackup = async () => {
    const token = getSessionToken();
    const res = await fetch('/api/settings/backup', {
      headers: token ? { 'x-session-token': token } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assetin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canBackup = currentUser.permissions.includes('settings:manage');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          Pengaturan Sistem & Periode Sensus
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Konfigurasi periode sensus aktif, backup basis data relasional, dan audit log sistem
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Census Periods List */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-sky-700" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Daftar Periode Sensus KIB B
            </h3>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500">Memuat periode...</div>
          ) : (
            <div className="space-y-3">
              {periods.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-sky-700">{p.code}</span>
                      <span
                        className={`text-xs font-semibold ${
                          p.status === 'Aktif'
                            ? 'text-emerald-700'
                            : p.status === 'Ditutup'
                            ? 'text-slate-500'
                            : 'text-amber-700'
                        }`}
                      >
                        · {p.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {p.start_date} s.d. {p.end_date}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status !== 'Aktif' && (
                      <button
                        onClick={() => handleUpdatePeriodStatus(p.id, 'Aktif')}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
                      >
                        Aktifkan
                      </button>
                    )}
                    {p.status === 'Aktif' && (
                      <button
                        onClick={() => handleUpdatePeriodStatus(p.id, 'Ditutup')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50"
                      >
                        Tutup Periode
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create New Period */}
          <form
            onSubmit={handleCreatePeriod}
            className="pt-4 border-t border-slate-200 space-y-3 text-xs"
          >
            <h4 className="font-semibold text-slate-900">Buat Periode Sensus Baru</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Kode (mis. SENSUS-2027-S1)"
                className="px-3 py-2 border border-slate-200 rounded-lg font-mono"
              />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama Periode Sensus"
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={activateNow}
                onChange={(e) => setActivateNow(e.target.checked)}
              />
              Jadikan periode aktif saat disimpan
            </label>
            <div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Simpan Periode Sensus
              </button>
            </div>
          </form>
        </section>

        {/* Database Backup & Integrity */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-sky-700" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Backup Database Relasional
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unduh salinan cadangan penuh seluruh tabel relasional ASSET-IN (KIB B, inspeksi,
              lokasi, pengguna, tiket pemeliharaan, dan audit trail) dalam format terstruktur.
            </p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs flex justify-between">
              <span className="text-slate-500">Ukuran Basis Data SQLite</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {(dbSizeBytes / 1024).toFixed(1)} KB
              </span>
            </div>
            {canBackup ? (
              <button
                onClick={handleDownloadBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Unduh Backup Database (.json)
              </button>
            ) : (
              <div className="text-xs text-slate-500">
                Hanya Admin Sistem yang dapat mengunduh backup database penuh.
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Audit Log Sistem Terbaru
              </h3>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {auditLogs.slice(0, 15).map((l) => (
                <div key={l.id} className="py-2.5 space-y-0.5">
                  <div className="text-slate-800 font-medium">{l.summary}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {l.created_at} · {l.user_name} ({l.action})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
