import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import type { Request, Response, NextFunction, Router } from 'express';
import { db, getDbPath, getUploadDir } from './db.ts';
import type { RoleCode, UserAccount } from '../types.ts';

interface AuthedRequest extends Request {
  currentUser?: UserAccount;
}

function loadUserWithRole(userId: number): UserAccount | null {
  const row = db
    .prepare(
      `
    SELECT u.id, u.name, u.employee_id, u.location_id, l.name as location_name, l.type as location_type,
           u.role_id, r.code as role_code, r.name as role_name, r.permissions_json, u.email, u.status
    FROM users u
    JOIN roles r ON r.id = u.role_id
    JOIN locations l ON l.id = u.location_id
    WHERE u.id = ?
  `
    )
    .get(userId) as
    | (Omit<UserAccount, 'permissions'> & { permissions_json: string })
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    employee_id: row.employee_id,
    location_id: row.location_id,
    location_name: row.location_name,
    location_type: row.location_type,
    role_id: row.role_id,
    role_code: row.role_code as RoleCode,
    role_name: row.role_name,
    permissions: JSON.parse(row.permissions_json),
    email: row.email,
    status: row.status,
  };
}

function getTopUnitLocation(locationId: number): { id: number; name: string; type: string } {
  const allLocs = db.prepare('SELECT id, name, type, parent_id FROM locations').all() as Array<{
    id: number;
    name: string;
    type: string;
    parent_id: number | null;
  }>;
  const byId = new Map(allLocs.map((l) => [l.id, l]));
  let curr = byId.get(locationId);
  if (!curr) return { id: locationId, name: 'Kecamatan Taman', type: 'Kecamatan' };
  if (curr.type === 'Ruang' && curr.parent_id) {
    const parent = byId.get(curr.parent_id);
    if (parent) return { id: parent.id, name: parent.name, type: parent.type };
  }
  return { id: curr.id, name: curr.name, type: curr.type };
}

function getAllowedLocationIds(user: UserAccount): number[] | null {
  if (
    user.role_code === 'ADMIN_SISTEM' ||
    user.role_code === 'PENGURUS_BARANG' ||
    user.role_code === 'PIMPINAN_VIEWER'
  ) {
    return null; // Full Kecamatan + 8 Kelurahan visibility
  }

  const allLocs = db.prepare('SELECT id, type, parent_id FROM locations').all() as Array<{
    id: number;
    type: string;
    parent_id: number | null;
  }>;

  if (user.role_code === 'PETUGAS_KECAMATAN') {
    const kec = allLocs.find((l) => l.type === 'Kecamatan');
    if (!kec) return [];
    // Kecamatan root + direct rooms under Kecamatan (not Kelurahan subtrees)
    return allLocs
      .filter((l) => l.id === kec.id || (l.type === 'Ruang' && l.parent_id === kec.id))
      .map((l) => l.id);
  }

  // PETUGAS_KELURAHAN or KOORDINATOR_KELURAHAN -> strictly their Kelurahan + its child rooms
  const unit = getTopUnitLocation(user.location_id);
  return allLocs
    .filter((l) => l.id === unit.id || l.parent_id === unit.id)
    .map((l) => l.id);
}

function logAudit(
  userId: number,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  details?: Record<string, unknown>
): void {
  db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, summary, details_json) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, action, entityType, entityId, summary, details ? JSON.stringify(details) : null);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = req.header('x-session-token');
  let user: UserAccount | null = null;

  if (token) {
    const session = db
      .prepare('SELECT user_id FROM sessions WHERE token = ?')
      .get(token) as { user_id: number } | undefined;
    if (session) {
      user = loadUserWithRole(session.user_id);
    }
  }

  if (!user) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
    return;
  }
  if (user.status !== 'Aktif') {
    res.status(403).json({ error: 'Akun dinonaktifkan oleh Admin Sistem.' });
    return;
  }

  req.currentUser = user;
  next();
}

function requirePermission(permission: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = req.currentUser;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!user.permissions.includes(permission)) {
      res.status(403).json({
        error: `Akses ditolak. Peran "${user.role_name}" tidak memiliki izin (${permission}).`,
      });
      return;
    }
    next();
  };
}

function enrichAssets(
  rows: Array<Record<string, unknown>>,
  activePeriodId: number | null
): Array<Record<string, unknown>> {
  const inspStmt = activePeriodId
    ? db.prepare(`
        SELECT ai.*, l.name as actual_location_name
        FROM asset_inspections ai
        JOIN locations l ON l.id = ai.actual_location_id
        WHERE ai.asset_id = ? AND ai.period_id = ?
        ORDER BY ai.id DESC LIMIT 1
      `)
    : db.prepare(`
        SELECT ai.*, l.name as actual_location_name
        FROM asset_inspections ai
        JOIN locations l ON l.id = ai.actual_location_id
        WHERE ai.asset_id = ?
        ORDER BY ai.id DESC LIMIT 1
      `);

  return rows.map((row) => {
    const unit = getTopUnitLocation(Number(row.recorded_location_id));
    const latest = activePeriodId
      ? (inspStmt.get(row.id, activePeriodId) as Record<string, unknown> | undefined)
      : (inspStmt.get(row.id) as Record<string, unknown> | undefined);

    let existenceStatus = 'Belum diperiksa';
    if (latest) {
      // Strict Rule 2: Unverified "Tidak ditemukan" appears as "Dalam verifikasi" until approved
      if (
        latest.existence_status === 'Tidak ditemukan' &&
        latest.verification_status === 'Menunggu Verifikasi'
      ) {
        existenceStatus = 'Dalam verifikasi';
      } else {
        existenceStatus = String(latest.existence_status);
      }
    }

    const hasDiscrepancy = Boolean(
      latest && Number(latest.actual_location_id) !== Number(row.recorded_location_id)
    );

    return {
      ...row,
      recorded_unit_name: unit.name,
      latest_inspection_id: latest ? latest.id : null,
      latest_existence_status: existenceStatus,
      latest_condition_status: latest ? latest.condition_status : null,
      latest_actual_location_id: latest ? latest.actual_location_id : null,
      latest_actual_location_name: latest ? latest.actual_location_name : null,
      latest_pic_name: latest ? latest.pic_name : null,
      latest_verification_status: latest ? latest.verification_status : null,
      latest_inspected_at: latest ? latest.inspected_at : null,
      has_location_discrepancy: hasDiscrepancy,
    };
  });
}

