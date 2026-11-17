import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import type { AssetRecord } from '../types.ts';

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function downloadKibTemplateExcel(): void {
  const sampleRows = [
    {
      'Asset ID': 'AST-TMN-0101',
      'Kode Barang': '1.3.2.10.01.02.002',
      'No. Register': 'REG-2026-0201',
      'Nama Barang': 'Laptop Operasional Seksi Pemerintahan',
      Kategori: 'Komputer & TI',
      Merk: 'Lenovo',
      Model: 'ThinkPad L14 Gen 4',
      'Nomor Seri': 'LNV-L14-90211',
      'Tahun Perolehan': 2026,
      'Harga Perolehan': 15400000,
      'Kondisi Tercatat': 'Baik',
      'Lokasi Tercatat': 'Ruang Pelayanan Terpadu (PATEN)',
    },
    {
      'Asset ID': 'AST-KLT-0102',
      'Kode Barang': '1.3.2.10.02.03.003',
      'No. Register': 'REG-2026-0202',
      'Nama Barang': 'Printer Dokumen Kelurahan',
      Kategori: 'Peralatan Kantor',
      Merk: 'Epson',
      Model: 'EcoTank L3250',
      'Nomor Seri': 'EPS-3250-7781',
      'Tahun Perolehan': 2026,
      'Harga Perolehan': 3850000,
      'Kondisi Tercatat': 'Baik',
      'Lokasi Tercatat': 'Ruang Pelayanan Kelurahan Taman',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template_KIB_B');
  XLSX.writeFile(wb, 'Template_Import_KIB_B_Kecamatan_Taman.xlsx');
}

export function exportReportToExcel(
  rows: AssetRecord[],
  reportTitle: string,
  filename: string
): void {
  const formatted = rows.map((a, i) => ({
    No: i + 1,
    'Asset ID': a.asset_id,
    'Kode Barang KIB B': a.kib_code,
    'No. Register': a.register_number,
    'Nama Barang': a.name,
    'Merk / Model': `${a.brand} ${a.model}`,
    'Tahun Perolehan': a.acquisition_year,
    'Nilai Perolehan (Rp)': a.acquisition_value,
    'Lokasi Tercatat (KIB B)': a.recorded_location_name,
    'Kondisi Tercatat (KIB B)': a.recorded_condition,
    'Status Keberadaan (Sensus)': a.latest_existence_status,
    'Kondisi Fisik Aktual': a.latest_condition_status || '-',
    'Lokasi Aktual (Sensus)': a.latest_actual_location_name || '-',
    'Selisih Lokasi': a.has_location_discrepancy ? 'Ya' : 'Tidak',
    'Status Verifikasi': a.latest_verification_status || 'Belum Sensus',
    'Penanggung Jawab': a.latest_pic_name || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(formatted);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reportTitle.slice(0, 30));
  XLSX.writeFile(wb, filename);
}

export function exportReportToPdf(
  rows: AssetRecord[],
  reportTitle: string,
  subtitle: string,
  filename: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(13);
  doc.text('PEMERINTAH KOTA — KECAMATAN TAMAN', 14, 14);
  doc.setFontSize(11);
  doc.text(`ASSET-IN · ${reportTitle}`, 14, 20);
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`${subtitle} · Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 25);
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 30,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    head: [
      [
        'No',
        'Asset ID',
        'No. Register',
        'Nama Barang',
        'Lokasi Tercatat',
        'Keberadaan',
        'Kondisi Aktual',
        'Lokasi Aktual',
        'Verifikasi',
        'Nilai KIB B',
      ],
    ],
    body: rows.map((a, idx) => [
      idx + 1,
      a.asset_id,
      a.register_number,
      `${a.name} (${a.brand})`,
      a.recorded_location_name,
      a.latest_existence_status,
      a.latest_condition_status || a.recorded_condition,
      a.latest_actual_location_name || '-',
      a.latest_verification_status || 'Belum Sensus',
      formatRupiah(a.acquisition_value),
    ]),
  });

  doc.save(filename);
}

export async function exportQrLabelsToPdf(assets: AssetRecord[]): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cols = 2;
  const rowsPerPage = 5;
  const cardW = 88;
  const cardH = 46;
  const marginX = 14;
  const marginY = 16;
  const gapX = 6;
  const gapY = 6;

  for (let i = 0; i < assets.length; i++) {
    if (i > 0 && i % (cols * rowsPerPage) === 0) {
      doc.addPage();
    }
    const idxOnPage = i % (cols * rowsPerPage);
    const col = idxOnPage % cols;
    const row = Math.floor(idxOnPage / cols);
    const x = marginX + col * (cardW + gapX);
    const y = marginY + row * (cardH + gapY);

    const a = assets[i];
    const qrDataUrl = await QRCode.toDataURL(a.qr_token, { width: 220, margin: 1 });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.rect(x, y, cardW, cardH);

    // Header strip
    doc.setFillColor(15, 23, 42);
    doc.rect(x, y, cardW, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('ASSET-IN · BMD KECAMATAN TAMAN', x + 3, y + 5);

    doc.addImage(qrDataUrl, 'PNG', x + 3, y + 10, 28, 28);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.text(a.asset_id, x + 34, y + 14.5);

    doc.setFontSize(7.5);
    const nameLines = doc.splitTextToSize(a.name, 50);
    doc.text(nameLines.slice(0, 2), x + 34, y + 19.5);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6.5);
    doc.text(`Reg: ${a.register_number}`, x + 34, y + 29);
    doc.text(`KIB: ${a.kib_code}`, x + 34, y + 33);
    const locLines = doc.splitTextToSize(a.recorded_location_name, 50);
    doc.text(locLines.slice(0, 1), x + 34, y + 37);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6);
    doc.text(a.qr_token, x + 3, y + 42.5);
  }

  doc.save(`Label_QR_ASSET-IN_${new Date().toISOString().slice(0, 10)}.pdf`);
}
