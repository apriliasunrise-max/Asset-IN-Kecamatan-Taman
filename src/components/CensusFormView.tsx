import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Info,
  Search,
} from 'lucide-react';
import type {
  AssetRecord,
  ConditionStatus,
  ExistenceStatus,
  LocationNode,
  UserAccount,
} from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { formatRupiah } from '../lib/exportUtils.ts';

interface CensusFormViewProps {
  currentUser: UserAccount;
  locations: LocationNode[];
  preselectedAsset: AssetRecord | null;
  onSubmitted: () => void;
}

const EXISTENCE_OPTIONS: ExistenceStatus[] = [
  'Ditemukan',
  'Tidak ditemukan',
  'Dalam verifikasi',
  'Belum diperiksa',
];

const CONDITION_OPTIONS: ConditionStatus[] = [
  'Baik',
  'Rusak ringan',
  'Rusak berat',
  'Tidak layak pakai',
];

export function CensusFormView({
  currentUser,
  locations,
  preselectedAsset,
  onSubmitted,
}: CensusFormViewProps) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(preselectedAsset);
  const [searchCode, setSearchCode] = useState('');

  const [existenceStatus, setExistenceStatus] = useState<ExistenceStatus>('Ditemukan');
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus>('Baik');
  const [actualLocationId, setActualLocationId] = useState<number>(
    preselectedAsset?.recorded_location_id || currentUser.location_id
  );
  const [picName, setPicName] = useState(
    preselectedAsset?.latest_pic_name || currentUser.name
  );
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void apiRequest<{ assets: AssetRecord[] }>('/assets').then((res) => {
      setAssets(res.assets);
      if (!selectedAsset && res.assets.length > 0) {
        const firstUninspected =
          res.assets.find((a) => a.latest_existence_status === 'Belum diperiksa') ||
          res.assets[0];
        setSelectedAsset(firstUninspected);
        setActualLocationId(firstUninspected.recorded_location_id);
        setConditionStatus(firstUninspected.recorded_condition);
      }
    });
  }, []);

  useEffect(() => {
    if (preselectedAsset) {
      setSelectedAsset(preselectedAsset);
      setActualLocationId(preselectedAsset.recorded_location_id);
      setConditionStatus(
        preselectedAsset.latest_condition_status || preselectedAsset.recorded_condition
      );
      setPicName(preselectedAsset.latest_pic_name || currentUser.name);
      setFeedback(null);
    }
  }, [preselectedAsset]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setFeedback(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await apiRequest<{ url: string }>('/uploads', {
            method: 'POST',
            body: JSON.stringify({ dataUrl: reader.result }),
          });
          setPhotoUrl(res.url);
        } catch (err) {
          setFeedback({
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal mengunggah foto bukti.',
          });
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest('/inspections', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: selectedAsset.id,
          existence_status: existenceStatus,
          condition_status: conditionStatus,
          actual_location_id: actualLocationId,
          pic_name: picName,
          photo_url: photoUrl,
          notes,
        }),
      });
      setFeedback({
        type: 'success',
        text:
          existenceStatus === 'Tidak ditemukan'
            ? `Sensus ${selectedAsset.asset_id} tersimpan dengan status "Dalam verifikasi" dan masuk antrean verifikasi manual Pengurus Barang.`
            : `Hasil sensus ${selectedAsset.asset_id} berhasil dikirim ke antrean verifikasi Pengurus Barang.`,
      });
      setNotes('');
      setPhotoUrl(null);
      onSubmitted();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan hasil sensus.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (!searchCode.trim()) return true;
    const q = searchCode.toLowerCase();
    return (
      a.asset_id.toLowerCase().includes(q) ||
      a.register_number.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
    );
  });

  // Group locations nicely for actual location dropdown
  const parentMap = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          Form Sensus Fisik Aset (Mobile-Ready)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Catat keberadaan fisik, kondisi aktual, lokasi nyata, dan bukti foto lapangan secara terpisah
        </p>
      </div>

      {/* Strict Rules Reminder */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 flex items-start gap-3 text-xs text-sky-950">
        <Info className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
        <div>
          Status <strong>Keberadaan</strong> dan <strong>Kondisi Fisik</strong> wajib diisi terpisah.
          Jika aset dipilih <em>Tidak ditemukan</em>, sistem otomatis meneruskannya ke antrean verifikasi manual dan tidak menghapus data KIB B.
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 flex items-start gap-2.5 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Asset Selector */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <label className="text-xs font-semibold text-slate-800 block">
          1. Pilih Aset KIB B yang Diperiksa
        </label>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="Filter cepat Asset ID atau Nama Barang..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
        <select
          value={selectedAsset?.id || ''}
          onChange={(e) => {
            const found = assets.find((a) => a.id === Number(e.target.value)) || null;
            setSelectedAsset(found);
            if (found) {
              setActualLocationId(found.recorded_location_id);
              setConditionStatus(found.latest_condition_status || found.recorded_condition);
              setPicName(found.latest_pic_name || currentUser.name);
            }
          }}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white"
        >
          {filteredAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.asset_id} — {a.name} ({a.recorded_location_name}) [{a.latest_existence_status}]
            </option>
          ))}
        </select>

        {selectedAsset && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-slate-400">No. Register</div>
              <div className="font-mono font-medium text-slate-900">
                {selectedAsset.register_number}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Merk / Tahun</div>
              <div className="font-medium text-slate-900">
                {selectedAsset.brand} · {selectedAsset.acquisition_year}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Lokasi Tercatat KIB</div>
              <div className="font-medium text-slate-900">
                {selectedAsset.recorded_location_name}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Nilai KIB B</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatRupiah(selectedAsset.acquisition_value)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Physical Inspection Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-6"
      >
        {/* Strict Rule 3: Separated Existence Status */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-900 block">
            2. Status Keberadaan Fisik <span className="text-red-600">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {EXISTENCE_OPTIONS.map((opt) => {
              const active = existenceStatus === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setExistenceStatus(opt)}
                  className={`px-3 py-3 rounded-lg border text-xs font-medium text-center transition-colors min-h-[44px] ${
                    active
                      ? 'border-sky-600 bg-sky-50 text-sky-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Strict Rule 3: Separated Condition Status */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-900 block">
            3. Status Kondisi Fisik Aktual <span className="text-red-600">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CONDITION_OPTIONS.map((opt) => {
              const active = conditionStatus === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setConditionStatus(opt)}
                  className={`px-3 py-3 rounded-lg border text-xs font-medium text-center transition-colors min-h-[44px] ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-900 block">
              4. Lokasi Aktual Aset Ditemukan <span className="text-red-600">*</span>
            </label>
            <select
              value={actualLocationId}
              onChange={(e) => setActualLocationId(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white min-h-[44px]"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.parent_id ? `${parentMap.get(loc.parent_id)} — ` : ''}
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
            {selectedAsset && actualLocationId !== selectedAsset.recorded_location_id && (
              <div className="text-[11px] text-amber-700">
                Terdeteksi perbedaan dengan lokasi tercatat KIB B ({selectedAsset.recorded_location_name}).
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-900 block">
              5. Penanggung Jawab / Pengguna Aset <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              placeholder="Nama ASN / Staf pengguna barang"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg min-h-[44px]"
            />
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-900 block">
            6. Foto Bukti Fisik & Tempelan QR
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer min-h-[44px]">
              <Camera className="h-4 w-4" />
              {uploadingPhoto ? 'Mengunggah foto...' : 'Ambil / Unggah Foto Bukti'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
            {photoUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={photoUrl}
                  alt="Pratinjau foto bukti fisik"
                  referrerPolicy="no-referrer"
                  className="h-16 w-24 object-cover rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Hapus foto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-900 block">
            7. Catatan Lapangan
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catat kondisi detail, lokasi rak/meja, atau keterangan jika aset sedang dipinjam..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !selectedAsset || uploadingPhoto}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50 min-h-[44px]"
          >
            {submitting ? 'Mengirim ke Antrean Verifikasi...' : 'Simpan & Kirim Hasil Sensus'}
          </button>
        </div>
      </form>
    </div>
  );
}