export function createApiRouter(): Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ASSET-IN' });
  });

  // --- AUTH & DEMO ROLE ACCOUNTS ---
  router.get('/auth/demo-accounts', (_req, res) => {
    const users = db
      .prepare(
        `
      SELECT u.id, u.name, u.employee_id, u.email, u.status,
             r.code as role_code, r.name as role_name, l.name as location_name, l.type as location_type
      FROM users u
      JOIN roles r ON r.id = u.role_id
      JOIN locations l ON l.id = u.location_id
      WHERE u.status = 'Aktif'
      ORDER BY r.id ASC, u.id ASC
    `
      )
      .all();
    res.json({ accounts: users });
  });

  router.post('/auth/login', (req, res) => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    if (!identifier || !password) {
      res.status(400).json({ error: 'Email/NIP dan kata sandi wajib diisi.' });
      return;
    }
    const row = db
      .prepare('SELECT id, password, status FROM users WHERE email = ? OR employee_id = ?')
      .get(identifier.trim(), identifier.trim()) as
      | { id: number; password: string; status: string }
      | undefined;

    if (!row || row.password !== password) {
      res.status(401).json({ error: 'Email/NIP atau kata sandi tidak sesuai.' });
      return;
    }
    if (row.status !== 'Aktif') {
      res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, row.id);
    const user = loadUserWithRole(row.id);
    res.json({ token, user });
  });

  router.post('/auth/demo-switch', (req, res) => {
    const { userId } = req.body as { userId?: number };
    const targetId = userId || 2; // Default Pengurus Barang Kecamatan
    const user = loadUserWithRole(targetId);
    if (!user || user.status !== 'Aktif') {
      res.status(404).json({ error: 'Akun demo tidak ditemukan atau tidak aktif.' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.json({ token, user });
  });

  router.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.currentUser });
  });

  router.post('/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    const token = req.header('x-session-token');
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.json({ ok: true });
  });

  // --- DASHBOARD ---
  router.get('/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const allowedIds = getAllowedLocationIds(user);
    const activePeriod = db
      .prepare("SELECT * FROM census_periods WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    const activePeriodId = activePeriod ? Number(activePeriod.id) : null;

    let rawAssets: Array<Record<string, unknown>>;
    if (allowedIds === null) {
      rawAssets = db
        .prepare(
          `SELECT a.*, l.name as recorded_location_name
           FROM assets a
           JOIN locations l ON l.id = a.recorded_location_id`
        )
        .all() as Array<Record<string, unknown>>;
    } else if (allowedIds.length === 0) {
      rawAssets = [];
    } else {
      const placeholders = allowedIds.map(() => '?').join(',');
      rawAssets = db
        .prepare(
          `SELECT a.*, l.name as recorded_location_name
           FROM assets a
           JOIN locations l ON l.id = a.recorded_location_id
           WHERE a.recorded_location_id IN (${placeholders})`
        )
        .all(...allowedIds) as Array<Record<string, unknown>>;
    }

    const enriched = enrichAssets(rawAssets, activePeriodId);

    const totalAssets = enriched.length;
    const inspectedAssets = enriched.filter((a) => a.latest_existence_status !== 'Belum diperiksa').length;
    const uninspectedAssets = totalAssets - inspectedAssets;
    const foundAssets = enriched.filter((a) => a.latest_existence_status === 'Ditemukan').length;
    const missingAssets = enriched.filter((a) => a.latest_existence_status === 'Tidak ditemukan').length;
    const inVerificationAssets = enriched.filter(
      (a) => a.latest_existence_status === 'Dalam verifikasi' || a.latest_verification_status === 'Menunggu Verifikasi'
    ).length;
    const damagedAssets = enriched.filter((a) => {
      const cond = String(a.latest_condition_status || a.recorded_condition);
      return cond === 'Rusak ringan' || cond === 'Rusak berat' || cond === 'Tidak layak pakai';
    }).length;
    const pendingVerificationQueue = enriched.filter(
      (a) => a.latest_verification_status === 'Menunggu Verifikasi'
    ).length;
    const locationDiscrepancyCount = enriched.filter((a) => Boolean(a.has_location_discrepancy)).length;
    const totalAcquisitionValue = enriched.reduce(
      (acc, a) => acc + Number(a.acquisition_value || 0),
      0
    );

    // Location progress across Kecamatan + 8 Kelurahan
    const allUnits = db
      .prepare("SELECT id, name, type FROM locations WHERE type IN ('Kecamatan', 'Kelurahan') ORDER BY id ASC")
      .all() as Array<{ id: number; name: string; type: 'Kecamatan' | 'Kelurahan' }>;

    const allLocs = db.prepare('SELECT id, type, parent_id FROM locations').all() as Array<{
      id: number;
      type: string;
      parent_id: number | null;
    }>;

    const locationProgress = allUnits
      .filter((u) => {
        if (allowedIds === null) return true;
        return allowedIds.includes(u.id);
      })
      .map((u) => {
        const unitLocIds =
          u.type === 'Kecamatan'
            ? allLocs.filter((l) => l.id === u.id || (l.type === 'Ruang' && l.parent_id === u.id)).map((l) => l.id)
            : allLocs.filter((l) => l.id === u.id || l.parent_id === u.id).map((l) => l.id);

        const unitAssets = enriched.filter((a) => unitLocIds.includes(Number(a.recorded_location_id)));
        const total = unitAssets.length;
        const inspected = unitAssets.filter((a) => a.latest_existence_status !== 'Belum diperiksa').length;
        const found = unitAssets.filter((a) => a.latest_existence_status === 'Ditemukan').length;
        const missing = unitAssets.filter((a) => a.latest_existence_status === 'Tidak ditemukan').length;
        const in_verification = unitAssets.filter(
          (a) => a.latest_existence_status === 'Dalam verifikasi' || a.latest_verification_status === 'Menunggu Verifikasi'
        ).length;
        const damaged = unitAssets.filter((a) => {
          const c = String(a.latest_condition_status || a.recorded_condition);
          return c !== 'Baik';
        }).length;

        return {
          location_id: u.id,
          name: u.type === 'Kecamatan' ? 'Kantor Kecamatan Taman' : u.name,
          type: u.type,
          total,
          inspected,
          found,
          missing,
          in_verification,
          damaged,
          progress_pct: total > 0 ? Math.round((inspected / total) * 100) : 0,
        };
      });

    // Condition breakdown (based on latest verified/inspected condition or fallback recorded_condition)
    const condMap: Record<string, number> = {
      Baik: 0,
      'Rusak ringan': 0,
      'Rusak berat': 0,
      'Tidak layak pakai': 0,
    };
    for (const a of enriched) {
      const cond = String(a.latest_condition_status || a.recorded_condition);
      condMap[cond] = (condMap[cond] || 0) + 1;
    }
    const conditionBreakdown = Object.entries(condMap).map(([condition, count]) => ({ condition, count }));

    // Exception Alerts
    const exceptionAlerts: Array<Record<string, unknown>> = [];
    for (const a of enriched) {
      if (a.latest_existence_status === 'Dalam verifikasi' || a.latest_existence_status === 'Tidak ditemukan') {
        exceptionAlerts.push({
          id: `missing-${a.id}`,
          severity: 'critical',
          category: 'Verifikasi Keberadaan',
          asset_id: a.id,
          asset_code: a.asset_id,
          asset_name: a.name,
          location_name: a.recorded_location_name,
          message: 'Aset dilaporkan belum ditemukan di lokasi tercatat — masuk antrean verifikasi manual.',
          timestamp: a.latest_inspected_at || a.created_at,
        });
      } else if (a.has_location_discrepancy) {
        exceptionAlerts.push({
          id: `disc-${a.id}`,
          severity: 'warning',
          category: 'Selisih Lokasi',
          asset_id: a.id,
          asset_code: a.asset_id,
          asset_name: a.name,
          location_name: String(a.latest_actual_location_name),
          message: `Tercatat di ${a.recorded_location_name}, ditemukan di ${a.latest_actual_location_name}.`,
          timestamp: a.latest_inspected_at || a.created_at,
        });
      } else if (
        a.latest_condition_status === 'Rusak berat' ||
        a.latest_condition_status === 'Tidak layak pakai'
      ) {
        exceptionAlerts.push({
          id: `dmg-${a.id}`,
          severity: 'warning',
          category: 'Kondisi Berat',
          asset_id: a.id,
          asset_code: a.asset_id,
          asset_name: a.name,
          location_name: String(a.latest_actual_location_name || a.recorded_location_name),
          message: `Dilaporkan ${a.latest_condition_status} — memerlukan peninjauan & tiket pemeliharaan.`,
          timestamp: a.latest_inspected_at || a.created_at,
        });
      } else if (a.latest_verification_status === 'Dikembalikan') {
        exceptionAlerts.push({
          id: `ret-${a.id}`,
          severity: 'info',
          category: 'Perlu Revisi Petugas',
          asset_id: a.id,
          asset_code: a.asset_id,
          asset_name: a.name,
          location_name: a.recorded_location_name,
          message: 'Hasil sensus dikembalikan oleh Pengurus Barang untuk dilengkapi bukti.',
          timestamp: a.latest_inspected_at || a.created_at,
        });
      }
    }

    const recentLogs = db
      .prepare(
        `
      SELECT al.*, u.name as user_name, r.name as role_name
      FROM audit_logs al
      JOIN users u ON u.id = al.user_id
      JOIN roles r ON r.id = u.role_id
      ORDER BY al.id DESC LIMIT 8
    `
      )
      .all();

    res.json({
      activePeriod: activePeriod || null,
      kpi: {
        totalAssets,
        inspectedAssets,
        uninspectedAssets,
        foundAssets,
        missingAssets,
        inVerificationAssets,
        damagedAssets,
        pendingVerificationQueue,
        locationDiscrepancyCount,
        totalAcquisitionValue,
      },
      locationProgress,
      conditionBreakdown,
      exceptionAlerts: exceptionAlerts.slice(0, 10),
      recentLogs,
    });
  });

  // --- MASTER KIB B ASSETS ---
  router.get('/assets', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const allowedIds = getAllowedLocationIds(user);
    const activePeriod = db
      .prepare("SELECT id FROM census_periods WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1")
      .get() as { id: number } | undefined;

    let rawAssets: Array<Record<string, unknown>>;
    if (allowedIds === null) {
      rawAssets = db
        .prepare(
          `SELECT a.*, l.name as recorded_location_name
           FROM assets a
           JOIN locations l ON l.id = a.recorded_location_id
           ORDER BY a.id ASC`
        )
        .all() as Array<Record<string, unknown>>;
    } else if (allowedIds.length === 0) {
      rawAssets = [];
    } else {
      const placeholders = allowedIds.map(() => '?').join(',');
      rawAssets = db
        .prepare(
          `SELECT a.*, l.name as recorded_location_name
           FROM assets a
           JOIN locations l ON l.id = a.recorded_location_id
           WHERE a.recorded_location_id IN (${placeholders})
           ORDER BY a.id ASC`
        )
        .all(...allowedIds) as Array<Record<string, unknown>>;
    }

    let enriched = enrichAssets(rawAssets, activePeriod ? activePeriod.id : null);

    const { search, category, condition, locationId, existence } = req.query as Record<string, string>;
    if (search) {
      const q = search.toLowerCase();
      enriched = enriched.filter(
        (a) =>
          String(a.asset_id).toLowerCase().includes(q) ||
          String(a.register_number).toLowerCase().includes(q) ||
          String(a.kib_code).toLowerCase().includes(q) ||
          String(a.name).toLowerCase().includes(q) ||
          String(a.brand).toLowerCase().includes(q) ||
          String(a.model).toLowerCase().includes(q)
      );
    }
    if (category && category !== 'ALL') {
      enriched = enriched.filter((a) => a.category === category);
    }
    if (condition && condition !== 'ALL') {
      enriched = enriched.filter((a) => a.recorded_condition === condition);
    }
    if (locationId && locationId !== 'ALL') {
      const targetLocId = Number(locationId);
      const allLocs = db.prepare('SELECT id, type, parent_id FROM locations').all() as Array<{
        id: number;
        type: string;
        parent_id: number | null;
      }>;
      const targetLoc = allLocs.find((l) => l.id === targetLocId);
      let matchIds = [targetLocId];
      if (targetLoc?.type === 'Kecamatan') {
        matchIds = allLocs
          .filter((l) => l.id === targetLocId || (l.type === 'Ruang' && l.parent_id === targetLocId))
          .map((l) => l.id);
      } else if (targetLoc?.type === 'Kelurahan') {
        matchIds = allLocs
          .filter((l) => l.id === targetLocId || l.parent_id === targetLocId)
          .map((l) => l.id);
      }
      enriched = enriched.filter((a) => matchIds.includes(Number(a.recorded_location_id)));
    }
    if (existence && existence !== 'ALL') {
      enriched = enriched.filter((a) => a.latest_existence_status === existence);
    }

    res.json({ assets: enriched });
  });

  router.get('/assets/by-qr/:query', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const allowedIds = getAllowedLocationIds(user);
    const q = req.params.query.trim();

    const raw = db
      .prepare(
        `SELECT a.*, l.name as recorded_location_name
         FROM assets a
         JOIN locations l ON l.id = a.recorded_location_id
         WHERE a.qr_token = ? OR UPPER(a.asset_id) = UPPER(?) OR UPPER(a.register_number) = UPPER(?)`
      )
      .get(q, q, q) as Record<string, unknown> | undefined;

    if (!raw) {
      res.status(404).json({ error: `Aset dengan kode atau QR "${q}" tidak ditemukan.` });
      return;
    }

    if (allowedIds !== null && !allowedIds.includes(Number(raw.recorded_location_id))) {
      res.status(403).json({
        error: `Akses wilayah ditolak: Aset ${raw.asset_id} tercatat di "${raw.recorded_location_name}" di luar wilayah tugas Anda (${user.location_name}).`,
      });
      return;
    }

    const activePeriod = db
      .prepare("SELECT id FROM census_periods WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1")
      .get() as { id: number } | undefined;
    const [asset] = enrichAssets([raw], activePeriod ? activePeriod.id : null);

    res.json({ asset });
  });

  router.get('/assets/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const allowedIds = getAllowedLocationIds(user);
    const id = Number(req.params.id);

    const raw = db
      .prepare(
        `SELECT a.*, l.name as recorded_location_name
         FROM assets a
         JOIN locations l ON l.id = a.recorded_location_id
         WHERE a.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!raw) {
      res.status(404).json({ error: 'Aset tidak ditemukan.' });
      return;
    }
    if (allowedIds !== null && !allowedIds.includes(Number(raw.recorded_location_id))) {
      res.status(403).json({ error: 'Aset berada di luar wilayah akses Anda.' });
      return;
    }

    const activePeriod = db
      .prepare("SELECT id FROM census_periods WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1")
      .get() as { id: number } | undefined;
    const [asset] = enrichAssets([raw], activePeriod ? activePeriod.id : null);

    const inspections = db
      .prepare(
        `SELECT ai.*, cp.name as period_name, u1.name as inspector_name,
                u2.name as verified_by_name, l.name as actual_location_name
         FROM asset_inspections ai
         JOIN census_periods cp ON cp.id = ai.period_id
         JOIN users u1 ON u1.id = ai.inspector_user_id
         LEFT JOIN users u2 ON u2.id = ai.verified_by_user_id
         JOIN locations l ON l.id = ai.actual_location_id
         WHERE ai.asset_id = ?
         ORDER BY ai.id DESC`
      )
      .all(id);

    const tickets = db
      .prepare(
        `SELECT mt.*, u.name as reported_by_name
         FROM maintenance_tickets mt
         JOIN users u ON u.id = mt.reported_by_user_id
         WHERE mt.asset_id = ?
         ORDER BY mt.id DESC`
      )
      .all(id);

    const logs = db
      .prepare(
        `SELECT al.*, u.name as user_name, r.name as role_name
         FROM audit_logs al
         JOIN users u ON u.id = al.user_id
         JOIN roles r ON r.id = u.role_id
         WHERE al.entity_type = 'asset' AND al.entity_id = ?
         ORDER BY al.id DESC`
      )
      .all(String(raw.asset_id));

    res.json({ asset, inspections, tickets, logs });
  });

  router.post(
    '/assets/qr-batch',
    requireAuth,
    requirePermission('qrcode:manage'),
    (req: AuthedRequest, res) => {
      const { assetIds } = req.body as { assetIds?: number[] };
      if (!Array.isArray(assetIds) || assetIds.length === 0) {
        res.status(400).json({ error: 'Pilih minimal satu aset untuk generate token QR.' });
        return;
      }

      const stmt = db.prepare('UPDATE assets SET qr_token = ? WHERE id = ?');
      const getStmt = db.prepare('SELECT id, asset_id FROM assets WHERE id = ?');
      const updated: Array<{ id: number; asset_id: string; qr_token: string }> = [];

      const tx = db.transaction(() => {
        for (const id of assetIds) {
          const row = getStmt.get(id) as { id: number; asset_id: string } | undefined;
          if (row) {
            const newToken = `QR-${row.asset_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
            stmt.run(newToken, row.id);
            updated.push({ id: row.id, asset_id: row.asset_id, qr_token: newToken });
          }
        }
      });
      tx();

      logAudit(
        req.currentUser!.id,
        'GENERATE_QR_TOKEN',
        'qr_batch',
        String(updated.length),
        `Generate/perbarui token QR unik untuk ${updated.length} aset KIB B.`,
        { asset_ids: updated.map((u) => u.asset_id) }
      );

      res.json({ updated });
    }
  );

  // --- IMPORT KIB B ---
  router.get('/import/batches', requireAuth, (req: AuthedRequest, res) => {
    const batches = db
      .prepare(
        `SELECT ib.*, u.name as imported_by_name
         FROM import_batches ib
         JOIN users u ON u.id = ib.imported_by_user_id
         ORDER BY ib.id DESC`
      )
      .all();
    res.json({ batches });
  });

  router.post(
    '/import/preview',
    requireAuth,
    requirePermission('import:execute'),
    (req: AuthedRequest, res) => {
      const { rows } = req.body as { rows?: Array<Record<string, unknown>> };
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: 'Tidak ada baris data yang dikirim untuk validasi.' });
        return;
      }

      const existingRegs = new Set(
        (db.prepare('SELECT register_number FROM assets').all() as Array<{ register_number: string }>).map(
          (r) => r.register_number.toUpperCase()
        )
      );
      const existingAssetIds = new Set(
        (db.prepare('SELECT asset_id FROM assets').all() as Array<{ asset_id: string }>).map((r) =>
          r.asset_id.toUpperCase()
        )
      );
      const locations = db.prepare('SELECT id, name, code FROM locations').all() as Array<{
        id: number;
        name: string;
        code: string;
      }>;

      const seenInBatch = new Set<string>();
      const validated = rows.map((row, idx) => {
        const errors: string[] = [];
        const kibCode = String(row.kib_code || '').trim();
        const registerNumber = String(row.register_number || '').trim();
        const name = String(row.name || '').trim();
        const locRaw = String(row.location_name || '').trim();
        const assetIdRaw = String(row.asset_id || `AST-IMP-${String(Date.now()).slice(-4)}-${idx + 1}`).trim();

        if (!kibCode) errors.push('Kode Barang (KIB) kosong');
        if (!registerNumber) errors.push('Nomor Register kosong');
        if (!name) errors.push('Nama Barang kosong');

        let isDuplicate = false;
        if (registerNumber && existingRegs.has(registerNumber.toUpperCase())) {
          isDuplicate = true;
          errors.push(`Nomor Register ${registerNumber} sudah ada di Master KIB B`);
        }
        if (seenInBatch.has(registerNumber.toUpperCase())) {
          isDuplicate = true;
          errors.push(`Duplikasi Nomor Register ${registerNumber} di dalam file`);
        }
        if (existingAssetIds.has(assetIdRaw.toUpperCase())) {
          isDuplicate = true;
          errors.push(`Asset ID ${assetIdRaw} sudah terdaftar`);
        }
        if (registerNumber) seenInBatch.add(registerNumber.toUpperCase());

        const matchedLoc =
          locations.find(
            (l) =>
              l.name.toLowerCase() === locRaw.toLowerCase() ||
              l.code.toLowerCase() === locRaw.toLowerCase() ||
              l.name.toLowerCase().includes(locRaw.toLowerCase())
          ) || locations[0];

        return {
          rowIndex: idx + 1,
          asset_id: assetIdRaw,
          kib_code: kibCode,
          register_number: registerNumber,
          name,
          category: String(row.category || 'Peralatan Kantor').trim(),
          brand: String(row.brand || '-').trim(),
          model: String(row.model || '-').trim(),
          serial_number: String(row.serial_number || '-').trim(),
          acquisition_year: Number(row.acquisition_year) || 2024,
          acquisition_value: Number(String(row.acquisition_value || '0').replace(/[^0-9.-]/g, '')) || 0,
          recorded_condition: ['Baik', 'Rusak ringan', 'Rusak berat', 'Tidak layak pakai'].includes(
            String(row.recorded_condition || '').trim()
          )
            ? String(row.recorded_condition).trim()
            : 'Baik',
          recorded_location_id: matchedLoc.id,
          recorded_location_name: matchedLoc.name,
          isDuplicate,
          isValid: errors.length === 0,
          errors,
        };
      });

      res.json({
        summary: {
          total: validated.length,
          valid: validated.filter((v) => v.isValid).length,
          duplicates: validated.filter((v) => v.isDuplicate).length,
          errors: validated.filter((v) => !v.isValid && !v.isDuplicate).length,
        },
        rows: validated,
      });
    }
  );

  router.post(
    '/import/commit',
    requireAuth,
    requirePermission('import:execute'),
    (req: AuthedRequest, res) => {
      const { filename, columnMapping, rows, notes } = req.body as {
        filename: string;
        columnMapping: Record<string, string>;
        rows: Array<{
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
          isValid: boolean;
          isDuplicate: boolean;
        }>;
        notes?: string;
      };

      if (!filename || !Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: 'Data batch import tidak valid.' });
        return;
      }

      const validRows = rows.filter((r) => r.isValid && !r.isDuplicate);
      const dupCount = rows.filter((r) => r.isDuplicate).length;
      const errCount = rows.filter((r) => !r.isValid && !r.isDuplicate).length;

      const batchStmt = db.prepare(`
        INSERT INTO import_batches (
          filename, imported_by_user_id, total_rows, inserted_rows,
          duplicate_rows, error_rows, column_mapping_json, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const assetStmt = db.prepare(`
        INSERT INTO assets (
          asset_id, kib_code, register_number, name, category, brand, model,
          serial_number, acquisition_year, acquisition_value, recorded_condition,
          recorded_location_id, official_status, qr_token, import_batch_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Tercatat KIB B', ?, ?)
      `);

      let batchId = 0;
      const tx = db.transaction(() => {
        batchId = Number(
          batchStmt.run(
            filename,
            req.currentUser!.id,
            rows.length,
            validRows.length,
            dupCount,
            errCount,
            JSON.stringify(columnMapping || {}),
            validRows.length > 0 ? 'Selesai' : 'Dilewati (Tidak ada baris valid)',
            notes || null
          ).lastInsertRowid
        );

        for (const r of validRows) {
          const qrToken = `QR-${r.asset_id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
          assetStmt.run(
            r.asset_id,
            r.kib_code,
            r.register_number,
            r.name,
            r.category,
            r.brand,
            r.model,
            r.serial_number,
            r.acquisition_year,
            r.acquisition_value,
            r.recorded_condition,
            r.recorded_location_id,
            qrToken,
            batchId
          );
        }
      });
      tx();

      logAudit(
        req.currentUser!.id,
        'IMPORT_KIB_B',
        'import_batch',
        String(batchId),
        `Import KIB B "${filename}": ${validRows.length} aset ditambahkan, ${dupCount} duplikat dilewati, ${errCount} error.`,
        { filename, inserted: validRows.length, duplicates: dupCount, errors: errCount }
      );

      res.json({ batchId, inserted: validRows.length, duplicates: dupCount, errors: errCount });
    }
  );

  // --- INSPECTIONS / SENSUS & VERIFIKASI ---
  router.get('/inspections', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const allowedIds = getAllowedLocationIds(user);
    const { status } = req.query as { status?: string };

    let sql = `
      SELECT ai.*, a.asset_id as asset_code, a.name as asset_name, a.kib_code,
             a.register_number, a.recorded_location_id, a.recorded_condition,
             rl.name as recorded_location_name, al.name as actual_location_name,
             cp.name as period_name, u1.name as inspector_name, u2.name as verified_by_name
      FROM asset_inspections ai
      JOIN assets a ON a.id = ai.asset_id
      JOIN locations rl ON rl.id = a.recorded_location_id
      JOIN locations al ON al.id = ai.actual_location_id
      JOIN census_periods cp ON cp.id = ai.period_id
      JOIN users u1 ON u1.id = ai.inspector_user_id
      LEFT JOIN users u2 ON u2.id = ai.verified_by_user_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (allowedIds !== null) {
      if (allowedIds.length === 0) {
        res.json({ inspections: [] });
        return;
      }
      conditions.push(`a.recorded_location_id IN (${allowedIds.map(() => '?').join(',')})`);
      params.push(...allowedIds);
    }

    if (status && status !== 'ALL') {
      conditions.push('ai.verification_status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY ai.id DESC';

    const rows = db.prepare(sql).all(...params);
    res.json({ inspections: rows });
  });

  router.post(
    '/inspections',
    requireAuth,
    requirePermission('census:submit'),
    (req: AuthedRequest, res) => {
      const user = req.currentUser!;
      const allowedIds = getAllowedLocationIds(user);
      const {
        asset_id,
        existence_status,
        condition_status,
        actual_location_id,
        pic_name,
        photo_url,
        notes,
      } = req.body as {
        asset_id: number;
        existence_status: string;
        condition_status: string;
        actual_location_id: number;
        pic_name: string;
        photo_url?: string | null;
        notes?: string | null;
      };

      if (!asset_id || !existence_status || !condition_status || !actual_location_id || !pic_name) {
        res.status(400).json({ error: 'Seluruh kolom wajib sensus fisik harus diisi.' });
        return;
      }

      const asset = db
        .prepare('SELECT id, asset_id, name, recorded_location_id FROM assets WHERE id = ?')
        .get(asset_id) as
        | { id: number; asset_id: string; name: string; recorded_location_id: number }
        | undefined;

      if (!asset) {
        res.status(404).json({ error: 'Aset tidak ditemukan.' });
        return;
      }
      if (allowedIds !== null && !allowedIds.includes(asset.recorded_location_id)) {
        res.status(403).json({
          error: 'Anda tidak memiliki izin memeriksa aset di luar wilayah kelurahan/unit Anda.',
        });
        return;
      }

      const activePeriod = db
        .prepare("SELECT id FROM census_periods WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1")
        .get() as { id: number } | undefined;

      if (!activePeriod) {
        res.status(400).json({ error: 'Tidak ada periode sensus yang sedang aktif.' });
        return;
      }

      // Strict Rule 2: "Tidak ditemukan" always routes through "Dalam verifikasi" / manual approval queue
      const normalizedExistence =
        existence_status === 'Tidak ditemukan' ? 'Dalam verifikasi' : existence_status;

      const result = db
        .prepare(
          `INSERT INTO asset_inspections (
            asset_id, period_id, inspector_user_id, existence_status, condition_status,
            actual_location_id, pic_name, photo_url, notes, verification_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu Verifikasi')`
        )
        .run(
          asset.id,
          activePeriod.id,
          user.id,
          normalizedExistence,
          condition_status,
          actual_location_id,
          pic_name.trim(),
          photo_url || null,
          notes || null
        );

      logAudit(
        user.id,
        'SUBMIT_SENSUS',
        'asset',
        asset.asset_id,
        `Input sensus fisik ${asset.asset_id} (${asset.name}): Keberadaan="${existence_status}", Kondisi="${condition_status}". Menunggu verifikasi Pengurus Barang.`,
        { existence_status, condition_status, actual_location_id, pic_name }
      );

      res.json({ id: Number(result.lastInsertRowid), verification_status: 'Menunggu Verifikasi' });
    }
  );

  router.patch(
    '/inspections/:id/koordinator-review',
    requireAuth,
    requirePermission('verification:koordinator_review'),
    (req: AuthedRequest, res) => {
      const user = req.currentUser!;
      const allowedIds = getAllowedLocationIds(user);
      const id = Number(req.params.id);
      const { koordinator_note } = req.body as { koordinator_note?: string };

      if (!koordinator_note?.trim()) {
        res.status(400).json({ error: 'Catatan review awal koordinator wajib diisi.' });
        return;
      }

      const insp = db
        .prepare(
          `SELECT ai.id, a.asset_id, a.recorded_location_id
           FROM asset_inspections ai
           JOIN assets a ON a.id = ai.asset_id
           WHERE ai.id = ?`
        )
        .get(id) as { id: number; asset_id: string; recorded_location_id: number } | undefined;

      if (!insp) {
        res.status(404).json({ error: 'Data inspeksi tidak ditemukan.' });
        return;
      }
      if (allowedIds !== null && !allowedIds.includes(insp.recorded_location_id)) {
        res.status(403).json({ error: 'Inspeksi berada di luar wilayah kelurahan Anda.' });
        return;
      }

      db.prepare(
        'UPDATE asset_inspections SET koordinator_note = ?, koordinator_reviewed_by = ? WHERE id = ?'
      ).run(koordinator_note.trim(), user.name, id);

      logAudit(
        user.id,
        'REVIEW_KOORDINATOR',
        'asset',
        insp.asset_id,
        `Review awal Koordinator Kelurahan untuk ${insp.asset_id}: "${koordinator_note.trim()}"`
      );

      res.json({ ok: true });
    }
  );

  router.patch(
    '/inspections/:id/verify',
    requireAuth,
    requirePermission('verification:approve'),
    (req: AuthedRequest, res) => {
      const user = req.currentUser!;
      const id = Number(req.params.id);
      const { decision, rejection_reason, confirm_missing } = req.body as {
        decision: 'Disetujui' | 'Dikembalikan';
        rejection_reason?: string;
        confirm_missing?: boolean;
      };

      if (decision !== 'Disetujui' && decision !== 'Dikembalikan') {
        res.status(400).json({ error: 'Keputusan verifikasi tidak valid.' });
        return;
      }
      if (decision === 'Dikembalikan' && !rejection_reason?.trim()) {
        res.status(400).json({ error: 'Alasan pengembalian wajib diisi saat menolak hasil sensus.' });
        return;
      }

      const insp = db
        .prepare(
          `SELECT ai.*, a.asset_id as asset_code, a.name as asset_name
           FROM asset_inspections ai
           JOIN assets a ON a.id = ai.asset_id
           WHERE ai.id = ?`
        )
        .get(id) as Record<string, unknown> | undefined;

      if (!insp) {
        res.status(404).json({ error: 'Data inspeksi tidak ditemukan.' });
        return;
      }

      // Strict Rule 2: If approved and it was in 'Dalam verifikasi' due to missing report,
      // only transition to 'Tidak ditemukan' if Pengurus Barang explicitly confirms manual missing verification
      let finalExistence = String(insp.existence_status);
      if (decision === 'Disetujui' && finalExistence === 'Dalam verifikasi' && confirm_missing) {
        finalExistence = 'Tidak ditemukan';
      }

      db.prepare(
        `UPDATE asset_inspections
         SET existence_status = ?, verification_status = ?, verified_by_user_id = ?,
             verified_at = datetime('now', 'localtime'), rejection_reason = ?
         WHERE id = ?`
      ).run(
        finalExistence,
        decision,
        user.id,
        decision === 'Dikembalikan' ? rejection_reason!.trim() : null,
        id
      );

      // Notice Strict Rule 1: Official KIB B record (assets table) is NEVER modified upon approval!
      logAudit(
        user.id,
        decision === 'Disetujui' ? 'APPROVE_VERIFIKASI' : 'REJECT_VERIFIKASI',
        'asset',
        String(insp.asset_code),
        decision === 'Disetujui'
          ? `Menyetujui hasil sensus ${insp.asset_code} (${insp.asset_name}) — Keberadaan: ${finalExistence}, Kondisi: ${insp.condition_status}. Data resmi KIB B tetap terjaga.`
          : `Mengembalikan hasil sensus ${insp.asset_code}: ${rejection_reason!.trim()}`,
        { decision, finalExistence, rejection_reason }
      );

      res.json({ ok: true, verification_status: decision, existence_status: finalExistence });
    }
  );

  // --- MONITORING & RIWAYAT ---
  router.get('/monitoring', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const allowedIds = getAllowedLocationIds(user);

    const activePeriod = db
      .prepare("SELECT id FROM census_periods WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1")
      .get() as { id: number } | undefined;

    let sql = `
      SELECT ai.*, a.asset_id as asset_code, a.name as asset_name, a.kib_code,
             a.register_number, a.recorded_location_id, a.recorded_condition,
             rl.name as recorded_location_name, al.name as actual_location_name,
             cp.name as period_name, u1.name as inspector_name, u2.name as verified_by_name
      FROM asset_inspections ai
      JOIN assets a ON a.id = ai.asset_id
      JOIN locations rl ON rl.id = a.recorded_location_id
      JOIN locations al ON al.id = ai.actual_location_id
      JOIN census_periods cp ON cp.id = ai.period_id
      JOIN users u1 ON u1.id = ai.inspector_user_id
      LEFT JOIN users u2 ON u2.id = ai.verified_by_user_id
    `;
    const params: unknown[] = [];
    if (allowedIds !== null) {
      if (allowedIds.length === 0) {
        res.json({ locationDiscrepancies: [], conditionChanges: [], auditLogs: [] });
        return;
      }
      sql += ` WHERE a.recorded_location_id IN (${allowedIds.map(() => '?').join(',')})`;
      params.push(...allowedIds);
    }
    sql += ' ORDER BY ai.id DESC';

    const allInspections = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    const locationDiscrepancies = allInspections.filter(
      (i) => Number(i.actual_location_id) !== Number(i.recorded_location_id)
    );
    const conditionChanges = allInspections.filter(
      (i) => String(i.condition_status) !== String(i.recorded_condition)
    );

    const auditLogs = db
      .prepare(
        `SELECT al.*, u.name as user_name, r.name as role_name
         FROM audit_logs al
         JOIN users u ON u.id = al.user_id
         JOIN roles r ON r.id = u.role_id
         ORDER BY al.id DESC LIMIT 100`
      )
      .all();

    res.json({
      activePeriodId: activePeriod?.id || null,
      locationDiscrepancies,
      conditionChanges,
      auditLogs,
    });
  });

  // --- MAINTENANCE TICKETS ---
  router.get('/maintenance', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const allowedIds = getAllowedLocationIds(user);

    let sql = `
      SELECT mt.*, a.asset_id as asset_code, a.name as asset_name, l.name as location_name,
             u.name as reported_by_name
      FROM maintenance_tickets mt
      JOIN assets a ON a.id = mt.asset_id
      JOIN locations l ON l.id = a.recorded_location_id
      JOIN users u ON u.id = mt.reported_by_user_id
    `;
    const params: unknown[] = [];
    if (allowedIds !== null) {
      if (allowedIds.length === 0) {
        res.json({ tickets: [] });
        return;
      }
      sql += ` WHERE a.recorded_location_id IN (${allowedIds.map(() => '?').join(',')})`;
      params.push(...allowedIds);
    }
    sql += ' ORDER BY mt.id DESC';

    const tickets = db.prepare(sql).all(...params);
    res.json({ tickets });
  });

  router.post(
    '/maintenance',
    requireAuth,
    (req: AuthedRequest, res) => {
      const user = req.currentUser!;
      if (
        !user.permissions.includes('maintenance:manage') &&
        !user.permissions.includes('maintenance:report')
      ) {
        res.status(403).json({ error: 'Anda tidak memiliki izin membuat tiket pemeliharaan.' });
        return;
      }

      const { asset_id, assigned_pic, issue_description, priority, target_date } = req.body as {
        asset_id: number;
        assigned_pic: string;
        issue_description: string;
        priority: string;
        target_date: string;
      };

      if (!asset_id || !issue_description?.trim()) {
        res.status(400).json({ error: 'Aset dan deskripsi kerusakan wajib diisi.' });
        return;
      }

      const asset = db
        .prepare('SELECT id, asset_id, name, recorded_location_id FROM assets WHERE id = ?')
        .get(asset_id) as { id: number; asset_id: string; name: string; recorded_location_id: number } | undefined;

      if (!asset) {
        res.status(404).json({ error: 'Aset tidak ditemukan.' });
        return;
      }

      const allowedIds = getAllowedLocationIds(user);
      if (allowedIds !== null && !allowedIds.includes(asset.recorded_location_id)) {
        res.status(403).json({ error: 'Aset di luar wilayah tugas Anda.' });
        return;
      }

      const countRow = db.prepare('SELECT COUNT(*) as c FROM maintenance_tickets').get() as { c: number };
      const ticketCode = `MNT-2026-${String(countRow.c + 1).padStart(3, '0')}`;

      const result = db
        .prepare(
          `INSERT INTO maintenance_tickets (
            ticket_code, asset_id, reported_by_user_id, assigned_pic,
            issue_description, priority, target_date, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Terbuka')`
        )
        .run(
          ticketCode,
          asset.id,
          user.id,
          assigned_pic?.trim() || 'Teknisi Kecamatan Taman',
          issue_description.trim(),
          priority || 'Sedang',
          target_date || '2026-12-05'
        );

      logAudit(
        user.id,
        'BUAT_TIKET_PEMELIHARAAN',
        'asset',
        asset.asset_id,
        `Membuat tiket pemeliharaan ${ticketCode} untuk ${asset.asset_id} (${asset.name}).`
      );

      res.json({ id: Number(result.lastInsertRowid), ticket_code: ticketCode });
    }
  );

  router.patch(
    '/maintenance/:id',
    requireAuth,
    requirePermission('maintenance:manage'),
    (req: AuthedRequest, res) => {
      const id = Number(req.params.id);
      const { status, assigned_pic, resolution_notes, target_date, repair_photo_url } = req.body as {
        status?: string;
        assigned_pic?: string;
        resolution_notes?: string;
        target_date?: string;
        repair_photo_url?: string;
      };

      const existing = db.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(id) as
        | Record<string, unknown>
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Tiket tidak ditemukan.' });
        return;
      }

      db.prepare(
        `UPDATE maintenance_tickets
         SET status = ?, assigned_pic = ?, resolution_notes = ?, target_date = ?,
             repair_photo_url = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      ).run(
        status || existing.status,
        assigned_pic ?? existing.assigned_pic,
        resolution_notes ?? existing.resolution_notes,
        target_date ?? existing.target_date,
        repair_photo_url ?? existing.repair_photo_url,
        id
      );

      logAudit(
        req.currentUser!.id,
        'UPDATE_TIKET_PEMELIHARAAN',
        'maintenance_ticket',
        String(existing.ticket_code),
        `Memperbarui tiket ${existing.ticket_code} menjadi status "${status || existing.status}".`
      );

      res.json({ ok: true });
    }
  );

  // --- LOCATIONS & USERS ---
  router.get('/locations', requireAuth, (_req, res) => {
    const locations = db
      .prepare(
        `SELECT l.*, p.name as parent_name
         FROM locations l
         LEFT JOIN locations p ON p.id = l.parent_id
         ORDER BY l.id ASC`
      )
      .all();
    res.json({ locations });
  });

  router.post(
    '/locations',
    requireAuth,
    requirePermission('locations:manage'),
    (req: AuthedRequest, res) => {
      const { code, name, type, parent_id } = req.body as {
        code: string;
        name: string;
        type: string;
        parent_id: number | null;
      };
      if (!code?.trim() || !name?.trim() || !type) {
        res.status(400).json({ error: 'Kode, nama, dan tipe lokasi wajib diisi.' });
        return;
      }
      try {
        const result = db
          .prepare('INSERT INTO locations (code, name, type, parent_id) VALUES (?, ?, ?, ?)')
          .run(code.trim().toUpperCase(), name.trim(), type, parent_id || null);

        logAudit(
          req.currentUser!.id,
          'TAMBAH_LOKASI',
          'location',
          code.trim().toUpperCase(),
          `Menambahkan lokasi baru "${name.trim()}" (${type}).`
        );
        res.json({ id: Number(result.lastInsertRowid) });
      } catch (err) {
        res.status(400).json({ error: 'Kode lokasi sudah digunakan atau tidak valid.' });
      }
    }
  );

  router.get('/roles', requireAuth, (_req, res) => {
    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all() as Array<
      Record<string, unknown>
    >;
    res.json({
      roles: roles.map((r) => ({
        ...r,
        permissions: JSON.parse(String(r.permissions_json)),
      })),
    });
  });

  router.get('/users', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (!user.permissions.includes('users:manage') && !user.permissions.includes('dashboard:view')) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    const users = db
      .prepare(
        `SELECT u.id, u.name, u.employee_id, u.location_id, l.name as location_name, l.type as location_type,
                u.role_id, r.code as role_code, r.name as role_name, u.email, u.status
         FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN locations l ON l.id = u.location_id
         ORDER BY u.id ASC`
      )
      .all();
    res.json({ users });
  });

  router.post(
    '/users',
    requireAuth,
    requirePermission('users:manage'),
    (req: AuthedRequest, res) => {
      const { name, employee_id, location_id, role_id, email, password } = req.body as {
        name: string;
        employee_id: string;
        location_id: number;
        role_id: number;
        email: string;
        password?: string;
      };
      if (!name?.trim() || !employee_id?.trim() || !location_id || !role_id || !email?.trim()) {
        res.status(400).json({ error: 'Semua data petugas wajib diisi.' });
        return;
      }
      try {
        const result = db
          .prepare(
            `INSERT INTO users (name, employee_id, location_id, role_id, email, password, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Aktif')`
          )
          .run(
            name.trim(),
            employee_id.trim(),
            location_id,
            role_id,
            email.trim().toLowerCase(),
            password || 'assetin2026'
          );

        logAudit(
          req.currentUser!.id,
          'TAMBAH_PENGGUNA',
          'user',
          employee_id.trim(),
          `Menambahkan akun petugas "${name.trim()}" (${email.trim()}).`
        );
        res.json({ id: Number(result.lastInsertRowid) });
      } catch {
        res.status(400).json({ error: 'NIP atau Email sudah terdaftar pada sistem.' });
      }
    }
  );

  router.patch(
    '/users/:id',
    requireAuth,
    requirePermission('users:manage'),
    (req: AuthedRequest, res) => {
      const id = Number(req.params.id);
      const { status, role_id, location_id } = req.body as {
        status?: string;
        role_id?: number;
        location_id?: number;
      };
      const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
        | Record<string, unknown>
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
        return;
      }

      db.prepare('UPDATE users SET status = ?, role_id = ?, location_id = ? WHERE id = ?').run(
        status || existing.status,
        role_id || existing.role_id,
        location_id || existing.location_id,
        id
      );

      logAudit(
        req.currentUser!.id,
        'UBAH_PENGGUNA',
        'user',
        String(existing.employee_id),
        `Memperbarui peran/status akun ${existing.name}.`
      );
      res.json({ ok: true });
    }
  );

  // --- REPORTS ---
  router.get(
    '/reports/summary',
    requireAuth,
    requirePermission('reports:export'),
    (req: AuthedRequest, res) => {
      const user = req.currentUser!;
      const allowedIds = getAllowedLocationIds(user);
      const { periodId, locationId, condition } = req.query as Record<string, string>;

      const targetPeriod = periodId
        ? Number(periodId)
        : (
            db
              .prepare("SELECT id FROM census_periods WHERE status = 'Aktif' ORDER BY id DESC LIMIT 1")
              .get() as { id: number } | undefined
          )?.id || null;

      let rawAssets: Array<Record<string, unknown>>;
      if (allowedIds === null) {
        rawAssets = db
          .prepare(
            `SELECT a.*, l.name as recorded_location_name
             FROM assets a JOIN locations l ON l.id = a.recorded_location_id
             ORDER BY a.id ASC`
          )
          .all() as Array<Record<string, unknown>>;
      } else {
        rawAssets = db
          .prepare(
            `SELECT a.*, l.name as recorded_location_name
             FROM assets a JOIN locations l ON l.id = a.recorded_location_id
             WHERE a.recorded_location_id IN (${allowedIds.map(() => '?').join(',')})
             ORDER BY a.id ASC`
          )
          .all(...allowedIds) as Array<Record<string, unknown>>;
      }

      let enriched = enrichAssets(rawAssets, targetPeriod);
      if (locationId && locationId !== 'ALL') {
        const targetLocId = Number(locationId);
        const allLocs = db.prepare('SELECT id, type, parent_id FROM locations').all() as Array<{
          id: number;
          type: string;
          parent_id: number | null;
        }>;
        const targetLoc = allLocs.find((l) => l.id === targetLocId);
        let matchIds = [targetLocId];
        if (targetLoc?.type === 'Kecamatan') {
          matchIds = allLocs
            .filter((l) => l.id === targetLocId || (l.type === 'Ruang' && l.parent_id === targetLocId))
            .map((l) => l.id);
        } else if (targetLoc?.type === 'Kelurahan') {
          matchIds = allLocs
            .filter((l) => l.id === targetLocId || l.parent_id === targetLocId)
            .map((l) => l.id);
        }
        enriched = enriched.filter((a) => matchIds.includes(Number(a.recorded_location_id)));
      }
      if (condition && condition !== 'ALL') {
        enriched = enriched.filter(
          (a) => String(a.latest_condition_status || a.recorded_condition) === condition
        );
      }

      const periods = db.prepare('SELECT * FROM census_periods ORDER BY id DESC').all();
      res.json({ rows: enriched, periods });
    }
  );

  // --- SETTINGS & DATABASE BACKUP ---
  router.get('/settings', requireAuth, (req: AuthedRequest, res) => {
    const periods = db.prepare('SELECT * FROM census_periods ORDER BY id DESC').all();
    const auditLogs = db
      .prepare(
        `SELECT al.*, u.name as user_name, r.name as role_name
         FROM audit_logs al
         JOIN users u ON u.id = al.user_id
         JOIN roles r ON r.id = u.role_id
         ORDER BY al.id DESC LIMIT 50`
      )
      .all();

    let dbSizeBytes = 0;
    try {
      dbSizeBytes = fs.statSync(getDbPath()).size;
    } catch {
      dbSizeBytes = 0;
    }

    res.json({ periods, auditLogs, dbSizeBytes });
  });

  router.post(
    '/settings/periods',
    requireAuth,
    (req: AuthedRequest, res) => {
      const user = req.currentUser!;
      if (!user.permissions.includes('settings:manage') && !user.permissions.includes('settings:periods')) {
        res.status(403).json({ error: 'Akses ditolak.' });
        return;
      }

      const { code, name, year, start_date, end_date, notes, activate } = req.body as {
        code: string;
        name: string;
        year: number;
        start_date: string;
        end_date: string;
        notes?: string;
        activate?: boolean;
      };
      if (!code?.trim() || !name?.trim() || !start_date || !end_date) {
        res.status(400).json({ error: 'Kode, nama, dan rentang tanggal periode wajib diisi.' });
        return;
      }

      const tx = db.transaction(() => {
        if (activate) {
          db.prepare("UPDATE census_periods SET status = 'Ditutup' WHERE status = 'Aktif'").run();
        }
        const r = db
          .prepare(
            `INSERT INTO census_periods (code, name, year, start_date, end_date, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            code.trim().toUpperCase(),
            name.trim(),
            year || 2026,
            start_date,
            end_date,
            activate ? 'Aktif' : 'Draft',
            notes || null
          );
        return Number(r.lastInsertRowid);
      });

      const id = tx();
      logAudit(
        user.id,
        'BUAT_PERIODE_SENSUS',
        'census_period',
        String(id),
        `Membuat periode sensus "${name.trim()}" (${activate ? 'Aktif' : 'Draft'}).`
      );
      res.json({ id });
    }
  );

  router.patch(
    '/settings/periods/:id',
    requireAuth,
    (req: AuthedRequest, res) => {
      const user = req.currentUser!;
      if (!user.permissions.includes('settings:manage') && !user.permissions.includes('settings:periods')) {
        res.status(403).json({ error: 'Akses ditolak.' });
        return;
      }
      const id = Number(req.params.id);
      const { status } = req.body as { status: 'Aktif' | 'Ditutup' | 'Draft' };
      const tx = db.transaction(() => {
        if (status === 'Aktif') {
          db.prepare("UPDATE census_periods SET status = 'Ditutup' WHERE status = 'Aktif'").run();
        }
        db.prepare('UPDATE census_periods SET status = ? WHERE id = ?').run(status, id);
      });
      tx();

      logAudit(
        user.id,
        'UBAH_STATUS_PERIODE',
        'census_period',
        String(id),
        `Mengubah status periode sensus #${id} menjadi "${status}".`
      );
      res.json({ ok: true });
    }
  );

  router.get(
    '/settings/backup',
    requireAuth,
    requirePermission('settings:manage'),
    (req: AuthedRequest, res) => {
      const snapshot = {
        exported_at: new Date().toISOString(),
        exported_by: req.currentUser!.name,
        system: 'ASSET-IN Kecamatan Taman',
        tables: {
          roles: db.prepare('SELECT * FROM roles').all(),
          locations: db.prepare('SELECT * FROM locations').all(),
          users: db.prepare('SELECT id, name, employee_id, location_id, role_id, email, status FROM users').all(),
          census_periods: db.prepare('SELECT * FROM census_periods').all(),
          assets: db.prepare('SELECT * FROM assets').all(),
          asset_inspections: db.prepare('SELECT * FROM asset_inspections').all(),
          import_batches: db.prepare('SELECT * FROM import_batches').all(),
          maintenance_tickets: db.prepare('SELECT * FROM maintenance_tickets').all(),
          audit_logs: db.prepare('SELECT * FROM audit_logs').all(),
        },
      };

      logAudit(
        req.currentUser!.id,
        'BACKUP_DATABASE',
        'system',
        'assetin.db',
        'Mengunduh snapshot backup relasional database ASSET-IN.'
      );

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="assetin-backup-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(snapshot, null, 2));
    }
  );

  // --- IMAGE EVIDENCE UPLOAD ---
  router.post('/uploads', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role_code === 'PIMPINAN_VIEWER') {
      res.status(403).json({ error: 'Pimpinan / Viewer hanya memiliki akses baca.' });
      return;
    }

    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Format gambar tidak valid.' });
      return;
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'Ekstensi gambar harus PNG, JPG, atau WEBP.' });
      return;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 6 * 1024 * 1024) {
      res.status(400).json({ error: 'Ukuran foto bukti maksimal 6 MB.' });
      return;
    }

    const filename = `evidence_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(getUploadDir(), filename), buffer);
    res.json({ url: `/api/uploads/${filename}` });
  });

  router.get('/uploads/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const fullPath = path.join(getUploadDir(), safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).send('Not found');
      return;
    }
    res.sendFile(fullPath);
  });

  return router;
}
