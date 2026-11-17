import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import type { DemoAccountOption } from './Layout.tsx';

interface LoginModalProps {
  demoAccounts: DemoAccountOption[];
  onLogin: (identifier: string, password: string) => Promise<void>;
  onQuickSwitch: (userId: number) => Promise<void>;
  onClose: () => void;
}

export function LoginModal({
  demoAccounts,
  onLogin,
  onQuickSwitch,
  onClose,
}: LoginModalProps) {
  const [identifier, setIdentifier] = useState('rizka.aprilia@taman.assetin.id');
  const [password, setPassword] = useState('assetin2026');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(identifier, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-sky-700" />
            <h3 className="font-display text-base font-bold text-slate-900">
              Masuk Akun ASSET-IN
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Email Dinas / NIP</label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Kata Sandi</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-200 space-y-2">
          <div className="text-[11px] font-semibold text-slate-500">
            Atau Pilih Cepat Akun Peran RBAC (Password default: assetin2026)
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1">
            {demoAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={async () => {
                  await onQuickSwitch(acc.id);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs"
              >
                <div className="font-semibold text-slate-900">{acc.role_name}</div>
                <div className="text-[11px] text-slate-500">
                  {acc.email} · {acc.location_name}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
