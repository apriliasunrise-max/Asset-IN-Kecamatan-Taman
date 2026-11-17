import React from 'react';
import {
  ArrowRight,
  AlertTriangle,
  ScanLine,
  ShieldAlert,
  FileText,
  Info,
} from 'lucide-react';
import type { DashboardData, NavSectionId, UserAccount } from '../types.ts';
import { formatRupiah } from '../lib/exportUtils.ts';

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  currentUser: UserAccount;
  onNavigate: (nav: NavSectionId) => void;
  onInspectAssetId: (assetId: number) => void;
}

export function DashboardView({
  data,
  loading,
  currentUser,
  onNavigate,
  onInspectAssetId,
}: DashboardViewProps) {
  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
        <div className="h-80 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  const { kpi, locationProgress, conditionBreakdown, exceptionAlerts, activePeriod, recentLogs } =
    data;
  const pctInspected =
    kpi.totalAssets > 0 ? Math.round((kpi.inspectedAssets / kpi.totalAssets) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Context Strip & Primary Operational CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500">
            Sistem Pendamping Monitoring KIB B · Wilayah Kerja {currentUser.location_name}
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Ringkasan Sensus Fisik Barang Milik Daerah
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            {activePeriod
              ? `${activePeriod.name} (${activePeriod.start_date} s.d. ${activePeriod.end_date}) — Data KIB B induk bersifat read-only dan tidak berubah otomatis oleh hasil pemeriksaan lapangan.`
              : 'Belum ada periode sensus yang diaktifkan.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {currentUser.permissions.includes('scan:use') && (
            <button
              onClick={() => onNavigate('scan')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <ScanLine className="h-4 w-4" />
              Scan QR Lapangan
            </button>
          )}
          {currentUser.permissions.includes('verification:approve') && (
            <button
              onClick={() => onNavigate('verification')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Antrean Verifikasi ({kpi.pendingVerificationQueue})
            </button>
          )}
          {currentUser.role_code === 'PIMPINAN_VIEWER' && (
            <button
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FileText className="h-4 w-4" />
              Ekspor Rekapitulasi
            </button>
          )}
        </div>
      </div>

      {/* Strict Rule Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-950">
        <Info className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold">Prinsip Penatausahaan ASSET-IN:</span> Hasil sensus lapangan
          memisahkan status keberadaan fisik dari kondisi barang, tidak mengubah nilai aset KIB B secara otomatis,
          dan setiap temuan &ldquo;Tidak Ditemukan&rdquo; wajib melalui verifikasi manual Pengurus Barang Kecamatan.
        </div>
      </div>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="text-xs text-slate-500">Total Aset KIB B</div>
          <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {kpi.totalAssets}
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
            {formatRupiah(kpi.totalAcquisitionValue)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="text-xs text-slate-500">Sudah Diperiksa</div>
          <div className="font-mono text-2xl font-semibold text-sky-700 tabular-nums">
            {kpi.inspectedAssets}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {pctInspected}% cakupan · {kpi.uninspectedAssets} belum
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="text-xs text-slate-500">Fisik Ditemukan</div>
          <div className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {kpi.foundAssets}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            Sesuai & selisih lokasi: {kpi.locationDiscrepancyCount}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="text-xs text-slate-500">Tidak Ditemukan</div>
          <div className="font-mono text-2xl font-semibold text-red-700 tabular-nums">
            {kpi.missingAssets}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            Dalam verifikasi: {kpi.inVerificationAssets}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="text-xs text-slate-500">Aset Rusak</div>
          <div className="font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {kpi.damagedAssets}
          </div>
          <div className="text-[11px] text-slate-500">
            Ringan, berat, tidak layak
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="text-xs text-slate-500">Perlu Tindak Lanjut</div>
          <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {kpi.pendingVerificationQueue}
          </div>
          <div className="text-[11px] text-slate-500">
            Menunggu approval verifikasi
          </div>
        </div>
      </section>

      {/* Main Split: Location Progress + Exception Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Progress per Lokasi (Kecamatan + 8 Kelurahan) */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Progres Sensus per Wilayah Kerja
              </h3>
              <p className="text-xs text-slate-500">
                Kantor Kecamatan Taman dan 8 Kelurahan berdasarkan aset tercatat KIB B
              </p>
            </div>
            <button
              onClick={() => onNavigate('assets')}
              className="text-xs font-medium text-sky-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              Lihat Master KIB B
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Unit / Kelurahan</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Diperiksa</th>
                  <th className="py-2.5 px-3 text-right">Ditemukan</th>
                  <th className="py-2.5 px-3 text-right">Verifikasi</th>
                  <th className="py-2.5 pl-3 w-36">Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {locationProgress.map((loc) => (
                  <tr key={loc.location_id} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-4 font-medium text-slate-900">{loc.name}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {loc.total}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-700 font-medium">
                      {loc.inspected}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700">
                      {loc.found}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700">
                      {loc.in_verification}
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-600 rounded-full"
                            style={{ width: `${loc.progress_pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-slate-600 w-9 text-right">
                          {loc.progress_pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Exception Alerts & Condition Distribution */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Peringatan & Pengecualian Sensus
                </h3>
                <p className="text-xs text-slate-500">
                  Temuan selisih lokasi, kondisi berat, dan aset belum ditemukan
                </p>
              </div>
              <button
                onClick={() => onNavigate('monitoring')}
                className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
              >
                Detail
              </button>
            </div>

            {exceptionAlerts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Tidak ada anomali atau pengecualian sensus pada wilayah ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {exceptionAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <AlertTriangle
                          className={`h-3.5 w-3.5 shrink-0 ${
                            alert.severity === 'critical'
                              ? 'text-red-600'
                              : alert.severity === 'warning'
                              ? 'text-amber-600'
                              : 'text-sky-600'
                          }`}
                        />
                        <span className="font-semibold text-slate-900 truncate">
                          {alert.asset_code} · {alert.asset_name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                      <div className="text-[11px] text-slate-400">
                        {alert.category} · {alert.location_name}
                      </div>
                    </div>
                    <button
                      onClick={() => onInspectAssetId(alert.asset_id)}
                      className="text-xs font-medium text-sky-700 hover:text-sky-900 shrink-0 px-2 py-1 rounded hover:bg-sky-50"
                    >
                      Tinjau
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Distribusi Kondisi Fisik Aset
            </h3>
            <div className="space-y-3">
              {conditionBreakdown.map((item) => {
                const pct =
                  kpi.totalAssets > 0 ? Math.round((item.count / kpi.totalAssets) * 100) : 0;
                const barColor =
                  item.condition === 'Baik'
                    ? 'bg-emerald-600'
                    : item.condition === 'Rusak ringan'
                    ? 'bg-amber-500'
                    : item.condition === 'Rusak berat'
                    ? 'bg-red-600'
                    : 'bg-slate-600';
                return (
                  <div key={item.condition} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.condition}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {item.count} unit ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Recent Audit Activity */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Log Aktivitas Terbaru
            </h3>
            <p className="text-xs text-slate-500">
              Jejak audit import KIB B, pemeriksaan fisik, dan verifikasi
            </p>
          </div>
          <button
            onClick={() => onNavigate('monitoring')}
            className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
          >
            Semua Riwayat
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {recentLogs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="text-slate-800 font-medium">{log.summary}</div>
                <div className="text-slate-500">
                  {log.user_name} · {log.role_name} · {log.action}
                </div>
              </div>
              <div className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                {log.created_at}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
