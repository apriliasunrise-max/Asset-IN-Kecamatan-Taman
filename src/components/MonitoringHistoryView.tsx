import React, { useEffect, useState } from 'react';
import { MapPin, ArrowRight, Activity } from 'lucide-react';
import type { AssetInspection, AuditLog } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { ConditionLabel, VerificationLabel } from './StatusPrimitives.tsx';

export function MonitoringHistoryView() {
  const [tab, setTab] = useState<'discrepancy' | 'condition' | 'audit'>('discrepancy');
  const [locationDiscrepancies, setLocationDiscrepancies] = useState<AssetInspection[]>([]);
  const [conditionChanges, setConditionChanges] = useState<AssetInspection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void apiRequest<{
      locationDiscrepancies: AssetInspection[];
      conditionChanges: AssetInspection[];
      auditLogs: AuditLog[];
    }>('/monitoring')
      .then((res) => {
        setLocationDiscrepancies(res.locationDiscrepancies);
        setConditionChanges(res.conditionChanges);
        setAuditLogs(res.auditLogs);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Monitoring Perubahan & Riwayat Audit
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Lacak selisih lokasi aktual vs tercatat KIB B, degradasi kondisi fisik, dan jejak aktivitas pengguna
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            onClick={() => setTab('discrepancy')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'discrepancy' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Selisih Lokasi ({locationDiscrepancies.length})
          </button>
          <button
            onClick={() => setTab('condition')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'condition' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Perubahan Kondisi ({conditionChanges.length})
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Log Aktivitas ({auditLogs.length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] px-5 py-3.5 text-white flex items-center justify-between">
          <div className="text-sm font-display font-semibold">
            {tab === 'discrepancy'
              ? 'Daftar Selisih Lokasi Aktual vs Tercatat KIB B'
              : tab === 'condition'
              ? 'Daftar Perubahan Kondisi Fisik Aset'
              : 'Rekam Jejak Audit Aktivitas Sistem'}
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat riwayat monitoring...</div>
        ) : tab === 'discrepancy' ? (
          locationDiscrepancies.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Tidak ditemukan selisih antara lokasi tercatat KIB B dan lokasi aktual di lapangan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-100 border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Aset KIB B</th>
                    <th className="py-3 px-4">Lokasi Tercatat (KIB B)</th>
                    <th className="py-3 px-4">Lokasi Aktual Lapangan</th>
                    <th className="py-3 px-4">PIC & Pemeriksa</th>
                    <th className="py-3 px-4">Verifikasi</th>
                    <th className="py-3 px-4 text-right">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {locationDiscrepancies.map((d) => (
                    <tr
                      key={d.id}
                      className="odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">{d.asset_code}</div>
                        <div className="font-medium text-slate-800">{d.asset_name}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{d.recorded_location_name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                          <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          {d.actual_location_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-900">{d.pic_name}</div>
                        <div className="text-[11px] text-slate-400">Oleh: {d.inspector_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <VerificationLabel status={d.verification_status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                        {d.inspected_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'condition' ? (
          conditionChanges.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Belum ada perubahan kondisi fisik dibandingkan data KIB B awal.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-100 border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Aset KIB B</th>
                    <th className="py-3 px-4">Kondisi KIB B Awal</th>
                    <th className="py-3 px-4">Kondisi Aktual Sensus</th>
                    <th className="py-3 px-4">Catatan Lapangan</th>
                    <th className="py-3 px-4">Verifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {conditionChanges.map((c) => (
                    <tr
                      key={c.id}
                      className="odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">{c.asset_code}</div>
                        <div className="font-medium text-slate-800">{c.asset_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <ConditionLabel status={c.recorded_condition} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-2">
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          <ConditionLabel status={c.condition_status} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-sm">{c.notes || '—'}</td>
                      <td className="py-3 px-4">
                        <VerificationLabel status={c.verification_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="divide-y divide-slate-100">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-start gap-3">
                  <Activity className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-900">{log.summary}</div>
                    <div className="text-[11px] text-slate-500">
                      {log.user_name} ({log.role_name}) ·{' '}
                      <span className="font-mono">{log.action}</span> · {log.entity_type} #
                      {log.entity_id}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                  {log.created_at}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
