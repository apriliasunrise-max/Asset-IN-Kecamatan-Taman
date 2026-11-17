import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Filter } from 'lucide-react';
import type { AssetRecord, CensusPeriod, LocationNode } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import {
  exportReportToExcel,
  exportReportToPdf,
  formatRupiah,
} from '../lib/exportUtils.ts';
import { ConditionLabel, ExistenceLabel } from './StatusPrimitives.tsx';

interface ReportsViewProps {
  locations: LocationNode[];
}

type ReportType = 'rekap' | 'discrepancy' | 'condition';

export function ReportsView({ locations }: ReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>('rekap');
  const [periodId, setPeriodId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('ALL');
  const [condition, setCondition] = useState<string>('ALL');
  const [periods, setPeriods] = useState<CensusPeriod[]>([]);
  const [rows, setRows] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodId) params.set('periodId', periodId);
      if (locationId !== 'ALL') params.set('locationId', locationId);
      if (condition !== 'ALL') params.set('condition', condition);
      const res = await apiRequest<{ rows: AssetRecord[]; periods: CensusPeriod[] }>(
        `/reports/summary?${params.toString()}`
      );
      setRows(res.rows);
      setPeriods(res.periods);
      if (!periodId && res.periods.length > 0) {
        const active = res.periods.find((p) => p.status === 'Aktif') || res.periods[0];
        setPeriodId(String(active.id));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [periodId, locationId, condition]);

  const filteredRows = rows.filter((r) => {
    if (reportType === 'discrepancy') return r.has_location_discrepancy;
    if (reportType === 'condition') {
      const c = r.latest_condition_status || r.recorded_condition;
      return c !== 'Baik';
    }
    return true;
  });

  const reportTitles: Record<ReportType, string> = {
    rekap: 'Rekapitulasi Hasil Sensus Fisik KIB B',
    discrepancy: 'Laporan Selisih Lokasi (Discrepancy) Aset KIB B',
    condition: 'Laporan Kondisi Aset Rusak & Tidak Layak Pakai',
  };

  const activePeriodObj = periods.find((p) => String(p.id) === periodId);
  const subtitle = activePeriodObj
    ? `${activePeriodObj.name} · Wilayah Filter: ${
        locationId === 'ALL'
          ? 'Semua Unit'
          : locations.find((l) => String(l.id) === locationId)?.name || 'Terpilih'
      }`
    : 'Kecamatan Taman';

  const unitLocations = locations.filter((l) => l.type === 'Kecamatan' || l.type === 'Kelurahan');

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Generator Laporan & Ekspor Resmi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Susun laporan rekapitulasi sensus, selisih lokasi, dan kondisi barang dalam format Excel (.xlsx) & PDF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() =>
              exportReportToExcel(
                filteredRows,
                reportTitles[reportType],
                `ASSET-IN_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`
              )
            }
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            Ekspor Excel (.xlsx)
          </button>

          <button
            onClick={() =>
              exportReportToPdf(
                filteredRows,
                reportTitles[reportType],
                subtitle,
                `ASSET-IN_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`
              )
            }
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Ekspor PDF (.pdf)
          </button>
        </div>
      </div>

      {/* Report Type Tabs & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'rekap', label: 'Rekapitulasi Sensus' },
                { id: 'discrepancy', label: 'Discrepancy Lokasi' },
                { id: 'condition', label: 'Kondisi Rusak / Tindak Lanjut' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setReportType(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  reportType === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">Semua Wilayah</option>
              {unitLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">Semua Kondisi</option>
              <option value="Baik">Baik</option>
              <option value="Rusak ringan">Rusak ringan</option>
              <option value="Rusak berat">Rusak berat</option>
              <option value="Tidak layak pakai">Tidak layak pakai</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="font-display text-sm font-bold text-white">
              {reportTitles[reportType]}
            </h3>
            <div className="text-xs text-slate-300">{subtitle}</div>
          </div>
          <div className="font-mono text-xs text-cyan-200 tabular-nums">
            {filteredRows.length} baris
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Menyusun pratinjau laporan...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Tidak ada data yang memenuhi kriteria laporan ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-100 border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Asset ID & Register</th>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4">Lokasi Tercatat</th>
                  <th className="py-3 px-4">Lokasi Aktual</th>
                  <th className="py-3 px-4">Keberadaan</th>
                  <th className="py-3 px-4">Kondisi</th>
                  <th className="py-3 px-4 text-right">Nilai KIB B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    className="odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/60 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono">
                      <div className="font-semibold text-slate-900">{r.asset_id}</div>
                      <div className="text-[11px] text-slate-500">{r.register_number}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.brand} {r.model}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{r.recorded_location_name}</td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {r.latest_actual_location_name || '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <ExistenceLabel status={r.latest_existence_status} />
                    </td>
                    <td className="py-2.5 px-4">
                      <ConditionLabel
                        status={r.latest_condition_status || r.recorded_condition}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatRupiah(r.acquisition_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
