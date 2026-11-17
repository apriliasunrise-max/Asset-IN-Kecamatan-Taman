import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  QrCode,
  ScanLine,
  ClipboardCheck,
  ShieldAlert,
  History,
  Wrench,
  MapPin,
  FileText,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Shield,
} from 'lucide-react';
import type { CensusPeriod, NavSectionId, UserAccount } from '../types.ts';

interface NavItem {
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPerm?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredPerm: 'dashboard:view' },
  { id: 'assets', label: 'Master KIB B', icon: Package, requiredPerm: 'assets:view' },
  { id: 'import', label: 'Import KIB B', icon: FileSpreadsheet, requiredPerm: 'import:execute' },
  { id: 'qrcode', label: 'QR Code Aset', icon: QrCode, requiredPerm: 'qrcode:manage' },
  { id: 'scan', label: 'Scan & Identifikasi', icon: ScanLine, requiredPerm: 'scan:use' },
  { id: 'census', label: 'Sensus Aset', icon: ClipboardCheck, requiredPerm: 'census:submit' },
  { id: 'verification', label: 'Verifikasi', icon: ShieldAlert },
  { id: 'monitoring', label: 'Monitoring & Riwayat', icon: History, requiredPerm: 'monitoring:view' },
  { id: 'maintenance', label: 'Pemeliharaan', icon: Wrench },
  { id: 'locations_users', label: 'Lokasi & Pengguna', icon: MapPin },
  { id: 'reports', label: 'Laporan', icon: FileText, requiredPerm: 'reports:export' },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export interface DemoAccountOption {
  id: number;
  name: string;
  employee_id: string;
  email: string;
  role_code: string;
  role_name: string;
  location_name: string;
}

interface LayoutProps {
  currentUser: UserAccount;
  activePeriod: CensusPeriod | null;
  activeNav: NavSectionId;
  pendingVerifications: number;
  demoAccounts: DemoAccountOption[];
  onSelectNav: (nav: NavSectionId) => void;
  onSwitchDemoUser: (userId: number) => void;
  onOpenLoginModal: () => void;
  children: React.ReactNode;
}

export function Layout({
  currentUser,
  activePeriod,
  activeNav,
  pendingVerifications,
  demoAccounts,
  onSelectNav,
  onSwitchDemoUser,
  onOpenLoginModal,
  children,
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.id === 'verification') {
      return (
        currentUser.permissions.includes('verification:approve') ||
        currentUser.permissions.includes('verification:koordinator_review') ||
        currentUser.role_code === 'PETUGAS_KECAMATAN' ||
        currentUser.role_code === 'PETUGAS_KELURAHAN'
      );
    }
    if (item.id === 'maintenance') {
      return (
        currentUser.permissions.includes('maintenance:manage') ||
        currentUser.permissions.includes('maintenance:report') ||
        currentUser.role_code === 'PIMPINAN_VIEWER'
      );
    }
    if (item.id === 'locations_users') {
      return (
        currentUser.permissions.includes('users:manage') ||
        currentUser.permissions.includes('locations:manage') ||
        currentUser.role_code === 'PENGURUS_BARANG'
      );
    }
    if (item.id === 'settings') {
      return (
        currentUser.permissions.includes('settings:manage') ||
        currentUser.permissions.includes('settings:periods')
      );
    }
    if (!item.requiredPerm) return true;
    return currentUser.permissions.includes(item.requiredPerm);
  });

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeNav);

  const mobileQuickTabs: NavSectionId[] = (
    ['dashboard', 'scan', 'census', 'assets'] as NavSectionId[]
  ).filter((id) => visibleNavItems.some((v) => v.id === id));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800 z-30">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sky-600 flex items-center justify-center font-display font-bold text-white text-sm shrink-0">
            AI
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-base tracking-tight text-white whitespace-nowrap">
              ASSET-IN
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Kecamatan Taman · KIB B
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectNav(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'verification' && pendingVerifications > 0 && (
                  <span
                    className={`font-mono text-xs px-1.5 py-0.5 rounded tabular-nums ${
                      isActive ? 'bg-sky-800 text-white' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {pendingVerifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-1.5">
          <div className="font-medium text-slate-200 truncate">{currentUser.name}</div>
          <div className="flex items-center gap-1.5 text-slate-400 truncate">
            <span>{currentUser.role_name}</span>
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            Wilayah: {currentUser.location_name}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-100 flex flex-col h-full z-10">
            <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-600 flex items-center justify-center font-display font-bold text-white text-sm">
                  AI
                </div>
                <span className="font-display font-bold text-white">ASSET-IN</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'verification' && pendingVerifications > 0 && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 tabular-nums">
                        {pendingVerifications}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Strictly 3-zone contract, single row) */}
        <header className="no-print sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Mobile toggle + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">Kecamatan Taman</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {activeNavMeta?.label || 'ASSET-IN'}
              </h1>
            </div>
          </div>

          {/* Zone 2: Active Period metadata (clean unboxed text) */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <span>Periode Aktif:</span>
            <span className="font-medium text-slate-800">
              {activePeriod ? activePeriod.name : 'Belum ada periode aktif'}
            </span>
          </div>

          {/* Zone 3: RBAC Role Switcher & Auth */}
          <div className="relative shrink-0">
            <button
              onClick={() => setRoleDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-left transition-colors whitespace-nowrap shrink-0"
            >
              <Shield className="h-4 w-4 text-sky-700 shrink-0" />
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold text-slate-900 max-w-[150px] truncate">
                  {currentUser.role_name}
                </div>
                <div className="text-[11px] text-slate-500 max-w-[150px] truncate">
                  {currentUser.location_name}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>

            {roleDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setRoleDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-40 py-2">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-900">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      NIP {currentUser.employee_id} · {currentUser.role_name}
                    </div>
                  </div>
                  <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-slate-400">
                    Uji Akses Peran (RBAC Switcher)
                  </div>
                  <div className="max-h-72 overflow-y-auto px-2 space-y-0.5">
                    {demoAccounts.map((acc) => {
                      const isCurrent = acc.id === currentUser.id;
                      return (
                        <button
                          key={acc.id}
                          onClick={() => {
                            onSwitchDemoUser(acc.id);
                            setRoleDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                            isCurrent
                              ? 'bg-sky-50 text-sky-900 font-medium'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate">{acc.role_name}</span>
                            {isCurrent && (
                              <span className="text-[11px] text-sky-700 shrink-0">Aktif</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {acc.name} · {acc.location_name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-2 px-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        onOpenLoginModal();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Masuk dengan Email / NIP
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Quick Field Bar (under 15% height cap) */}
        <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-20 flex items-center justify-around h-16 px-2">
          {mobileQuickTabs.map((id) => {
            const meta = NAV_ITEMS.find((n) => n.id === id)!;
            const Icon = meta.icon;
            const isActive = activeNav === id;
            return (
              <button
                key={id}
                onClick={() => onSelectNav(id)}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium min-h-[44px] ${
                  isActive ? 'text-sky-700' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="whitespace-nowrap">{meta.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
