export type RoleCode =
  | 'ADMIN_SISTEM'
  | 'PENGURUS_BARANG'
  | 'PETUGAS_KECAMATAN'
  | 'PETUGAS_KELURAHAN'
  | 'KOORDINATOR_KELURAHAN'
  | 'PIMPINAN_VIEWER';

export type LocationType = 'Kecamatan' | 'Kelurahan' | 'Ruang';

export type ExistenceStatus =
  | 'Belum diperiksa'
  | 'Ditemukan'
  | 'Tidak ditemukan'
  | 'Dalam verifikasi';

export type ConditionStatus =
  | 'Baik'
  | 'Rusak ringan'
  | 'Rusak berat'
  | 'Tidak layak pakai';

export type VerificationStatus =
  | 'Menunggu Verifikasi'
  | 'Disetujui'
  | 'Dikembalikan';

export type MaintenancePriority = 'Rendah' | 'Sedang' | 'Tinggi' | 'Mendesak';

export type MaintenanceStatus = 'Terbuka' | 'Dalam Proses' | 'Selesai' | 'Ditutup';

export type CensusPeriodStatus = 'Draft' | 'Aktif' | 'Ditutup';

export interface Role {
  id: number;
  code: RoleCode;
  name: string;
  description: string;
  permissions: string[];
}

export interface LocationNode {
  id: number;
  code: string;
  name: string;
  type: LocationType;
  parent_id: number | null;
  parent_name?: string | null;
}

export interface UserAccount {
  id: number;
  name: string;
  employee_id: string;
  location_id: number;
  location_name: string;
  location_type: LocationType;
  role_id: number;
  role_code: RoleCode;
  role_name: string;
  permissions: string[];
  email: string;
  status: 'Aktif' | 'Nonaktif';
}

export interface CensusPeriod {
  id: number;
  code: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  status: CensusPeriodStatus;
  notes: string | null;
}

export interface AssetRecord {
  id: number;
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
  recorded_condition: ConditionStatus;
  recorded_location_id: number;
  recorded_location_name: string;
  recorded_unit_name: string;
  official_status: string;
  qr_token: string;
  import_batch_id: number | null;
  created_at: string;
  // Derived latest inspection summary (strictly separated from KIB B official fields)
  latest_inspection_id: number | null;
  latest_existence_status: ExistenceStatus;
  latest_condition_status: ConditionStatus | null;
  latest_actual_location_id: number | null;
  latest_actual_location_name: string | null;
  latest_pic_name: string | null;
  latest_verification_status: VerificationStatus | null;
  latest_inspected_at: string | null;
  has_location_discrepancy: boolean;
}

export interface AssetInspection {
  id: number;
  asset_id: number;
  asset_code: string;
  asset_name: string;
  kib_code: string;
  register_number: string;
  recorded_location_id: number;
  recorded_location_name: string;
  recorded_condition: ConditionStatus;
  period_id: number;
  period_name: string;
  inspector_user_id: number;
  inspector_name: string;
  existence_status: ExistenceStatus;
  condition_status: ConditionStatus;
  actual_location_id: number;
  actual_location_name: string;
  pic_name: string;
  photo_url: string | null;
  notes: string | null;
  koordinator_note: string | null;
  koordinator_reviewed_by: string | null;
  verification_status: VerificationStatus;
  verified_by_user_id: number | null;
  verified_by_name: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  inspected_at: string;
}

export interface ImportBatch {
  id: number;
  filename: string;
  imported_by_user_id: number;
  imported_by_name: string;
  total_rows: number;
  inserted_rows: number;
  duplicate_rows: number;
  error_rows: number;
  column_mapping_json: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceTicket {
  id: number;
  ticket_code: string;
  asset_id: number;
  asset_code: string;
  asset_name: string;
  location_name: string;
  reported_by_user_id: number;
  reported_by_name: string;
  assigned_pic: string;
  issue_description: string;
  priority: MaintenancePriority;
  target_date: string;
  status: MaintenanceStatus;
  resolution_notes: string | null;
  repair_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  role_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  details_json: string | null;
  created_at: string;
}

export interface DashboardData {
  activePeriod: CensusPeriod | null;
  kpi: {
    totalAssets: number;
    inspectedAssets: number;
    uninspectedAssets: number;
    foundAssets: number;
    missingAssets: number;
    inVerificationAssets: number;
    damagedAssets: number;
    pendingVerificationQueue: number;
    locationDiscrepancyCount: number;
    totalAcquisitionValue: number;
  };
  locationProgress: Array<{
    location_id: number;
    name: string;
    type: LocationType;
    total: number;
    inspected: number;
    found: number;
    missing: number;
    in_verification: number;
    damaged: number;
    progress_pct: number;
  }>;
  conditionBreakdown: Array<{
    condition: string;
    count: number;
  }>;
  exceptionAlerts: Array<{
    id: string;
    severity: 'warning' | 'critical' | 'info';
    category: string;
    asset_id: number;
    asset_code: string;
    asset_name: string;
    location_name: string;
    message: string;
    timestamp: string;
  }>;
  recentLogs: AuditLog[];
}

export type NavSectionId =
  | 'dashboard'
  | 'assets'
  | 'import'
  | 'qrcode'
  | 'scan'
  | 'census'
  | 'verification'
  | 'monitoring'
  | 'maintenance'
  | 'locations_users'
  | 'reports'
  | 'settings';
