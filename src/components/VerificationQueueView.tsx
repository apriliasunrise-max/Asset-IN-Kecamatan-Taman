import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  MessageSquare,
  MapPin,
} from 'lucide-react';
import type { AssetInspection, UserAccount } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import {
  ConditionLabel,
  ExistenceLabel,
  VerificationLabel,
} from './StatusPrimitives.tsx';

interface VerificationQueueViewProps {
  currentUser: UserAccount;
  onVerified: () => void;
}

export function VerificationQueueView({
  currentUser,
  onVerified,
}: VerificationQueueViewProps) {
  const [inspections, setInspections] = useState<AssetInspection[]>([]);
  const [statusFilter, setStatusFilter] = useState<'Menunggu Verifikasi' | 'ALL' | 'Disetujui' | 'Dikembalikan'>('Menunggu Verifikasi');
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<AssetInspection | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [koordinatorTarget, setKoordinatorTarget] = useState<AssetInspection | null>(null);
  const [koordinatorNote, setKoordinatorNote] = useState('');
  const [confirmMissingTarget, setConfirmMissingTarget] = useState<AssetInspection | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadInspections = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ inspections: AssetInspection[] }>(
        `/inspections?status=${encodeURIComponent(statusFilter)}`
      );
      setInspections(res.inspections);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInspections();
  }, [statusFilter]);

  const canApprove = currentUser.permissions.includes('verification:approve');
  const canKoordinatorReview = currentUser.permissions.includes(
    'verification:koordinator_review'
  );

  const handleApprove = async (insp: AssetInspection, confirmMissing = false) => {
    if (insp.existence_status === 'Dalam verifikasi' && !confirmMissing) {
      setConfirmMissingTarget(insp);
      return;
    }

    setBusyId(insp.id);
    setFeedback(null);
    try {
      await apiRequest(`/inspections/${insp.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision: 'Disetujui',
          confirm_missing: confirmMissing,
        }),
      });
      setConfirmMissingTarget(null);
      setFeedback(`Hasil sensus ${insp.asset_code} telah disetujui. Data KIB B induk tetap terjaga.`);
      await loadInspections();
      onVerified();
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget || !rejectionReason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      await apiRequest(`/inspections/${rejectTarget.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision: 'Dikembalikan',
          rejection_reason: rejectionReason.trim(),
        }),
      });
      setFeedback(`Hasil sensus ${rejectTarget.asset_code} dikembalikan ke petugas untuk revisi.`);
      setRejectTarget(null);
      setRejectionReason('');
      await loadInspections();
      onVerified();
    } finally {
      setBusyId(null);
    }
  };

  const handleKoordinatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!koordinatorTarget || !koordinatorNote.trim()) return;
    setBusyId(koordinatorTarget.id);
    try {
      await apiRequest(`/inspections/${koordinatorTarget.id}/koordinator-review`, {
        method: 'PATCH',
        body: JSON.stringify({ koordinator_note: koordinatorNote.trim() }),
      });
      setFeedback(`Catatan review awal untuk ${koordinatorTarget.asset_code} berhasil disimpan.`);
      setKoordinatorTarget(null);
      setKoordinatorNote('');
      await loadInspections();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Antrean Verifikasi Hasil Sensus
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tinjau kesesuaian bukti lapangan, selisih lokasi, dan konfirmasi manual aset belum ditemukan
          </p>
        </div>

        {/* Segmented filter tabs */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(
            [
              { id: 'Menunggu Verifikasi', label: 'Menunggu' },
              { id: 'Disetujui', label: 'Disetujui' },
              { id: 'Dikembalikan', label: 'Dikembalikan' },
              { id: 'ALL', label: 'Semua' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-sm text-slate-500">
          Memuat antrean verifikasi...
        </div>
      ) : inspections.length === 0 ? (
        <div className="p-10 bg-white rounded-xl border border-slate-200 text-center space-y-1">
          <div className="text-sm font-medium text-slate-900">
            Tidak ada data pada status &ldquo;{statusFilter}&rdquo;
          </div>
          <div className="text-xs text-slate-500">
            Semua laporan pemeriksaan fisik pada filter ini telah ditindaklanjuti.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.map((insp) => {
            const hasDiscrepancy = insp.actual_location_id !== insp.recorded_location_id;
            return (
              <article
                key={insp.id}
                className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900">
                        {insp.asset_code}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-500">{insp.register_number}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{insp.period_name}</span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      {insp.asset_name}
                    </h3>
                    <div className="text-xs text-slate-500">
                      Pemeriksa: <strong className="text-slate-700">{insp.inspector_name}</strong> ·{' '}
                      <span className="font-mono">{insp.inspected_at}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ExistenceLabel status={insp.existence_status} />
                    <ConditionLabel status={insp.condition_status} />
                    <VerificationLabel status={insp.verification_status} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
                  <div className="md:col-span-8 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 rounded-lg p-3.5 border border-slate-200">
                      <div>
                        <div className="text-slate-400">Lokasi Tercatat (KIB B)</div>
                        <div className="font-medium text-slate-900">
                          {insp.recorded_location_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Kondisi KIB: {insp.recorded_condition}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Lokasi Aktual Lapangan</div>
                        <div
                          className={`font-medium flex items-center gap-1 ${
                            hasDiscrepancy ? 'text-amber-800' : 'text-slate-900'
                          }`}
                        >
                          {hasDiscrepancy && <MapPin className="h-3.5 w-3.5 text-amber-600" />}
                          {insp.actual_location_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          PIC / Pengguna: {insp.pic_name}
                        </div>
                      </div>
                    </div>

                    {insp.notes && (
                      <div className="text-slate-700">
                        <span className="font-semibold text-slate-900">Catatan Petugas: </span>
                        {insp.notes}
                      </div>
                    )}

                    {insp.koordinator_note && (
                      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-950">
                        <span className="font-semibold">
                          Review Awal Koordinator ({insp.koordinator_reviewed_by}):{' '}
                        </span>
                        {insp.koordinator_note}
                      </div>
                    )}

                    {insp.rejection_reason && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
                        <span className="font-semibold">Alasan Pengembalian: </span>
                        {insp.rejection_reason}
                      </div>
                    )}

                    {insp.existence_status === 'Dalam verifikasi' && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Aset dilaporkan tidak berada di tempat. Persetujuan manual Pengurus Barang diperlukan sebelum menandai status akhir Tidak Ditemukan (data KIB B resmi tidak otomatis dihapus).
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Evidence photo */}
                  <div className="md:col-span-4">
                    {insp.photo_url ? (
                      <img
                        src={insp.photo_url}
                        alt={`Bukti fisik ${insp.asset_name}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-40 object-cover rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="w-full h-40 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
                        Tidak ada foto bukti terlampir
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                {insp.verification_status === 'Menunggu Verifikasi' && (
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
                    {canKoordinatorReview && (
                      <button
                        onClick={() => {
                          setKoordinatorTarget(insp);
                          setKoordinatorNote(insp.koordinator_note || '');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 text-xs font-medium hover:bg-sky-100"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Tambah Review Awal Kelurahan
                      </button>
                    )}

                    {canApprove && (
                      <>
                        <button
                          onClick={() => {
                            setRejectTarget(insp);
                            setRejectionReason('');
                          }}
                          disabled={busyId === insp.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 bg-white text-red-700 text-xs font-medium hover:bg-red-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Kembalikan untuk Revisi
                        </button>
                        <button
                          onClick={() => handleApprove(insp)}
                          disabled={busyId === insp.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Setujui Hasil Sensus
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleRejectSubmit}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display text-base font-bold text-slate-900">
              Kembalikan Hasil Sensus ({rejectTarget.asset_code})
            </h3>
            <p className="text-xs text-slate-600">
              Tuliskan alasan pengembalian agar petugas lapangan dapat melengkapi bukti atau memperbaiki data.
            </p>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Foto bukti QR belum terlihat jelas, mohon foto ulang."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
              >
                Kirim Pengembalian
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Missing Manual Verification Modal (Strict Rule 2) */}
      {confirmMissingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Konfirmasi Manual Aset Belum Ditemukan
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Anda akan menyetujui status <strong>Tidak ditemukan</strong> untuk{' '}
                  <span className="font-mono font-semibold">{confirmMissingTarget.asset_code}</span>{' '}
                  ({confirmMissingTarget.asset_name}). Sesuai aturan sistem, pencatatan resmi KIB B{' '}
                  <strong>tidak otomatis dihapus</strong> dan tetap memerlukan Berita Acara penelusuran lanjutan.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmMissingTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleApprove(confirmMissingTarget, true)}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
              >
                Konfirmasi & Setujui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Koordinator Review Modal */}
      {koordinatorTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleKoordinatorSubmit}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display text-base font-bold text-slate-900">
              Review Awal Koordinator ({koordinatorTarget.asset_code})
            </h3>
            <textarea
              required
              rows={3}
              value={koordinatorNote}
              onChange={(e) => setKoordinatorNote(e.target.value)}
              placeholder="Catatan verifikasi awal tingkat Kelurahan..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setKoordinatorTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
              >
                Simpan Review
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
