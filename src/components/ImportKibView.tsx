import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import type { ImportBatch } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { downloadKibTemplateExcel, formatRupiah } from '../lib/exportUtils.ts';

interface ValidatedPreviewRow {
  rowIndex: number;
  asset_id: string;
  kib_code: string;
  register_number: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  acquisition_year: number;
  acquisition_value: number;
  recorded_condition: string;
  recorded_location_id: number;
  recorded_location_name: string;
  isDuplicate: boolean;
  isValid: boolean;
  errors: string[];
}

interface ImportKibViewProps {
  onImportCompleted: () => void;
}

const TARGET_FIELDS = [
  { key: 'asset_id', label: 'Asset ID (Opsional, auto-generate)', required: false },
  { key: 'kib_code', label: 'Kode Barang (KIB B)', required: true },
  { key: 'register_number', label: 'Nomor Register', required: true },
  { key: 'name', label: 'Nama Barang', required: true },
  { key: 'category', label: 'Kategori', required: false },
  { key: 'brand', label: 'Merk', required: false },
  { key: 'model', label: 'Model / Tipe', required: false },
  { key: 'serial_number', label: 'Nomor Seri', required: false },
  { key: 'acquisition_year', label: 'Tahun Perolehan', required: false },
  { key: 'acquisition_value', label: 'Harga / Nilai Perolehan', required: false },
  { key: 'recorded_condition', label: 'Kondisi Tercatat', required: false },
  { key: 'location_name', label: 'Lokasi Tercatat', required: false },
] as const;

