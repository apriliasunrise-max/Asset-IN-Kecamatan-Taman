import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'assetin.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function getDbPath(): string {
  return DB_PATH;
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      permissions_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('Kecamatan', 'Kelurahan', 'Ruang')),
      parent_id INTEGER NULL REFERENCES locations(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      employee_id TEXT NOT NULL UNIQUE,
      location_id INTEGER NOT NULL REFERENCES locations(id),
      role_id INTEGER NOT NULL REFERENCES roles(id),
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif'))
    );

    CREATE TABLE IF NOT EXISTS census_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Aktif', 'Ditutup')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      imported_by_user_id INTEGER NOT NULL REFERENCES users(id),
      total_rows INTEGER NOT NULL,
      inserted_rows INTEGER NOT NULL,
      duplicate_rows INTEGER NOT NULL,
      error_rows INTEGER NOT NULL,
      column_mapping_json TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT NOT NULL UNIQUE,
      kib_code TEXT NOT NULL,
      register_number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      acquisition_year INTEGER NOT NULL,
      acquisition_value REAL NOT NULL,
      recorded_condition TEXT NOT NULL CHECK (recorded_condition IN ('Baik', 'Rusak ringan', 'Rusak berat', 'Tidak layak pakai')),
      recorded_location_id INTEGER NOT NULL REFERENCES locations(id),
      official_status TEXT NOT NULL DEFAULT 'Tercatat KIB B',
      qr_token TEXT NOT NULL UNIQUE,
      import_batch_id INTEGER NULL REFERENCES import_batches(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS asset_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id),
      period_id INTEGER NOT NULL REFERENCES census_periods(id),
      inspector_user_id INTEGER NOT NULL REFERENCES users(id),
      existence_status TEXT NOT NULL CHECK (existence_status IN ('Belum diperiksa', 'Ditemukan', 'Tidak ditemukan', 'Dalam verifikasi')),
      condition_status TEXT NOT NULL CHECK (condition_status IN ('Baik', 'Rusak ringan', 'Rusak berat', 'Tidak layak pakai')),
      actual_location_id INTEGER NOT NULL REFERENCES locations(id),
      pic_name TEXT NOT NULL,
      photo_url TEXT,
      notes TEXT,
      koordinator_note TEXT,
      koordinator_reviewed_by TEXT,
      verification_status TEXT NOT NULL DEFAULT 'Menunggu Verifikasi' CHECK (verification_status IN ('Menunggu Verifikasi', 'Disetujui', 'Dikembalikan')),
      verified_by_user_id INTEGER NULL REFERENCES users(id),
      verified_at TEXT,
      rejection_reason TEXT,
      inspected_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_code TEXT NOT NULL UNIQUE,
      asset_id INTEGER NOT NULL REFERENCES assets(id),
      reported_by_user_id INTEGER NOT NULL REFERENCES users(id),
      assigned_pic TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('Rendah', 'Sedang', 'Tinggi', 'Mendesak')),
      target_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Terbuka' CHECK (status IN ('Terbuka', 'Dalam Proses', 'Selesai', 'Ditutup')),
      resolution_notes TEXT,
      repair_photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

