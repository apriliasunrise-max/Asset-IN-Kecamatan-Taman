import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  Search,
  Upload,
  ClipboardCheck,
  AlertCircle,
  Lock,
} from 'lucide-react';
import type { AssetRecord, UserAccount } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { formatRupiah } from '../lib/exportUtils.ts';
import { ConditionLabel, ExistenceLabel, VerificationLabel } from './StatusPrimitives.tsx';

interface ScanIdentifyViewProps {
  currentUser: UserAccount;
  onProceedToCensus: (asset: AssetRecord) => void;
}

export function ScanIdentifyView({
  currentUser,
  onProceedToCensus,
}: ScanIdentifyViewProps) {
  const [manualQuery, setManualQuery] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [foundAsset, setFoundAsset] = useState<AssetRecord | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const lookupAsset = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setLookupError(null);
    try {
      const res = await apiRequest<{ asset: AssetRecord }>(
        `/assets/by-qr/${encodeURIComponent(trimmed)}`
      );
      setFoundAsset(res.asset);
      stopCamera();
    } catch (err) {
      setFoundAsset(null);
      setLookupError(err instanceof Error ? err.message : 'Aset tidak ditemukan.');
    } finally {
      setLoading(false);
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          setManualQuery(code.data);
          void lookupAsset(code.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const startCamera = async () => {
    setCameraError(null);
    setLookupError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser atau perangkat tidak mendukung akses kamera langsung.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
          rafRef.current = requestAnimationFrame(scanFrame);
        }
      });
    } catch {
      setCameraError(
        'Izin kamera ditolak atau tidak tersedia. Gunakan unggah foto QR atau pencarian manual di bawah.'
      );
    }
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLookupError(null);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        setManualQuery(code.data);
        void lookupAsset(code.data);
      } else {
        setLookupError('Kode QR tidak terbaca dari gambar tersebut. Pastikan fokus gambar jelas.');
      }
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          Scan & Identifikasi Aset KIB B
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Pindai stiker QR Code menggunakan kamera perangkat atau cari manual dengan Asset ID / Nomor Register
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scanner & Manual Input */}
        <section className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Pemindai Kamera QR Code
              </h3>
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                >
                  <Camera className="h-4 w-4" />
                  Aktifkan Kamera
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100"
                >
                  <CameraOff className="h-4 w-4" />
                  Matikan Kamera
                </button>
              )}
            </div>

            <div className="relative rounded-xl border border-slate-200 bg-slate-950 aspect-[4/3] overflow-hidden flex items-center justify-center">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-sky-400 rounded-xl" />
                  </div>
                </>
              ) : (
                <div className="text-center px-6 space-y-2">
                  <Camera className="h-10 w-10 text-slate-600 mx-auto" />
                  <div className="text-xs text-slate-300">
                    Kamera siap digunakan untuk memindai label QR aset di lapangan
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {cameraError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {cameraError}
              </div>
            )}

            <label className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer">
              <Upload className="h-4 w-4" />
              Atau Unggah Foto / Gambar Label QR
              <input type="file" accept="image/*" onChange={handleQrImageUpload} className="hidden" />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Pencarian Manual (Fallback Lapangan)
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void lookupAsset(manualQuery);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="Contoh: AST-TMN-0001 atau REG-2023-0041"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 whitespace-nowrap"
              >
                {loading ? 'Mencari...' : 'Identifikasi'}
              </button>
            </form>

            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
              <span>Uji cepat:</span>
              {['AST-TMN-0001', 'AST-KLT-0009', 'AST-KLJ-0013', 'AST-BBK-0025'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setManualQuery(code);
                    void lookupAsset(code);
                  }}
                  className="font-mono text-sky-700 hover:underline"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Identification Result Card */}
        <section className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between">
          {lookupError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 text-xs text-red-900">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">Identifikasi Gagal / Dibatasi</div>
                <div>{lookupError}</div>
              </div>
            </div>
          ) : !foundAsset ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-sm font-medium text-slate-900">
                Belum Ada Aset Teridentifikasi
              </div>
              <div className="text-xs text-slate-500 max-w-xs mx-auto">
                Arahkan kamera ke stiker QR atau masukkan Asset ID / Nomor Register untuk menampilkan identitas resmi KIB B.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="font-mono text-xs text-sky-700 font-semibold">
                    {foundAsset.asset_id} · {foundAsset.register_number}
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                    {foundAsset.name}
                  </h3>
                  <div className="text-xs text-slate-500">
                    {foundAsset.brand} {foundAsset.model} · S/N: {foundAsset.serial_number}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                  <Lock className="h-3 w-3" />
                  KIB B
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-slate-500">Kode Barang KIB B</div>
                  <div className="font-mono font-medium text-slate-900">{foundAsset.kib_code}</div>
                </div>
                <div>
                  <div className="text-slate-500">Tahun & Nilai Perolehan</div>
                  <div className="font-mono font-semibold text-slate-900 tabular-nums">
                    {foundAsset.acquisition_year} · {formatRupiah(foundAsset.acquisition_value)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Lokasi Tercatat (KIB B)</div>
                  <div className="font-medium text-slate-900">
                    {foundAsset.recorded_location_name}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Kondisi Tercatat (KIB B)</div>
                  <div className="font-medium text-slate-900">{foundAsset.recorded_condition}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs">
                <div className="font-semibold text-slate-800">
                  Status Sensus Terakhir (Periode Aktif)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExistenceLabel status={foundAsset.latest_existence_status} />
                  <ConditionLabel status={foundAsset.latest_condition_status} />
                  <VerificationLabel status={foundAsset.latest_verification_status} />
                </div>
                {foundAsset.latest_actual_location_name && (
                  <div className="text-slate-600">
                    Lokasi Aktual Terakhir: {foundAsset.latest_actual_location_name} (PIC:{' '}
                    {foundAsset.latest_pic_name})
                  </div>
                )}
              </div>

              {currentUser.permissions.includes('census:submit') && (
                <button
                  onClick={() => onProceedToCensus(foundAsset)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors min-h-[44px]"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Lanjut ke Form Sensus Fisik Aset Ini
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
