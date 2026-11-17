import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, RefreshCw, Download, CheckSquare, Square } from 'lucide-react';
import type { AssetRecord, LocationNode } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { exportQrLabelsToPdf } from '../lib/exportUtils.ts';

interface QrCodeViewProps {
  locations: LocationNode[];
}

export function QrCodeView({ locations }: QrCodeViewProps) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationFilter !== 'ALL') params.set('locationId', locationFilter);
      const res = await apiRequest<{ assets: AssetRecord[] }>(`/assets?${params.toString()}`);
      setAssets(res.assets);

      const generated: Record<number, string> = {};
      await Promise.all(
        res.assets.map(async (a) => {
          generated[a.id] = await QRCode.toDataURL(a.qr_token, {
            width: 180,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        })
      );
      setQrMap(generated);
      setSelectedIds(res.assets.slice(0, 6).map((a) => a.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, [locationFilter]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === assets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(assets.map((a) => a.id));
    }
  };

  const handleRegenerateTokens = async () => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      await apiRequest('/assets/qr-batch', {
        method: 'POST',
        body: JSON.stringify({ assetIds: selectedIds }),
      });
      await loadAssets();
    } finally {
      setBusy(false);
    }
  };

  const handleExportPdf = async () => {
    const chosen = assets.filter((a) => selectedIds.includes(a.id));
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      await exportQrLabelsToPdf(chosen);
    } finally {
      setBusy(false);
    }
  };

  const unitLocations = locations.filter((l) => l.type === 'Kecamatan' || l.type === 'Kelurahan');
  const selectedAssets = assets.filter((a) => selectedIds.includes(a.id));

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Generator & Cetak Label QR Code Aset
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate token QR unik per Asset ID, pratinjau stiker aset, dan cetak PDF label individu maupun massal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="ALL">Semua Lokasi</option>
            {unitLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleRegenerateTokens}
            disabled={busy || selectedIds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Perbarui Token ({selectedIds.length})
          </button>

          <button
            onClick={() => window.print()}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak Browser
          </button>

          <button
            onClick={handleExportPdf}
            disabled={busy || selectedIds.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh PDF Label ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Selection Table + Live Preview Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Asset Checklist */}
        <section className="no-print xl:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <button
              onClick={selectAll}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800"
            >
              {selectedIds.length === assets.length && assets.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-sky-600" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              Pilih Semua ({assets.length})
            </button>
            <span className="text-xs font-mono text-slate-500">
              {selectedIds.length} dipilih
            </span>
          </div>

          {loading ? (
            <div className="p-6 text-xs text-slate-500">Memuat daftar aset...</div>
          ) : (
            <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100">
              {assets.map((asset) => {
                const checked = selectedIds.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    onClick={() => toggleSelect(asset.id)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                      checked ? 'bg-sky-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-900">
                          {asset.asset_id}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 truncate">
                          {asset.qr_token}
                        </span>
                      </div>
                      <div className="font-medium text-slate-800 truncate">{asset.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {asset.recorded_location_name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Printable Label Preview Grid */}
        <section className="xl:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="no-print flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Pratinjau Stiker Label QR Code
              </h3>
              <p className="text-xs text-slate-500">
                Ukuran standar label inventaris 88mm × 46mm siap tempel pada perangkat KIB B
              </p>
            </div>
          </div>

          {selectedAssets.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              Centang minimal satu aset di sebelah kiri untuk melihat pratinjau label QR Code.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="border border-slate-300 rounded-lg overflow-hidden bg-white break-inside-avoid"
                >
                  <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-[10px] font-medium">
                    <span>ASSET-IN · BMD KECAMATAN TAMAN</span>
                    <span className="font-mono">{asset.acquisition_year}</span>
                  </div>
                  <div className="p-3 flex items-center gap-3">
                    {qrMap[asset.id] && (
                      <img
                        src={qrMap[asset.id]}
                        alt={`QR Code ${asset.asset_id}`}
                        className="h-24 w-24 shrink-0 border border-slate-100 rounded"
                      />
                    )}
                    <div className="min-w-0 space-y-1 text-xs">
                      <div className="font-mono font-bold text-slate-900 text-sm">
                        {asset.asset_id}
                      </div>
                      <div className="font-semibold text-slate-800 line-clamp-2 leading-snug">
                        {asset.name}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        Reg: {asset.register_number}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {asset.recorded_location_name}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 truncate">
                        {asset.qr_token}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
