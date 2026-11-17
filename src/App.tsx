/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import type {
  AssetRecord,
  DashboardData,
  LocationNode,
  NavSectionId,
  UserAccount,
} from './types.ts';
import { apiRequest, getSessionToken, setSessionToken } from './lib/api.ts';
import { Layout, type DemoAccountOption } from './components/Layout.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { MasterAssetsView } from './components/MasterAssetsView.tsx';
import { ImportKibView } from './components/ImportKibView.tsx';
import { QrCodeView } from './components/QrCodeView.tsx';
import { ScanIdentifyView } from './components/ScanIdentifyView.tsx';
import { CensusFormView } from './components/CensusFormView.tsx';
import { VerificationQueueView } from './components/VerificationQueueView.tsx';
import { MonitoringHistoryView } from './components/MonitoringHistoryView.tsx';
import { MaintenanceView } from './components/MaintenanceView.tsx';
import { LocationsUsersView } from './components/LocationsUsersView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { LoginModal } from './components/LoginModal.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountOption[]>([]);
  const [activeNav, setActiveNav] = useState<NavSectionId>('dashboard');
  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [censusTargetAsset, setCensusTargetAsset] = useState<AssetRecord | null>(null);
  const [maintenanceTargetAsset, setMaintenanceTargetAsset] = useState<AssetRecord | null>(null);
  const [detailAssetId, setDetailAssetId] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const loadWorkspaceData = async () => {
    setDashboardLoading(true);
    try {
      const [dash, locRes] = await Promise.all([
        apiRequest<DashboardData>('/dashboard'),
        apiRequest<{ locations: LocationNode[] }>('/locations'),
      ]);
      setDashboardData(dash);
      setLocations(locRes.locations);
    } finally {
      setDashboardLoading(false);
    }
  };

  const bootstrapSession = async () => {
    try {
      const accountsRes = await apiRequest<{ accounts: DemoAccountOption[] }>(
        '/auth/demo-accounts'
      );
      setDemoAccounts(accountsRes.accounts);

      const existingToken = getSessionToken();
      if (existingToken) {
        try {
          const meRes = await apiRequest<{ user: UserAccount }>('/auth/me');
          setCurrentUser(meRes.user);
          await loadWorkspaceData();
          return;
        } catch {
          setSessionToken(null);
        }
      }

      // Default session as Rizka Aprilia (Admin Kecamatan Taman / Petugas Utama)
      const defaultDemo =
        accountsRes.accounts.find((a) => a.role_code === 'ADMIN_SISTEM') ||
        accountsRes.accounts[0];
      const switchRes = await apiRequest<{ token: string; user: UserAccount }>(
        '/auth/demo-switch',
        {
          method: 'POST',
          body: JSON.stringify({ userId: defaultDemo?.id || 2 }),
        }
      );
      setSessionToken(switchRes.token);
      setCurrentUser(switchRes.user);
      await loadWorkspaceData();
    } catch (err) {
      setBootError(
        err instanceof Error ? err.message : 'Gagal menghubungkan ke server ASSET-IN.'
      );
    }
  };

  useEffect(() => {
    void bootstrapSession();
  }, []);

  const handleSwitchDemoUser = async (userId: number) => {
    const res = await apiRequest<{ token: string; user: UserAccount }>('/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setSessionToken(res.token);
    setCurrentUser(res.user);
    setActiveNav('dashboard');
    setCensusTargetAsset(null);
    setMaintenanceTargetAsset(null);
    await loadWorkspaceData();
  };

  const handleCredentialLogin = async (identifier: string, password: string) => {
    const res = await apiRequest<{ token: string; user: UserAccount }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setSessionToken(res.token);
    setCurrentUser(res.user);
    setActiveNav('dashboard');
    await loadWorkspaceData();
  };

  if (bootError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-red-200 max-w-md w-full p-6 space-y-3 text-center">
          <h1 className="font-display text-lg font-bold text-slate-900">
            Gagal Memuat ASSET-IN
          </h1>
          <p className="text-xs text-red-700">{bootError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-600">Menyiapkan ruang kerja ASSET-IN Kecamatan Taman...</div>
      </div>
    );
  }

  return (
    <Layout
      currentUser={currentUser}
      activePeriod={dashboardData?.activePeriod || null}
      activeNav={activeNav}
      pendingVerifications={dashboardData?.kpi.pendingVerificationQueue || 0}
      demoAccounts={demoAccounts}
      onSelectNav={setActiveNav}
      onSwitchDemoUser={handleSwitchDemoUser}
      onOpenLoginModal={() => setShowLoginModal(true)}
    >
      {activeNav === 'dashboard' && (
        <DashboardView
          data={dashboardData}
          loading={dashboardLoading}
          currentUser={currentUser}
          onNavigate={setActiveNav}
          onInspectAssetId={(id) => {
            setDetailAssetId(id);
            setActiveNav('assets');
          }}
        />
      )}

      {activeNav === 'assets' && (
        <MasterAssetsView
          currentUser={currentUser}
          locations={locations}
          initialSelectedAssetId={detailAssetId}
          onClearInitialAsset={() => setDetailAssetId(null)}
          onStartCensusForAsset={(asset) => {
            setCensusTargetAsset(asset);
            setActiveNav('census');
          }}
          onCreateMaintenanceForAsset={(asset) => {
            setMaintenanceTargetAsset(asset);
            setActiveNav('maintenance');
          }}
        />
      )}

      {activeNav === 'import' && (
        <ImportKibView
          onImportCompleted={() => {
            void loadWorkspaceData();
          }}
        />
      )}

      {activeNav === 'qrcode' && <QrCodeView locations={locations} />}

      {activeNav === 'scan' && (
        <ScanIdentifyView
          currentUser={currentUser}
          onProceedToCensus={(asset) => {
            setCensusTargetAsset(asset);
            setActiveNav('census');
          }}
        />
      )}

      {activeNav === 'census' && (
        <CensusFormView
          currentUser={currentUser}
          locations={locations}
          preselectedAsset={censusTargetAsset}
          onSubmitted={() => {
            void loadWorkspaceData();
          }}
        />
      )}

      {activeNav === 'verification' && (
        <VerificationQueueView
          currentUser={currentUser}
          onVerified={() => {
            void loadWorkspaceData();
          }}
        />
      )}

      {activeNav === 'monitoring' && <MonitoringHistoryView />}

      {activeNav === 'maintenance' && (
        <MaintenanceView
          currentUser={currentUser}
          preselectedAsset={maintenanceTargetAsset}
          onClearPreselected={() => setMaintenanceTargetAsset(null)}
        />
      )}

      {activeNav === 'locations_users' && (
        <LocationsUsersView
          currentUser={currentUser}
          locations={locations}
          onRefreshLocations={() => {
            void loadWorkspaceData();
          }}
        />
      )}

      {activeNav === 'reports' && <ReportsView locations={locations} />}

      {activeNav === 'settings' && (
        <SettingsView
          currentUser={currentUser}
          onPeriodChanged={() => {
            void loadWorkspaceData();
          }}
        />
      )}

      {showLoginModal && (
        <LoginModal
          demoAccounts={demoAccounts}
          onLogin={handleCredentialLogin}
          onQuickSwitch={handleSwitchDemoUser}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </Layout>
  );
}
