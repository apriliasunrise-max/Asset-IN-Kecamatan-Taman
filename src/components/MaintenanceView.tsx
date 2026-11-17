import React, { useEffect, useState } from 'react';
import { Plus, Wrench, X } from 'lucide-react';
import type {
  AssetRecord,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTicket,
  UserAccount,
} from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { PriorityText, TicketStatusLabel } from './StatusPrimitives.tsx';

interface MaintenanceViewProps {
  currentUser: UserAccount;
  preselectedAsset: AssetRecord | null;
  onClearPreselected: () => void;
}

export function MaintenanceView({
  currentUser,
  preselectedAsset,
  onClearPreselected,
}: MaintenanceViewProps) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(Boolean(preselectedAsset));
  const [editingTicket, setEditingTicket] = useState<MaintenanceTicket | null>(null);

  // Form states
  const [assetId, setAssetId] = useState<number>(preselectedAsset?.id || 0);
  const [assignedPic, setAssignedPic] = useState('Teknisi Kecamatan Taman');
  const [priority, setPriority] = useState<MaintenancePriority>('Sedang');
  const [targetDate, setTargetDate] = useState('2026-12-05');
  const [issueDescription, setIssueDescription] = useState('');

  // Edit ticket states
  const [editStatus, setEditStatus] = useState<MaintenanceStatus>('Dalam Proses');
  const [editPic, setEditPic] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, aRes] = await Promise.all([
        apiRequest<{ tickets: MaintenanceTicket[] }>('/maintenance'),
        apiRequest<{ assets: AssetRecord[] }>('/assets'),
      ]);
      setTickets(tRes.tickets);
      setAssets(aRes.assets);
      if (!assetId && aRes.assets.length > 0) {
        setAssetId(aRes.assets[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (preselectedAsset) {
      setAssetId(preselectedAsset.id);
      setShowCreate(true);
      onClearPreselected();
    }
  }, [preselectedAsset]);

  const canCreate =
    currentUser.permissions.includes('maintenance:manage') ||
    currentUser.permissions.includes('maintenance:report');
  const canManage = currentUser.permissions.includes('maintenance:manage');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: assetId,
        assigned_pic: assignedPic,
        issue_description: issueDescription,
        priority,
        target_date: targetDate,
      }),
    });
    setIssueDescription('');
    setShowCreate(false);
    await loadData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    await apiRequest(`/maintenance/${editingTicket.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: editStatus,
        assigned_pic: editPic,
        resolution_notes: editNotes,
      }),
    });
    setEditingTicket(null);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Manajemen Tiket Pemeliharaan Aset
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pelaporan kerusakan fisik, penugasan teknisi/PIC, target penyelesaian, dan dokumentasi perbaikan
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Buat Tiket Pemeliharaan
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] px-5 py-3.5 text-white flex items-center justify-between">
          <div className="text-sm font-display font-semibold">
            Daftar Tiket Pemeliharaan &amp; Perbaikan Aset
          </div>
          <div className="font-mono text-xs text-cyan-200 tabular-nums">
            {tickets.length} tiket
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat tiket pemeliharaan...</div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Wrench className="h-8 w-8 text-slate-300 mx-auto" />
            <div className="text-sm font-medium text-slate-900">Belum ada tiket pemeliharaan</div>
            <div className="text-xs text-slate-500">
              Buat tiket saat ditemukan aset rusak ringan atau rusak berat pada hasil sensus.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-100 border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Kode Tiket</th>
                  <th className="py-3 px-4">Aset & Lokasi</th>
                  <th className="py-3 px-4">Deskripsi Masalah & Tindak Lanjut</th>
                  <th className="py-3 px-4">PIC & Target</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4">Status</th>
                  {canManage && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/60 transition-colors"
                  >
                    <td className="py-3 px-4 align-top font-mono font-semibold text-slate-900">
                      {t.ticket_code}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-mono text-[11px] text-sky-700">{t.asset_code}</div>
                      <div className="font-medium text-slate-900">{t.asset_name}</div>
                      <div className="text-[11px] text-slate-500">{t.location_name}</div>
                    </td>
                    <td className="py-3 px-4 align-top max-w-sm space-y-1">
                      <div className="text-slate-800">{t.issue_description}</div>
                      {t.resolution_notes && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50 rounded p-2">
                          Catatan Perbaikan: {t.resolution_notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-medium text-slate-900">{t.assigned_pic}</div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        Target: {t.target_date}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <PriorityText priority={t.priority} />
                    </td>
                    <td className="py-3 px-4 align-top">
                      <TicketStatusLabel status={t.status} />
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 align-top text-right">
                        <button
                          onClick={() => {
                            setEditingTicket(t);
                            setEditStatus(t.status);
                            setEditPic(t.assigned_pic);
                            setEditNotes(t.resolution_notes || '');
                          }}
                          className="px-3 py-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium"
                        >
                          Perbarui
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Buat Tiket Pemeliharaan Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Aset KIB B</label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_id} — {a.name} ({a.recorded_location_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Prioritas</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Rendah">Rendah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Tinggi">Tinggi</option>
                    <option value="Mendesak">Mendesak</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Selesai</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  PIC / Rekanan Teknisi
                </label>
                <input
                  type="text"
                  required
                  value={assignedPic}
                  onChange={(e) => setAssignedPic(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Deskripsi Kerusakan / Tindakan
                </label>
                <textarea
                  required
                  rows={3}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Jelaskan kendala teknis atau kerusakan aset..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
              >
                Simpan Tiket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleUpdate}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs"
          >
            <h3 className="font-display text-base font-bold text-slate-900">
              Update Tiket {editingTicket.ticket_code}
            </h3>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Status Tiket</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as MaintenanceStatus)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Terbuka">Terbuka</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditutup">Ditutup</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">PIC Pelaksana</label>
              <input
                type="text"
                value={editPic}
                onChange={(e) => setEditPic(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Dokumentasi / Catatan Perbaikan
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Catatan hasil perbaikan atau pergantian komponen..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTicket(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