export function ImportKibView({ onImportCompleted }: ImportKibViewProps) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [filename, setFilename] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<{
    summary: { total: number; valid: number; duplicates: number; errors: number };
    rows: ValidatedPreviewRow[];
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBatches = async () => {
    const res = await apiRequest<{ batches: ImportBatch[] }>('/import/batches');
    setBatches(res.batches);
  };

  useEffect(() => {
    void loadBatches();
  }, []);

  const autoMapColumns = (headers: string[]) => {
    const next: Record<string, string> = {};
    const findHeader = (keywords: string[]) =>
      headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k))) || '';

    next.asset_id = findHeader(['asset id', 'asset_id', 'id aset']);
    next.kib_code = findHeader(['kode barang', 'kib', 'kode']);
    next.register_number = findHeader(['register', 'no. reg', 'reg']);
    next.name = findHeader(['nama barang', 'uraian', 'nama aset', 'name']);
    next.category = findHeader(['kategori', 'kelompok', 'category']);
    next.brand = findHeader(['merk', 'merek', 'brand']);
    next.model = findHeader(['model', 'tipe', 'spesifikasi']);
    next.serial_number = findHeader(['seri', 'serial', 'rangka']);
    next.acquisition_year = findHeader(['tahun', 'year']);
    next.acquisition_value = findHeader(['harga', 'nilai', 'value']);
    next.recorded_condition = findHeader(['kondisi', 'condition']);
    next.location_name = findHeader(['lokasi', 'unit', 'kelurahan', 'ruang']);
    return next;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setPreviewData(null);
    setFilename(file.name);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (parsed.length === 0) {
      setFeedback({ type: 'error', text: 'File Excel/CSV kosong atau tidak memiliki baris data.' });
      return;
    }

    const headers = Object.keys(parsed[0]);
    setRawHeaders(headers);
    setRawRows(parsed);
    setMapping(autoMapColumns(headers));
  };

  const runValidationPreview = async () => {
    setFeedback(null);
    const mappedRows = rawRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const f of TARGET_FIELDS) {
        const colName = mapping[f.key];
        out[f.key] = colName ? row[colName] : '';
      }
      return out;
    });

    try {
      const res = await apiRequest<{
        summary: { total: number; valid: number; duplicates: number; errors: number };
        rows: ValidatedPreviewRow[];
      }>('/import/preview', {
        method: 'POST',
        body: JSON.stringify({ rows: mappedRows }),
      });
      setPreviewData(res);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memvalidasi file.',
      });
    }
  };

  const handleCommitBatch = async () => {
    if (!previewData) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{
        batchId: number;
        inserted: number;
        duplicates: number;
        errors: number;
      }>('/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          filename,
          columnMapping: mapping,
          rows: previewData.rows,
          notes,
        }),
      });
      setFeedback({
        type: 'success',
        text: `Batch #${res.batchId} berhasil disimpan: ${res.inserted} aset baru ditambahkan, ${res.duplicates} duplikat dilewati, ${res.errors} error.`,
      });
      setRawRows([]);
      setRawHeaders([]);
      setPreviewData(null);
      setFilename('');
      setNotes('');
      await loadBatches();
      onImportCompleted();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan batch import.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Import Data Induk KIB B (.xlsx / .csv)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Unggah ekspor KIB B dari penatausahaan resmi, petakan kolom, dan validasi duplikasi sebelum disimpan
          </p>
        </div>
        <button
          onClick={downloadKibTemplateExcel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          Unduh Template Excel KIB B
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-start gap-2.5 ${
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

      {/* Step 1: Upload File */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-slate-900">
            01. Unggah File KIB B
          </h3>
          {filename && (
            <span className="font-mono text-xs text-sky-700">{filename} ({rawRows.length} baris)</span>
          )}
        </div>

        <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 hover:border-sky-500 bg-slate-50/50 p-8 cursor-pointer transition-colors">
          <Upload className="h-8 w-8 text-slate-400 mb-2" />
          <div className="text-sm font-medium text-slate-800">
            Pilih file Excel (.xlsx / .xls) atau CSV (.csv)
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Sistem akan membaca header kolom secara otomatis untuk proses mapping
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Step 2: Column Mapping */}
        {rawHeaders.length > 0 && (
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-sm font-semibold text-slate-900">
                  02. Pemetaan Kolom (Column Mapping)
                </h4>
                <p className="text-xs text-slate-500">
                  Cocokkan kolom file Excel dengan field skema Master KIB B
                </p>
              </div>
              <button
                onClick={runValidationPreview}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
              >
                Validasi & Pratinjau
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {TARGET_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 block">
                    {field.label}{' '}
                    {field.required && <span className="text-red-600">*</span>}
                  </label>
                  <select
                    value={mapping[field.key] || ''}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Abaikan / Kosong --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Validation Preview */}
        {previewData && (
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-sm font-semibold text-slate-900">
                  03. Pratinjau Validasi Batch
                </h4>
                <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-3 font-mono tabular-nums">
                  <span>Total: {previewData.summary.total}</span>
                  <span className="text-emerald-700">Valid: {previewData.summary.valid}</span>
                  <span className="text-amber-700">Duplikat: {previewData.summary.duplicates}</span>
                  <span className="text-red-700">Error: {previewData.summary.errors}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan batch (opsional)"
                  className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
                <button
                  onClick={handleCommitBatch}
                  disabled={submitting || previewData.summary.valid === 0}
                  className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {submitting
                    ? 'Menyimpan...'
                    : `Simpan ${previewData.summary.valid} Aset Valid`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-3">Baris</th>
                    <th className="py-2.5 px-3">Asset ID / Register</th>
                    <th className="py-2.5 px-3">Nama Barang</th>
                    <th className="py-2.5 px-3">Lokasi Matched</th>
                    <th className="py-2.5 px-3 text-right">Nilai</th>
                    <th className="py-2.5 px-3">Status Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.rows.map((r) => (
                    <tr key={r.rowIndex} className={!r.isValid ? 'bg-red-50/40' : ''}>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{r.rowIndex}</td>
                      <td className="py-2.5 px-3 font-mono">
                        <div className="font-semibold text-slate-900">{r.asset_id}</div>
                        <div className="text-[11px] text-slate-500">{r.register_number}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{r.name || '—'}</div>
                        <div className="text-[11px] text-slate-500">{r.kib_code}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{r.recorded_location_name}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatRupiah(r.acquisition_value)}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.isValid ? (
                          <span className="text-emerald-700 font-medium">Siap Import</span>
                        ) : (
                          <span className="text-red-700">{r.errors.join('; ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Import Batch Log */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] px-6 py-4 flex items-center gap-2 text-white">
          <FileSpreadsheet className="h-4 w-4 text-cyan-300" />
          <h3 className="font-display text-base font-semibold text-white">
            Riwayat Batch Import KIB B
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-100 border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Nama File</th>
                <th className="py-3 px-3">Pengunggah</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-right">Masuk</th>
                <th className="py-3 px-3 text-right">Duplikat</th>
                <th className="py-3 px-3 text-right">Error</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {batches.map((b) => (
                <tr
                  key={b.id}
                  className="odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/60 transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{b.filename}</td>
                  <td className="py-3 px-3 text-slate-700">{b.imported_by_name}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">{b.total_rows}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    {b.inserted_rows}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                    {b.duplicate_rows}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-red-700 font-semibold">
                    {b.error_rows}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800">{b.status}</td>
                  <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                    {b.created_at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
