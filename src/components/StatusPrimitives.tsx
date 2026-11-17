import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import type {
  ConditionStatus,
  ExistenceStatus,
  MaintenancePriority,
  MaintenanceStatus,
  VerificationStatus,
} from '../types.ts';

export function ExistenceLabel({ status }: { status: ExistenceStatus | string }) {
  switch (status) {
    case 'Ditemukan':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
          Ditemukan
        </span>
      );
    case 'Dalam verifikasi':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          Dalam verifikasi
        </span>
      );
    case 'Tidak ditemukan':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-red-700 shrink-0" />
          Tidak ditemukan
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          Belum diperiksa
        </span>
      );
  }
}

export function ConditionLabel({ status }: { status: ConditionStatus | string | null }) {
  if (!status) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  switch (status) {
    case 'Baik':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 whitespace-nowrap">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
          Baik
        </span>
      );
    case 'Rusak ringan':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          Rusak ringan
        </span>
      );
    case 'Rusak berat':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-red-700 shrink-0" />
          Rusak berat
        </span>
      );
    case 'Tidak layak pakai':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400 bg-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-900 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 text-red-800 shrink-0" />
          Tidak layak pakai
        </span>
      );
    default:
      return <span className="text-xs text-slate-600">{status}</span>;
  }
}

export function VerificationLabel({ status }: { status: VerificationStatus | string | null }) {
  if (!status) {
    return <span className="text-xs text-slate-400">Belum ada</span>;
  }
  switch (status) {
    case 'Disetujui':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
          Disetujui
        </span>
      );
    case 'Dikembalikan':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 whitespace-nowrap">
          <RotateCcw className="h-3.5 w-3.5 text-red-700 shrink-0" />
          Dikembalikan
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          Menunggu Verifikasi
        </span>
      );
  }
}

export function TicketStatusLabel({ status }: { status: MaintenanceStatus }) {
  const styles: Record<MaintenanceStatus, string> = {
    Terbuka: 'border-red-300 bg-red-100 text-red-800',
    'Dalam Proses': 'border-amber-300 bg-amber-100 text-amber-800',
    Selesai: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    Ditutup: 'border-slate-300 bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${styles[status]}`}>
      {status}
    </span>
  );
}

export function PriorityText({ priority }: { priority: MaintenancePriority }) {
  const colors: Record<MaintenancePriority, string> = {
    Mendesak: 'text-red-700 font-semibold',
    Tinggi: 'text-amber-700 font-semibold',
    Sedang: 'text-sky-700 font-medium',
    Rendah: 'text-slate-600 font-medium',
  };
  return <span className={`text-xs whitespace-nowrap ${colors[priority]}`}>{priority}</span>;
}
