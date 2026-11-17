import React from 'react';
import {
  ArrowRight,
  AlertTriangle,
  Camera,
  ShieldAlert,
  FileText,
  Info,
  Package,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white/80 rounded-xl border border-slate-200 shadow-sm" />
          ))}
        </div>
        <div className="h-80 bg-white/80 rounded-xl border border-slate-200 shadow-sm" />
      </div>
    );
  }

  const { kpi, locationProgress, conditionBreakdown, exceptionAlerts, activePeriod, recentLogs } =
    data;
  const pctInspected =
    kpi.totalAssets > 0 ? Math.round((kpi.inspectedAssets / kpi.totalAssets) * 100) : 0;

  return (
    <div className="space-y-7">
      {/* Context Strip & Primary Operational CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-sky-700">
            Sistem Pendamping Monitoring KIB B · Wilayah Kerja {currentUser.location_name}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Asset-IN Digital Sensus BMD
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
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] text-white text-sm font-semibold shadow-md shadow-blue-500/30 hover:from-blue-600 hover:to-indigo-600 hover:shadow-lg hover:shadow-indigo-500/45 transition-all whitespace-nowrap cursor-pointer"
            >
              <Camera className="h-4 w-4 text-white drop-shadow-sm" />
              Scan QR Lapangan
            </button>
          )}
          {currentUser.permissions.includes('verification:approve') && (
            <button
              onClick={() => onNavigate('verification')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-950 text-sm font-semibold hover:bg-amber-100/80 shadow-sm transition-all whitespace-nowrap cursor-pointer"
            >
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Antrean Verifikasi
              <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-mono font-bold tabular-nums animate-pulse">
                {kpi.pendingVerificationQueue}
              </span>
            </button>
          )}
          {currentUser.role_code === 'PIMPINAN_VIEWER' && (
            <button
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white text-sm font-semibold shadow-md hover:opacity-95 transition-all whitespace-nowrap cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              Ekspor Rekapitulasi
            </button>
          )}
        </div>
      </div>

      {/* Strict Rule Banner */}
      <div className="flex items-start gap-3.5 rounded-xl border border-sky-200 border-l-4 border-l-[#0284C7] bg-[#E0F2FE] p-4 shadow-sm text-xs text-sky-950">
        <Info className="h-5 w-5 text-[#0284C7] shrink-0 mt-0.5 drop-shadow-sm" />
        <div className="leading-relaxed">
          <span className="font-bold text-sky-900">Prinsip Penatausahaan ASSET-IN:</span> Hasil sensus lapangan
          memisahkan status keberadaan fisik dari kondisi barang, tidak mengubah nilai aset KIB B secara otomatis,
          dan setiap temuan &ldquo;Tidak Ditemukan&rdquo; wajib melalui verifikasi manual Pengurus Barang Kecamatan.
        </div>
      </div>

      {/* Primary Executive KPI Grid (Color-Coded Gradients) */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Aset KIB B (Royal Blue Gradient) */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] border-l-4 border-l-sky-300 p-5 text-white shadow-md shadow-blue-900/15 flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                Total Aset KIB B
              </div>
              <div className="font-mono text-3xl font-bold text-white tabular-nums">
                {kpi.totalAssets}
              </div>
              <div className="text-[11px] text-blue-100 font-mono tabular-nums truncate">
                {formatRupiah(kpi.totalAcquisitionValue)}
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Package className="h-7 w-7 text-white" />
            </div>
          </div>

          {/* Card 2: Sudah Diperiksa (Emerald Green Gradient) */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#10B981] to-[#047857] border-l-4 border-l-emerald-200 p-5 text-white shadow-md shadow-emerald-900/15 flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
                Sudah Diperiksa
              </div>
              <div className="font-mono text-3xl font-bold text-white tabular-nums">
                {kpi.inspectedAssets}
              </div>
              <div className="text-[11px] text-emerald-100 tabular-nums">
                {pctInspected}% cakupan · {kpi.uninspectedAssets} belum
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
          </div>

          {/* Card 3: Fisik Ditemukan (Teal / Cyan Gradient) */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#0E7490] border-l-4 border-l-cyan-200 p-5 text-white shadow-md shadow-cyan-900/15 flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-cyan-100">
                Fisik Ditemukan
              </div>
              <div className="font-mono text-3xl font-bold text-white tabular-nums">
                {kpi.foundAssets}
              </div>
              <div className="text-[11px] text-cyan-100 tabular-nums">
                Selisih lokasi: {kpi.locationDiscrepancyCount} unit
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
          </div>

          {/* Card 4: Antrean Verifikasi (Pale Amber/Orange + Thick Orange Border + Pulsing Red Count Badge) */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 border-l-4 border-l-[#F59E0B] p-5 shadow-md shadow-amber-900/5 flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Antrean Verifikasi
                </span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-2 rounded-full bg-red-600 text-white text-[11px] font-mono font-bold tabular-nums shadow-sm animate-pulse">
                  {kpi.pendingVerificationQueue}
                </span>
              </div>
              <div className="font-mono text-3xl font-bold text-amber-950 tabular-nums">
                {kpi.pendingVerificationQueue}
              </div>
              <div className="text-[11px] font-medium text-amber-800">
                Menunggu approval verifikasi
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-7 w-7 text-[#D97706]" />
            </div>
          </div>
        </div>

        {/* Secondary Exception KPI Strip (Preserves Tidak Ditemukan & Aset Rusak metrics) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-red-500 px-5 py-3.5 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700">Tidak Ditemukan</div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  Dalam verifikasi: {kpi.inVerificationAssets} unit (wajib tinjauan manual)
                </div>
              </div>
            </div>
            <div className="font-mono text-2xl font-bold text-red-700 tabular-nums">
              {kpi.missingAssets}
            </div>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 border-l-4 border-l-orange-500 px-5 py-3.5 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700">Aset Rusak</div>
                <div className="text-[11px] text-slate-500">
                  Akumulasi rusak ringan, rusak berat, & tidak layak pakai
                </div>
              </div>
            </div>
            <div className="font-mono text-2xl font-bold text-orange-700 tabular-nums">
              {kpi.damagedAssets}
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Location Progress + Exception Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Progress per Lokasi (Kecamatan + 8 Kelurahan) */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] px-6 py-4 flex items-center justify-between gap-4 text-white">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Progres Sensus per Wilayah Kerja
              </h3>
              <p className="text-xs text-slate-300">
                Kantor Kecamatan Taman dan 8 Kelurahan berdasarkan aset tercatat KIB B
              </p>
            </div>
            <button
              onClick={() => onNavigate('assets')}
              className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              Lihat Master KIB B
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-100 border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Unit / Kelurahan</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Diperiksa</th>
                  <th className="py-3 px-3 text-right">Ditemukan</th>
                  <th className="py-3 px-3 text-right">Verifikasi</th>
                  <th className="py-3 px-5 w-40">Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {locationProgress.map((loc) => (
                  <tr
                    key={loc.location_id}
                    className="odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/60 transition-colors"
                  >
                    <td className="py-3 px-5 font-semibold text-slate-900">{loc.name}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {loc.total}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-700 font-semibold">
                      {loc.inspected}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {loc.found}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                      {loc.in_verification}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
                            style={{ width: `${loc.progress_pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-700 w-9 text-right">
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
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-6 py-4 flex items-center justify-between gap-2 text-white">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Peringatan & Pengecualian Sensus
                </h3>
                <p className="text-xs text-slate-300">
                  Temuan selisih lokasi, kondisi berat, dan aset belum ditemukan
                </p>
              </div>
              <button
                onClick={() => onNavigate('monitoring')}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 whitespace-nowrap cursor-pointer"
              >
                Detail
              </button>
            </div>

            <div className="p-5">
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
                        className="text-xs font-semibold text-sky-700 hover:text-sky-900 shrink-0 px-2.5 py-1 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer"
                      >
                        Tinjau
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] px-6 py-3.5 text-white">
              <h3 className="font-display text-base font-semibold text-white">
                Distribusi Kondisi Fisik Aset
              </h3>
            </div>
            <div className="p-5 space-y-3.5">
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
                  <div key={item.condition} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{item.condition}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {item.count} unit ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
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
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-[#0F172A] px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Log Aktivitas Terbaru
            </h3>
            <p className="text-xs text-slate-300">
              Jejak audit import KIB B, pemeriksaan fisik, dan verifikasi
            </p>
          </div>
          <button
            onClick={() => onNavigate('monitoring')}
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 whitespace-nowrap cursor-pointer"
          >
            Semua Riwayat
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {recentLogs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="px-6 py-3 odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="text-slate-900 font-semibold">{log.summary}</div>
                <div className="text-slate-500">
                  {log.user_name} · {log.role_name} · <span className="font-mono">{log.action}</span>
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