export function seedDatabaseIfEmpty(): void {
  const roleCount = db.prepare('SELECT COUNT(*) as c FROM roles').get() as { c: number };
  const hasUpdatedUnits = db
    .prepare("SELECT 1 FROM locations WHERE name = 'Kelurahan Kalijaten' LIMIT 1")
    .get();
  if (roleCount.c > 0 && hasUpdatedUnits) return;

  if (roleCount.c > 0 && !hasUpdatedUnits) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM audit_logs;
      DELETE FROM maintenance_tickets;
      DELETE FROM asset_inspections;
      DELETE FROM assets;
      DELETE FROM import_batches;
      DELETE FROM census_periods;
      DELETE FROM users;
      DELETE FROM locations;
      DELETE FROM roles;
      DELETE FROM sqlite_sequence;
    `);
    db.pragma('foreign_keys = ON');
  }

  const insertRole = db.prepare(
    'INSERT INTO roles (code, name, description, permissions_json) VALUES (?, ?, ?, ?)'
  );
  const roles = [
    [
      'ADMIN_SISTEM',
      'Admin Sistem',
      'Akses penuh konfigurasi sistem, manajemen akun, role, master lokasi, backup, dan audit log.',
      JSON.stringify([
        'dashboard:view',
        'assets:view',
        'import:execute',
        'qrcode:manage',
        'scan:use',
        'census:submit',
        'verification:approve',
        'monitoring:view',
        'maintenance:manage',
        'locations:manage',
        'users:manage',
        'reports:export',
        'settings:manage',
      ]),
    ],
    [
      'PENGURUS_BARANG',
      'Pengurus Barang Kecamatan',
      'Import Excel KIB B, generate & cetak QR Code, penugasan periode sensus, verifikasi/approval hasil sensus, manajemen tiket pemeliharaan, ekspor laporan.',
      JSON.stringify([
        'dashboard:view',
        'assets:view',
        'import:execute',
        'qrcode:manage',
        'scan:use',
        'census:submit',
        'verification:approve',
        'monitoring:view',
        'maintenance:manage',
        'reports:export',
        'settings:periods',
      ]),
    ],
    [
      'PETUGAS_KECAMATAN',
      'Petugas Kecamatan',
      'Melakukan scan QR dan pemeriksaan/sensus fisik aset di lingkungan kantor Kecamatan Taman.',
      JSON.stringify([
        'dashboard:view',
        'assets:view',
        'scan:use',
        'census:submit',
        'monitoring:view',
        'maintenance:report',
      ]),
    ],
    [
      'PETUGAS_KELURAHAN',
      'Petugas Kelurahan',
      'Melakukan scan QR dan sensus fisik terbatas pada wilayah kelurahannya sendiri.',
      JSON.stringify([
        'dashboard:view',
        'assets:view',
        'scan:use',
        'census:submit',
        'monitoring:view',
        'maintenance:report',
      ]),
    ],
    [
      'KOORDINATOR_KELURAHAN',
      'Koordinator Kelurahan',
      'Monitoring progres sensus dan review awal hasil pemeriksaan di kelurahan setempat.',
      JSON.stringify([
        'dashboard:view',
        'assets:view',
        'scan:use',
        'census:submit',
        'verification:koordinator_review',
        'monitoring:view',
        'maintenance:report',
        'reports:export',
      ]),
    ],
    [
      'PIMPINAN_VIEWER',
      'Pimpinan / Viewer',
      'Akses read-only untuk dashboard, grafik KPI, rekapitulasi, dan ekspor laporan tanpa izin edit.',
      JSON.stringify(['dashboard:view', 'assets:view', 'monitoring:view', 'reports:export']),
    ],
  ];

  for (const r of roles) insertRole.run(...r);

  // Locations hierarchy: Kecamatan Taman -> Kantor Kecamatan + 8 Kelurahan -> Ruangan
  const insertLoc = db.prepare(
    'INSERT INTO locations (code, name, type, parent_id) VALUES (?, ?, ?, ?)'
  );
  const kecId = Number(insertLoc.run('KEC-TMN', 'Kecamatan Taman', 'Kecamatan', null).lastInsertRowid);

  // Kantor Kecamatan Rooms
  const rCamat = Number(insertLoc.run('KEC-TMN-R01', 'Ruang Camat', 'Ruang', kecId).lastInsertRowid);
  const rPelayananKec = Number(insertLoc.run('KEC-TMN-R02', 'Ruang Pelayanan Terpadu (PATEN)', 'Ruang', kecId).lastInsertRowid);
  const rSekretariat = Number(insertLoc.run('KEC-TMN-R03', 'Ruang Sekretariat & Arsip', 'Ruang', kecId).lastInsertRowid);
  const rAulaKec = Number(insertLoc.run('KEC-TMN-R04', 'Aula Pertemuan Kecamatan', 'Ruang', kecId).lastInsertRowid);

  // 8 Kelurahan of Kecamatan Taman
  const kelurahanNames = [
    ['KEL-KLT', 'Kelurahan Taman'],
    ['KEL-KLJ', 'Kelurahan Kalijaten'],
    ['KEL-WNC', 'Kelurahan Wonocolo'],
    ['KEL-GLR', 'Kelurahan Geluran'],
    ['KEL-KTG', 'Kelurahan Ketegan'],
    ['KEL-SPJ', 'Kelurahan Sepanjang'],
    ['KEL-NGL', 'Kelurahan Ngelom'],
    ['KEL-BBK', 'Kelurahan Bebekan'],
  ] as const;

  const kelIds: Record<string, { root: number; rPelayanan: number; rLurah: number }> = {};
  for (const [code, name] of kelurahanNames) {
    const kId = Number(insertLoc.run(code, name, 'Kelurahan', kecId).lastInsertRowid);
    const rPel = Number(insertLoc.run(`${code}-R01`, `Ruang Pelayanan ${name}`, 'Ruang', kId).lastInsertRowid);
    const rLur = Number(insertLoc.run(`${code}-R02`, `Ruang Lurah & Staf ${name}`, 'Ruang', kId).lastInsertRowid);
    kelIds[code] = { root: kId, rPelayanan: rPel, rLurah: rLur };
  }

  // Users across all 6 roles & all 9 units (Kecamatan Taman + 8 Kelurahan)
  const getRoleId = (code: string) =>
    (db.prepare('SELECT id FROM roles WHERE code = ?').get(code) as { id: number }).id;

  const insertUser = db.prepare(
    'INSERT INTO users (name, employee_id, location_id, role_id, email, password, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  // Kecamatan Taman: Rizka Aprilia (Petugas Utama / Admin Kecamatan)
  const adminId = Number(
    insertUser.run(
      'Rizka Aprilia',
      '199004122014022001',
      kecId,
      getRoleId('ADMIN_SISTEM'),
      'rizka.aprilia@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );
  const pengurusId = Number(
    insertUser.run(
      'Siti Rahmawati, S.E.',
      '198409212009022007',
      kecId,
      getRoleId('PENGURUS_BARANG'),
      'pengurus.barang@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );
  const petugasKecId = Number(
    insertUser.run(
      'Dimas Pratama, A.Md',
      '199105152019031009',
      kecId,
      getRoleId('PETUGAS_KECAMATAN'),
      'petugas.kec@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );

  // 8 Petugas Kelurahan sesuai daftar Penanggung Jawab
  const petugasKelTamanId = Number(
    insertUser.run(
      'Rizkhe',
      '199311082020122011',
      kelIds['KEL-KLT'].root,
      getRoleId('PETUGAS_KELURAHAN'),
      'rizkhe.taman@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );
  const petugasKalijatenId = Number(
    insertUser.run(
      'Aida',
      '199403182020122014',
      kelIds['KEL-KLJ'].root,
      getRoleId('PETUGAS_KELURAHAN'),
      'aida.kalijaten@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );
  insertUser.run(
    'Rizal',
    '199207112019031005',
    kelIds['KEL-WNC'].root,
    getRoleId('PETUGAS_KELURAHAN'),
    'rizal.wonocolo@taman.assetin.id',
    'assetin2026',
    'Aktif'
  );
  const petugasGeluranId = Number(
    insertUser.run(
      'Yoga',
      '199501222021021003',
      kelIds['KEL-GLR'].root,
      getRoleId('PETUGAS_KELURAHAN'),
      'yoga.geluran@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );
  const petugasKeteganId = Number(
    insertUser.run(
      'Mariana',
      '199108042018012006',
      kelIds['KEL-KTG'].root,
      getRoleId('PETUGAS_KELURAHAN'),
      'mariana.ketegan@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );
  insertUser.run(
    'Andik',
    '198911192015041002',
    kelIds['KEL-SPJ'].root,
    getRoleId('PETUGAS_KELURAHAN'),
    'andik.sepanjang@taman.assetin.id',
    'assetin2026',
    'Aktif'
  );
  insertUser.run(
    'Laila',
    '199406152021022008',
    kelIds['KEL-NGL'].root,
    getRoleId('PETUGAS_KELURAHAN'),
    'laila.ngelom@taman.assetin.id',
    'assetin2026',
    'Aktif'
  );
  const petugasBebekanId = Number(
    insertUser.run(
      'Riza',
      '199302192020121004',
      kelIds['KEL-BBK'].root,
      getRoleId('PETUGAS_KELURAHAN'),
      'riza.bebekan@taman.assetin.id',
      'assetin2026',
      'Aktif'
    ).lastInsertRowid
  );

  // Koordinator Kelurahan & Pimpinan / Viewer
  insertUser.run(
    'Drs. Bambang Sutrisno',
    '197903142005011003',
    kelIds['KEL-KLT'].root,
    getRoleId('KOORDINATOR_KELURAHAN'),
    'koordinator.taman@taman.assetin.id',
    'assetin2026',
    'Aktif'
  );
  insertUser.run(
    'H. Agus Prasetyo, S.STP, M.Si',
    '197608171998101001',
    kecId,
    getRoleId('PIMPINAN_VIEWER'),
    'camat.taman@taman.assetin.id',
    'assetin2026',
    'Aktif'
  );

  // Census Periods
  const insertPeriod = db.prepare(
    'INSERT INTO census_periods (code, name, year, start_date, end_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertPeriod.run(
    'SENSUS-2026-S1',
    'Sensus KIB B Semester I Tahun 2026',
    2026,
    '2026-01-10',
    '2026-06-30',
    'Ditutup',
    'Periode sensus awal semester I yang telah selesai direkonsiliasi.'
  );
  const activePeriodId = Number(
    insertPeriod.run(
      'SENSUS-2026-S2',
      'Sensus KIB B Semester II Tahun 2026',
      2026,
      '2026-10-01',
      '2026-12-20',
      'Aktif',
      'Sensus fisik menyeluruh Peralatan & Mesin Kecamatan Taman dan 8 Kelurahan.'
    ).lastInsertRowid
  );

  // Initial Import Batches
  const insertBatch = db.prepare(
    'INSERT INTO import_batches (filename, imported_by_user_id, total_rows, inserted_rows, duplicate_rows, error_rows, column_mapping_json, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const batch1Id = Number(
    insertBatch.run(
      'KIB_B_KEC_TAMAN_2026_Q3.xlsx',
      pengurusId,
      20,
      20,
      0,
      0,
      JSON.stringify({
        kib_code: 'Kode Barang',
        register_number: 'No. Register',
        name: 'Nama Barang',
        acquisition_year: 'Tahun Perolehan',
        acquisition_value: 'Harga Perolehan',
      }),
      'Selesai',
      'Import data induk KIB B Kantor Kecamatan Taman.',
      '2026-10-02 09:15:00'
    ).lastInsertRowid
  );
  const batch2Id = Number(
    insertBatch.run(
      'KIB_B_8_KELURAHAN_TAMAN_2026.xlsx',
      pengurusId,
      16,
      16,
      0,
      0,
      JSON.stringify({
        kib_code: 'Kode Barang',
        register_number: 'No. Register',
        name: 'Nama Barang',
        acquisition_year: 'Tahun Perolehan',
        acquisition_value: 'Harga Perolehan',
      }),
      'Selesai',
      'Import data KIB B untuk 8 Kelurahan wilayah Kecamatan Taman.',
      '2026-10-04 14:20:00'
    ).lastInsertRowid
  );

  // Seed 28 Realistic KIB B Assets across Kantor Kecamatan & all 8 Kelurahan
  const insertAsset = db.prepare(`
    INSERT INTO assets (
      asset_id, kib_code, register_number, name, category, brand, model,
      serial_number, acquisition_year, acquisition_value, recorded_condition,
      recorded_location_id, official_status, qr_token, import_batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAssets: Array<{
    asset_id: string;
    kib_code: string;
    register_number: string;
    name: string;
    category: string;
    brand: string;
    model: string;
    serial_number: string;
    year: number;
    value: number;
    condition: string;
    locId: number;
    batchId: number;
  }> = [
    // Kecamatan Taman
    { asset_id: 'AST-TMN-0001', kib_code: '1.3.2.10.01.02.002', register_number: 'REG-2023-0001', name: 'Laptop Kerja Operasional', category: 'Komputer & TI', brand: 'Dell', model: 'Latitude 5430', serial_number: 'DL5430-99182', year: 2023, value: 16500000, condition: 'Baik', locId: rSekretariat, batchId: batch1Id },
    { asset_id: 'AST-TMN-0002', kib_code: '1.3.2.10.02.03.003', register_number: 'REG-2021-0014', name: 'Printer Multifungsi Laser', category: 'Peralatan Kantor', brand: 'Fuji Xerox', model: 'DocuCentre S2110', serial_number: 'FX-2110-4481', year: 2021, value: 24800000, condition: 'Baik', locId: rPelayananKec, batchId: batch1Id },
    { asset_id: 'AST-TMN-0003', kib_code: '1.3.2.05.02.04.001', register_number: 'REG-2020-0008', name: 'AC Split 2 PK Aula', category: 'Pendingin Ruangan', brand: 'LG', model: 'Hercules T18EMV', serial_number: 'LGAC-88201', year: 2020, value: 7850000, condition: 'Baik', locId: rAulaKec, batchId: batch1Id },
    { asset_id: 'AST-TMN-0004', kib_code: '1.3.2.02.01.02.003', register_number: 'REG-2022-0002', name: 'Kendaraan Dinas Roda 4', category: 'Kendaraan Dinas', brand: 'Toyota', model: 'Avanza 1.5 G MT', serial_number: 'MHFM1BA3JNK0192', year: 2022, value: 245000000, condition: 'Baik', locId: rCamat, batchId: batch1Id },
    { asset_id: 'AST-TMN-0005', kib_code: '1.3.2.10.01.02.001', register_number: 'REG-2024-0005', name: 'PC All-in-One Pelayanan', category: 'Komputer & TI', brand: 'HP', model: 'ProOne 440 G9', serial_number: 'HP440G9-3104', year: 2024, value: 14200000, condition: 'Baik', locId: rPelayananKec, batchId: batch1Id },
    { asset_id: 'AST-TMN-0006', kib_code: '1.3.2.05.01.04.001', register_number: 'REG-2019-0022', name: 'Lemari Arsip Besi Pintu Kaca', category: 'Meubelair & Arsip', brand: 'Brother', model: 'B-304', serial_number: 'BRT-304-119', year: 2019, value: 3450000, condition: 'Baik', locId: rSekretariat, batchId: batch1Id },
    { asset_id: 'AST-TMN-0007', kib_code: '1.3.2.06.01.02.006', register_number: 'REG-2020-0031', name: 'Proyektor LCD Presentasi', category: 'Audio Visual', brand: 'Epson', model: 'EB-X500', serial_number: 'EPS-X500-7712', year: 2020, value: 6900000, condition: 'Rusak ringan', locId: rAulaKec, batchId: batch1Id },
    { asset_id: 'AST-TMN-0008', kib_code: '1.3.2.01.03.04.002', register_number: 'REG-2018-0011', name: 'Genset Silent 10 KVA', category: 'Peralatan Listrik', brand: 'Yanmar', model: 'YEG-10S', serial_number: 'YNM-10S-0891', year: 2018, value: 42000000, condition: 'Baik', locId: kecId, batchId: batch1Id },

    // Kelurahan Taman
    { asset_id: 'AST-KLT-0009', kib_code: '1.3.2.10.01.02.002', register_number: 'REG-2023-0041', name: 'Laptop Pelayanan Kependudukan', category: 'Komputer & TI', brand: 'Lenovo', model: 'ThinkPad E14 Gen 4', serial_number: 'LNV-E14-5521', year: 2023, value: 15800000, condition: 'Baik', locId: kelIds['KEL-KLT'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-KLT-0010', kib_code: '1.3.2.10.02.03.003', register_number: 'REG-2022-0042', name: 'Printer Epson EcoTank L6290', category: 'Peralatan Kantor', brand: 'Epson', model: 'L6290 Wi-Fi', serial_number: 'EPS-6290-198', year: 2022, value: 6200000, condition: 'Baik', locId: kelIds['KEL-KLT'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-KLT-0011', kib_code: '1.3.2.02.01.04.001', register_number: 'REG-2021-0043', name: 'Sepeda Motor Dinas Lurah', category: 'Kendaraan Dinas', brand: 'Honda', model: 'Supra X 125 FI', serial_number: 'MH1JB9128MK041', year: 2021, value: 19400000, condition: 'Baik', locId: kelIds['KEL-KLT'].rLurah, batchId: batch2Id },
    { asset_id: 'AST-KLT-0012', kib_code: '1.3.2.05.02.04.001', register_number: 'REG-2019-0044', name: 'AC Split 1.5 PK Ruang Lurah', category: 'Pendingin Ruangan', brand: 'Daikin', model: 'FTC35NV14', serial_number: 'DKN-35N-772', year: 2019, value: 6400000, condition: 'Baik', locId: kelIds['KEL-KLT'].rLurah, batchId: batch2Id },

    // Kelurahan Kalijaten
    { asset_id: 'AST-KLJ-0013', kib_code: '1.3.2.10.01.02.001', register_number: 'REG-2023-0051', name: 'PC Desktop Administrasi', category: 'Komputer & TI', brand: 'Asus', model: 'ExpertCenter D5', serial_number: 'ASU-D5-4412', year: 2023, value: 11900000, condition: 'Baik', locId: kelIds['KEL-KLJ'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-KLJ-0014', kib_code: '1.3.2.06.01.01.002', register_number: 'REG-2020-0052', name: 'Sound System Portable Rapat', category: 'Audio Visual', brand: 'TOA', model: 'ZW-G810CU', serial_number: 'TOA-810-904', year: 2020, value: 4800000, condition: 'Baik', locId: kelIds['KEL-KLJ'].rLurah, batchId: batch2Id },

    // Kelurahan Wonocolo
    { asset_id: 'AST-WNC-0015', kib_code: '1.3.2.10.01.02.002', register_number: 'REG-2022-0061', name: 'Laptop Bendahara Kelurahan', category: 'Komputer & TI', brand: 'HP', model: 'ProBook 440 G8', serial_number: 'HP440G8-882', year: 2022, value: 14900000, condition: 'Baik', locId: kelIds['KEL-WNC'].rLurah, batchId: batch2Id },
    { asset_id: 'AST-WNC-0016', kib_code: '1.3.2.05.01.01.005', register_number: 'REG-2019-0062', name: 'Brankas Tahan Api', category: 'Meubelair & Arsip', brand: 'ChubbSafes', model: 'Cobra Executive', serial_number: 'CHB-CE-204', year: 2019, value: 8700000, condition: 'Baik', locId: kelIds['KEL-WNC'].rLurah, batchId: batch2Id },

    // Kelurahan Geluran
    { asset_id: 'AST-GLR-0017', kib_code: '1.3.2.10.02.03.005', register_number: 'REG-2023-0071', name: 'Mesin Antrian & Kiosk Informasi', category: 'Peralatan Kantor', brand: 'Zyrex', model: 'Kiosk-T21', serial_number: 'ZYR-K21-019', year: 2023, value: 18500000, condition: 'Baik', locId: kelIds['KEL-GLR'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-GLR-0018', kib_code: '1.3.2.02.01.04.001', register_number: 'REG-2020-0072', name: 'Sepeda Motor Operasional Trantib', category: 'Kendaraan Dinas', brand: 'Yamaha', model: 'Vega Force DB', serial_number: 'MH3UE1120LJ092', year: 2020, value: 17200000, condition: 'Baik', locId: kelIds['KEL-GLR'].rLurah, batchId: batch2Id },

    // Kelurahan Ketegan
    { asset_id: 'AST-KTG-0019', kib_code: '1.3.2.10.01.02.001', register_number: 'REG-2021-0081', name: 'PC Desktop Operator SIAK', category: 'Komputer & TI', brand: 'Acer', model: 'Veriton M4665G', serial_number: 'ACR-M46-331', year: 2021, value: 10800000, condition: 'Baik', locId: kelIds['KEL-KTG'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-KTG-0020', kib_code: '1.3.2.05.02.04.001', register_number: 'REG-2018-0082', name: 'AC Split 1 PK Ruang Pelayanan', category: 'Pendingin Ruangan', brand: 'Panasonic', model: 'CS-YN9WKJ', serial_number: 'PNS-YN9-654', year: 2018, value: 4950000, condition: 'Rusak ringan', locId: kelIds['KEL-KTG'].rPelayanan, batchId: batch2Id },

    // Kelurahan Sepanjang
    { asset_id: 'AST-SPJ-0021', kib_code: '1.3.2.06.01.02.001', register_number: 'REG-2022-0091', name: 'Kamera Dokumentasi Kegiatan', category: 'Audio Visual', brand: 'Canon', model: 'EOS M50 Mark II', serial_number: 'CNN-M50-712', year: 2022, value: 11200000, condition: 'Baik', locId: kelIds['KEL-SPJ'].rLurah, batchId: batch2Id },
    { asset_id: 'AST-SPJ-0022', kib_code: '1.3.2.10.02.03.003', register_number: 'REG-2023-0092', name: 'Scanner Dokumen Kecepatan Tinggi', category: 'Peralatan Kantor', brand: 'Fujitsu', model: 'fi-8150', serial_number: 'FJT-8150-309', year: 2023, value: 13400000, condition: 'Baik', locId: kelIds['KEL-SPJ'].rPelayanan, batchId: batch2Id },

    // Kelurahan Ngelom
    { asset_id: 'AST-NGL-0023', kib_code: '1.3.2.10.01.02.002', register_number: 'REG-2021-0101', name: 'Laptop Pengadministrasi Umum', category: 'Komputer & TI', brand: 'Asus', model: 'ExpertBook B1400', serial_number: 'ASU-B14-120', year: 2021, value: 12100000, condition: 'Baik', locId: kelIds['KEL-NGL'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-NGL-0024', kib_code: '1.3.2.05.01.02.003', register_number: 'REG-2017-0102', name: 'Meja Rapat Kayu Jati 12 Kursi', category: 'Meubelair & Arsip', brand: 'Lokal Koperasi', model: 'MR-240', serial_number: 'LK-MR240-08', year: 2017, value: 9600000, condition: 'Baik', locId: kelIds['KEL-NGL'].rLurah, batchId: batch2Id },

    // Kelurahan Bebekan
    { asset_id: 'AST-BBK-0025', kib_code: '1.3.2.10.01.02.001', register_number: 'REG-2024-0111', name: 'PC All-in-One Loket Layanan', category: 'Komputer & TI', brand: 'Lenovo', model: 'ThinkCentre Neo 30a', serial_number: 'LNV-NEO-981', year: 2024, value: 13700000, condition: 'Baik', locId: kelIds['KEL-BBK'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-BBK-0026', kib_code: '1.3.2.10.02.03.003', register_number: 'REG-2020-0112', name: 'Printer Thermal & Inkjet', category: 'Peralatan Kantor', brand: 'Brother', model: 'DCP-T720DW', serial_number: 'BRT-T720-663', year: 2020, value: 4300000, condition: 'Baik', locId: kelIds['KEL-BBK'].rPelayanan, batchId: batch2Id },
    { asset_id: 'AST-BBK-0027', kib_code: '1.3.2.05.02.04.001', register_number: 'REG-2019-0113', name: 'AC Split 2 PK Balai Kelurahan', category: 'Pendingin Ruangan', brand: 'Sharp', model: 'AH-A18UCY', serial_number: 'SHP-18U-402', year: 2019, value: 7100000, condition: 'Baik', locId: kelIds['KEL-BBK'].rLurah, batchId: batch2Id },
    { asset_id: 'AST-BBK-0028', kib_code: '1.3.2.02.01.04.001', register_number: 'REG-2022-0114', name: 'Sepeda Motor Dinas Kelurahan', category: 'Kendaraan Dinas', brand: 'Honda', model: 'Revo Fit FI', serial_number: 'MH1JBK118NK209', year: 2022, value: 16400000, condition: 'Baik', locId: kelIds['KEL-BBK'].rLurah, batchId: batch2Id },
  ];

  const assetIdMap: Record<string, number> = {};
  for (const a of seedAssets) {
    const token = `QR-${a.asset_id}-TMN26`;
    const id = Number(
      insertAsset.run(
        a.asset_id,
        a.kib_code,
        a.register_number,
        a.name,
        a.category,
        a.brand,
        a.model,
        a.serial_number,
        a.year,
        a.value,
        a.condition,
        a.locId,
        'Tercatat KIB B',
        token,
        a.batchId
      ).lastInsertRowid
    );
    assetIdMap[a.asset_id] = id;
  }

  // Seed realistic inspections for active period (Semester II 2026)
  const insertInsp = db.prepare(`
    INSERT INTO asset_inspections (
      asset_id, period_id, inspector_user_id, existence_status, condition_status,
      actual_location_id, pic_name, photo_url, notes, koordinator_note, koordinator_reviewed_by,
      verification_status, verified_by_user_id, verified_at, rejection_reason, inspected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Approved laptop inspection with generated photo
  insertInsp.run(
    assetIdMap['AST-TMN-0001'],
    activePeriodId,
    adminId,
    'Ditemukan',
    'Baik',
    rSekretariat,
    'Rizka Aprilia',
    '/src/assets/images/sample_asset_laptop_1794898172404.jpg',
    'Label QR tertempel rapi di sudut chassis kanan bawah. Unit berfungsi normal.',
    null,
    null,
    'Disetujui',
    pengurusId,
    '2026-11-10 11:20:00',
    null,
    '2026-11-10 09:45:00'
  );

  // 2. Approved printer inspection with generated photo
  insertInsp.run(
    assetIdMap['AST-TMN-0002'],
    activePeriodId,
    petugasKecId,
    'Ditemukan',
    'Rusak ringan',
    rPelayananKec,
    'Siti Rahmawati, S.E.',
    '/src/assets/images/sample_asset_printer_1794898172845.jpg',
    'Baki kertas tray 2 sedikit macet saat penarikan dokumen. Sudah dibuatkan usulan servis.',
    null,
    null,
    'Disetujui',
    pengurusId,
    '2026-11-11 10:15:00',
    null,
    '2026-11-11 08:30:00'
  );

  // 3. Pending verification AC unit with generated photo (Rusak berat)
  insertInsp.run(
    assetIdMap['AST-TMN-0003'],
    activePeriodId,
    petugasKecId,
    'Ditemukan',
    'Rusak berat',
    rAulaKec,
    'Dimas Pratama, A.Md',
    '/src/assets/images/sample_asset_ac_unit_1794898173857.jpg',
    'Kompresor outdoor tidak menyala dan casing indoor berdebu tebal. Perlu pengecekan teknisi.',
    null,
    null,
    'Menunggu Verifikasi',
    null,
    null,
    null,
    '2026-11-14 14:10:00'
  );

  // 4. Approved Kecamatan vehicle
  insertInsp.run(
    assetIdMap['AST-TMN-0004'],
    activePeriodId,
    adminId,
    'Ditemukan',
    'Baik',
    rCamat,
    'H. Agus Prasetyo, S.STP, M.Si',
    null,
    'Nomor polisi W 1029 NP sesuai STNK, odometer 41.200 km.',
    null,
    null,
    'Disetujui',
    pengurusId,
    '2026-11-12 09:00:00',
    null,
    '2026-11-12 08:20:00'
  );

  // 5. Location discrepancy + waiting verification (Registered at Kecamatan Sekretariat, found at Kelurahan Taman!)
  insertInsp.run(
    assetIdMap['AST-TMN-0006'],
    activePeriodId,
    petugasKelTamanId,
    'Ditemukan',
    'Baik',
    kelIds['KEL-KLT'].rPelayanan,
    'Rizkhe',
    null,
    'Lemari arsip dipinjam sementara untuk penataan berkas Kelurahan Taman sejak September 2026.',
    'Sudah dicek fisik di Ruang Pelayanan Kelurahan Taman, memang digunakan untuk arsip PBB.',
    'Drs. Bambang Sutrisno',
    'Menunggu Verifikasi',
    null,
    null,
    null,
    '2026-11-15 10:05:00'
  );

  // 6. Strict Rule 2 demonstration: Asset marked "Tidak ditemukan" enters "Dalam verifikasi" / "Menunggu Verifikasi" queue — NEVER auto-deleted!
  insertInsp.run(
    assetIdMap['AST-TMN-0007'],
    activePeriodId,
    petugasKecId,
    'Dalam verifikasi',
    'Rusak ringan',
    rAulaKec,
    'Rizka Aprilia',
    null,
    'Proyektor tidak berada di lemari Aula Kecamatan saat penyisiran awal; informasi staf sedang dipinjam rapat luar.',
    null,
    null,
    'Menunggu Verifikasi',
    null,
    null,
    null,
    '2026-11-15 15:40:00'
  );

  // 7. Kelurahan Taman approved assets (Petugas: Rizkhe)
  insertInsp.run(
    assetIdMap['AST-KLT-0009'],
    activePeriodId,
    petugasKelTamanId,
    'Ditemukan',
    'Baik',
    kelIds['KEL-KLT'].rPelayanan,
    'Rizkhe',
    '/src/assets/images/sample_asset_laptop_1794898172404.jpg',
    'Digunakan setiap hari di loket SIAK/Kependudukan Kelurahan Taman.',
    'Diverifikasi awal oleh Koordinator Kelurahan Taman.',
    'Drs. Bambang Sutrisno',
    'Disetujui',
    pengurusId,
    '2026-11-12 16:00:00',
    null,
    '2026-11-12 13:30:00'
  );

  insertInsp.run(
    assetIdMap['AST-KLT-0010'],
    activePeriodId,
    petugasKelTamanId,
    'Ditemukan',
    'Baik',
    kelIds['KEL-KLT'].rPelayanan,
    'Rizkhe',
    null,
    'Printer aktif untuk cetak surat keterangan warga.',
    'Sesuai kondisi fisik.',
    'Drs. Bambang Sutrisno',
    'Menunggu Verifikasi',
    null,
    null,
    null,
    '2026-11-15 11:20:00'
  );

  // 8. Returned / Rejected inspection (needs photo re-upload)
  insertInsp.run(
    assetIdMap['AST-KLT-0012'],
    activePeriodId,
    petugasKelTamanId,
    'Ditemukan',
    'Rusak ringan',
    kelIds['KEL-KLT'].rLurah,
    'Rizkhe',
    null,
    'AC kurang dingin, perlu isi freon.',
    null,
    null,
    'Dikembalikan',
    pengurusId,
    '2026-11-14 16:30:00',
    'Mohon lampirkan foto bukti fisik unit AC dan tempelan stiker QR Code untuk validasi kondisi.',
    '2026-11-13 14:00:00'
  );

  // 9. Other kelurahans partial progress with assigned Petugas Sensus
  insertInsp.run(
    assetIdMap['AST-KLJ-0013'],
    activePeriodId,
    petugasKalijatenId,
    'Ditemukan',
    'Baik',
    kelIds['KEL-KLJ'].rPelayanan,
    'Aida',
    null,
    'Unit PC beroperasi normal di loket pelayanan Kalijaten.',
    null,
    null,
    'Disetujui',
    pengurusId,
    '2026-11-11 15:10:00',
    null,
    '2026-11-11 14:50:00'
  );
  insertInsp.run(
    assetIdMap['AST-GLR-0017'],
    activePeriodId,
    petugasGeluranId,
    'Ditemukan',
    'Baik',
    kelIds['KEL-GLR'].rPelayanan,
    'Yoga',
    null,
    'Mesin antrian layar sentuh berfungsi normal di Kelurahan Geluran.',
    null,
    null,
    'Disetujui',
    pengurusId,
    '2026-11-12 11:10:00',
    null,
    '2026-11-12 10:50:00'
  );
  insertInsp.run(
    assetIdMap['AST-BBK-0025'],
    activePeriodId,
    petugasBebekanId,
    'Ditemukan',
    'Baik',
    kelIds['KEL-BBK'].rPelayanan,
    'Riza',
    null,
    'Unit PC All-in-One terpasang di loket pelayanan Kelurahan Bebekan.',
    null,
    null,
    'Disetujui',
    pengurusId,
    '2026-11-13 10:15:00',
    null,
    '2026-11-13 09:50:00'
  );
  insertInsp.run(
    assetIdMap['AST-KTG-0020'],
    activePeriodId,
    petugasKeteganId,
    'Tidak ditemukan',
    'Rusak ringan',
    kelIds['KEL-KTG'].rPelayanan,
    'Mariana',
    null,
    'Unit AC dilaporkan sudah dibongkar saat renovasi plafon Oktober lalu, sedang ditelusuri Berita Acara Penyimpanan.',
    null,
    null,
    'Menunggu Verifikasi',
    null,
    null,
    null,
    '2026-11-16 09:20:00'
  );

  // Maintenance Tickets
  const insertTicket = db.prepare(`
    INSERT INTO maintenance_tickets (
      ticket_code, asset_id, reported_by_user_id, assigned_pic, issue_description,
      priority, target_date, status, resolution_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTicket.run(
    'MNT-2026-001',
    assetIdMap['AST-TMN-0002'],
    petugasKecId,
    'CV Mitra Teknika Sidoarjo',
    'Roller penarik kertas Tray 2 printer laser aus sehingga sering paper jam.',
    'Sedang',
    '2026-11-25',
    'Dalam Proses',
    'Suku cadang pickup roller sudah dipesan, jadwal teknisi 20 Nov 2026.',
    '2026-11-11 10:30:00',
    '2026-11-14 09:15:00'
  );
  insertTicket.run(
    'MNT-2026-002',
    assetIdMap['AST-TMN-0003'],
    petugasKecId,
    'Teknisi Pendingin Kec. Taman',
    'AC Split 2 PK Aula tidak dingin sama sekali dan kompresor outdoor tidak berputar.',
    'Tinggi',
    '2026-11-22',
    'Terbuka',
    null,
    '2026-11-14 14:25:00',
    '2026-11-14 14:25:00'
  );
  insertTicket.run(
    'MNT-2026-003',
    assetIdMap['AST-KLT-0012'],
    petugasKelTamanId,
    'Jasa Servis Sejuk Jaya',
    'Cuci berkala dan penambahan freon AC Split Ruang Lurah Taman.',
    'Rendah',
    '2026-11-30',
    'Selesai',
    'Pembersihan evaporator dan tambah tekanan freon selesai dilakukan. Suhu normal kembali.',
    '2026-11-05 09:00:00',
    '2026-11-08 15:20:00'
  );

  // Audit Logs
  const insertLog = db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, summary, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertLog.run(
    pengurusId,
    'IMPORT_KIB_B',
    'import_batch',
    String(batch1Id),
    'Import batch KIB_B_KEC_TAMAN_2026_Q3.xlsx (20 aset masuk)',
    JSON.stringify({ total_rows: 20, inserted: 20 }),
    '2026-10-02 09:15:00'
  );
  insertLog.run(
    pengurusId,
    'IMPORT_KIB_B',
    'import_batch',
    String(batch2Id),
    'Import batch KIB_B_8_KELURAHAN_TAMAN_2026.xlsx (16 aset masuk)',
    JSON.stringify({ total_rows: 16, inserted: 16 }),
    '2026-10-04 14:20:00'
  );
  insertLog.run(
    petugasKelTamanId,
    'SUBMIT_SENSUS',
    'asset',
    'AST-TMN-0006',
    'Terdeteksi selisih lokasi: Tercatat di Ruang Sekretariat Kecamatan, ditemukan di Ruang Pelayanan Kelurahan Taman.',
    JSON.stringify({ from_location: 'Ruang Sekretariat & Arsip', to_location: 'Ruang Pelayanan Kelurahan Taman' }),
    '2026-11-15 10:05:00'
  );
  insertLog.run(
    pengurusId,
    'REJECT_VERIFIKASI',
    'asset',
    'AST-KLT-0012',
    'Mengembalikan hasil sensus AST-KLT-0012 untuk dilengkapi foto bukti fisik.',
    JSON.stringify({ reason: 'Belum ada foto bukti fisik' }),
    '2026-11-14 16:30:00'
  );
  insertLog.run(
    adminId,
    'AKTIVASI_PERIODE',
    'census_period',
    String(activePeriodId),
    'Mengaktifkan periode Sensus KIB B Semester II Tahun 2026 oleh Rizka Aprilia.',
    JSON.stringify({ period_code: 'SENSUS-2026-S2' }),
    '2026-10-01 08:00:00'
  );
}

initSchema();
seedDatabaseIfEmpty();
