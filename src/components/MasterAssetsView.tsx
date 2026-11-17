import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  X,
  ClipboardCheck,
  Wrench,
  Lock,
  MapPin,
} from 'lucide-react';
import type {
  AssetInspection,
  AssetRecord,
  AuditLog,
  LocationNode,
  MaintenanceTicket,
  UserAccount,
} from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { formatRupiah } from '../lib/exportUtils.ts';
import {
  ConditionLabel,
  ExistenceLabel,
  TicketStatusLabel,
  VerificationLabel,
} from './StatusPrimitives.tsx';

interface MasterAssetsViewProps {
  currentUser: UserAccount;
  locations: LocationNode[];
  initialSelectedAssetId?: number | null;
  onClearInitialAsset?: () => void;
  onStartCensusForAsset: (asset: AssetRecord) => void;
  onCreateMaintenanceForAsset: (asset: AssetRecord) => void;
}

export function MasterAssetsView({
  currentUser,
  locations,
  initialSelectedAssetId,
  onClearInitialAsset,
  onStartCensusForAsset,
  onCreateMaintenanceForAsset,
}: MasterAssetsViewProps) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [condition, setCondition] = useState('ALL');
  const [locationId, setLocationId] = useState('ALL');
  const [existence, setExistence] = useState('ALL');

  const [detailAsset, setDetailAsset] = useState<AssetRecord | null>(null);
  const [detailInspections, setDetailInspections] = useState<AssetInspection[]>([]);
  const [detailTickets, setDetailTickets] = useState<MaintenanceTicket[]>([]);
  const [detailLogs, setDetailLogs] = useState<AuditLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category !== 'ALL') params.set('category', category);
      if (condition !== 'ALL') params.set('condition', condition);
      if (locationId !== 'ALL') params.set('locationId', locationId);
      if (existence !== 'ALL') params.set('existence', existence);

      const res = await apiRequest<{ assets: AssetRecord[] }>(`/assets?${params.toString()}`);
      setAssets(res.assets);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, [category, condition, locationId, existence]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await apiRequest<{
        asset: AssetRecord;
        inspections: AssetInspection[];
        tickets: MaintenanceTicket[];
        logs: AuditLog[];
      }>(`/assets/${id}`);
      setDetailAsset(res.asset);
      setDetailInspections(res.inspections);
      setDetailTickets(res.tickets);
      setDetailLogs(res.logs);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (initialSelectedAssetId) {
      void openDetail(initialSelectedAssetId);
      onClearInitialAsset?.();
    }
  }, [initialSelectedAssetId]);

  const unitLocations = locations.filter((l) => l.type === 'Kecamatan' || l.type === 'Kelurahan');
  const categories = [
    'Komputer & TI',
    'Peralatan Kantor',
    'Pendingin Ruangan',
    'Kendaraan Dinas',
    'Audio Visual',
    'Meubelair & Arsip',
    'Peralatan Listrik',
  ];

  const canCensus = currentUser.permissions.includes('census:submit');
  const canMaintenance =
    currentUser.permissions.includes('maintenance:manage') ||
    currentUser.permissions.includes('maintenance:report');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Master Kartu Inventaris Barang B (KIB B)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Data resmi hasil import KIB B bersifat tetap (immutable) · Menayangkan status keberadaan & kondisi aktual hasil sensus secara terpisah
          </p>
        </div>
        <div className="text-xs text-slate-600 font-mono tabular-nums">
          Menampilkan {assets.length} aset pada wilayah akses Anda
        </div>
      </div>

      {/* Multi-Criteria Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadAssets();
            }}
            className="flex-1 flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari Asset ID, No. Register, Kode KIB, Nama Barang, Merk..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 whitespace-nowrap"
            >
              Cari
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">Semua Lokasi Terdaftar</option>
              {unitLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">Kondisi KIB B: Semua</option>
              <option value="Baik">Baik</option>
              <option value="Rusak ringan">Rusak ringan</option>
              <option value="Rusak berat">Rusak berat</option>
              <option value="Tidak layak pakai">Tidak layak pakai</option>
            </select>

            <select
              value={existence}
              onChange={(e) => setExistence(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">Keberadaan: Semua</option>
              <option value="Belum diperiksa">Belum diperiksa</option>
              <option value="Ditemukan">Ditemukan</option>
              <option value="Dalam verifikasi">Dalam verifikasi</option>
              <option value="Tidak ditemukan">Tidak ditemukan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat data Master KIB B...</div>
        ) : assets.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="text-sm font-medium text-slate-900">Tidak ada aset KIB B yang cocok</div>
            <div className="text-xs text-slate-500">
              Ubah kata kunci pencarian atau reset filter lokasi/kondisi.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Asset ID & Register</th>
                  <th className="py-3 px-4">Nama Barang & Spesifikasi</th>
                  <th className="py-3 px-4">Lokasi Tercatat (KIB B)</th>
                  <th className="py-3 px-4 text-right">Nilai Perolehan</th>
                  <th className="py-3 px-4">Status Keberadaan</th>
                  <th className="py-3 px-4">Kondisi Fisik</th>
                  <th className="py-3 px-4">Verifikasi</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 align-top">
                      <div className="font-mono font-semibold text-slate-900">{asset.asset_id}</div>
                      <div className="font-mono text-[11px] text-slate-500">{asset.register_number}</div>
                      <div className="font-mono text-[11px] text-slate-400">{asset.kib_code}</div>
                    </td>
                    <td className="py-3 px-4 align-top max-w-xs">
                      <div className="font-medium text-slate-900">{asset.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {asset.brand} {asset.model} · Th. {asset.acquisition_year}
                      </div>
                      <div className="text-[11px] text-slate-400">{asset.category}</div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="text-slate-800 font-medium">{asset.recorded_location_name}</div>
                      {asset.has_location_discrepancy && asset.latest_actual_location_name && (
                        <div className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          Aktual: {asset.latest_actual_location_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {formatRupiah(asset.acquisition_value)}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <ExistenceLabel status={asset.latest_existence_status} />
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="space-y-1">
                        <ConditionLabel
                          status={asset.latest_condition_status || asset.recorded_condition}
                        />
                        {asset.latest_condition_status &&
                          asset.latest_condition_status !== asset.recorded_condition && (
                            <div className="text-[10px] text-slate-400">
                              KIB: {asset.recorded_condition}
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <VerificationLabel status={asset.latest_verification_status} />
                    </td>
                    <td className="py-3 px-4 align-top text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openDetail(asset.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detail
                        </button>
                        {canCensus && (
                          <button
                            onClick={() => onStartCensusForAsset(asset)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-sky-600 text-white hover:bg-sky-700 font-medium whitespace-nowrap"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Sensus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Asset Detail Slide-over Drawer */}
      {(detailAsset || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setDetailAsset(null)}
          />
          <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl z-10 flex flex-col">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {detailAsset?.asset_id || 'Memuat...'} · {detailAsset?.register_number}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {detailAsset?.name || 'Detail Aset KIB B'}
                </h3>
              </div>
              <button
                onClick={() => setDetailAsset(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading || !detailAsset ? (
              <div className="p-8 text-sm text-slate-500">Memuat spesifikasi lengkap KIB B...</div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Action strip */}
                <div className="flex flex-wrap gap-2">
                  {canCensus && (
                    <button
                      onClick={() => {
                        const target = detailAsset;
                        setDetailAsset(null);
                        onStartCensusForAsset(target);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Input Sensus Fisik Baru
                    </button>
                  )}
                  {canMaintenance && (
                    <button
                      onClick={() => {
                        const target = detailAsset;
                        setDetailAsset(null);
                        onCreateMaintenanceForAsset(target);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50"
                    >
                      <Wrench className="h-4 w-4" />
                      Laporkan Kerusakan / Tiket
                    </button>
                  )}
                </div>

                {/* Official Immutable KIB B Block */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-sm font-semibold text-slate-900">
                      Data Induk Resmi KIB B (Read-Only)
                    </h4>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Lock className="h-3 w-3" />
                      Tidak berubah otomatis
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                    <div>
                      <div className="text-slate-500">Kode Barang (KIB B)</div>
                      <div className="font-mono font-medium text-slate-900">{detailAsset.kib_code}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Nomor Register</div>
                      <div className="font-mono font-medium text-slate-900">
                        {detailAsset.register_number}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Merk / Model</div>
                      <div className="font-medium text-slate-900">
                        {detailAsset.brand} {detailAsset.model}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Nomor Seri / Rangka</div>
                      <div className="font-mono text-slate-900">{detailAsset.serial_number}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Tahun & Nilai Perolehan</div>
                      <div className="font-mono font-semibold text-slate-900 tabular-nums">
                        {detailAsset.acquisition_year} · {formatRupiah(detailAsset.acquisition_value)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Lokasi & Kondisi Tercatat KIB B</div>
                      <div className="font-medium text-slate-900">
                        {detailAsset.recorded_location_name} ({detailAsset.recorded_condition})
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Token QR Unik</div>
                      <div className="font-mono text-slate-700">{detailAsset.qr_token}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Status Penatausahaan</div>
                      <div className="font-medium text-slate-900">{detailAsset.official_status}</div>
                    </div>
                  </div>
                </div>

                {/* Inspection History */}
                <div className="space-y-3">
                  <h4 className="font-display text-sm font-semibold text-slate-900">
                    Riwayat Pemeriksaan Fisik ({detailInspections.length})
                  </h4>
                  {detailInspections.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500">
                      Belum ada pemeriksaan fisik pada aset ini.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailInspections.map((insp) => (
                        <div
                          key={insp.id}
                          className="rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <ExistenceLabel status={insp.existence_status} />
                              <ConditionLabel status={insp.condition_status} />
                              <VerificationLabel status={insp.verification_status} />
                            </div>
                            <span className="font-mono text-[11px] text-slate-400">
                              {insp.inspected_at}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-600">
                            <div>
                              <span className="text-slate-400">Lokasi Aktual: </span>
                              <span className="font-medium text-slate-800">
                                {insp.actual_location_name}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">PIC / Pengguna: </span>
                              <span className="font-medium text-slate-800">{insp.pic_name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Pemeriksa: </span>
                              <span>{insp.inspector_name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Periode: </span>
                              <span>{insp.period_name}</span>
                            </div>
                          </div>
                          {insp.notes && (
                            <p className="text-slate-700 bg-slate-50 rounded p-2.5">{insp.notes}</p>
                          )}
                          {insp.koordinator_note && (
                            <p className="text-sky-900 bg-sky-50 rounded p-2.5">
                              Review Koordinator ({insp.koordinator_reviewed_by}): {insp.koordinator_note}
                            </p>
                          )}
                          {insp.rejection_reason && (
                            <p className="text-red-800 bg-red-50 rounded p-2.5">
                              Alasan Pengembalian: {insp.rejection_reason}
                            </p>
                          )}
                          {insp.photo_url && (
                            <div className="pt-1">
                              <img
                                src={insp.photo_url}
                                alt={`Foto bukti fisik ${detailAsset.name}`}
                                referrerPolicy="no-referrer"
                                className="h-36 w-auto rounded-lg border border-slate-200 object-cover"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tickets & Logs */}
                {detailTickets.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-display text-sm font-semibold text-slate-900">
                      Tiket Pemeliharaan Terkait
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {detailTickets.map((t) => (
                        <div key={t.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="font-mono font-semibold text-slate-900">{t.ticket_code}</div>
                            <div className="text-slate-600">{t.issue_description}</div>
                          </div>
                          <TicketStatusLabel status={t.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailLogs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-display text-sm font-semibold text-slate-900">
                      Audit Trail Aset
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {detailLogs.map((l) => (
                        <div key={l.id} className="p-3 text-xs space-y-0.5">
                          <div className="text-slate-800">{l.summary}</div>
                          <div className="text-[11px] text-slate-400">
                            {l.user_name} · {l.created_at}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
