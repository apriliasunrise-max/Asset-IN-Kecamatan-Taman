import React, { useEffect, useState } from 'react';
import { MapPin, Users, Plus, Shield } from 'lucide-react';
import type { LocationNode, Role, UserAccount } from '../types.ts';
import { apiRequest } from '../lib/api.ts';

interface LocationsUsersViewProps {
  currentUser: UserAccount;
  locations: LocationNode[];
  onRefreshLocations: () => void;
}

export function LocationsUsersView({
  currentUser,
  locations,
  onRefreshLocations,
}: LocationsUsersViewProps) {
  const [tab, setTab] = useState<'locations' | 'users' | 'roles'>('locations');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // New location form
  const [locCode, setLocCode] = useState('');
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState<'Ruang' | 'Kelurahan'>('Ruang');
  const [locParentId, setLocParentId] = useState<number>(1);
  const [locError, setLocError] = useState<string | null>(null);

  // New user form
  const [userName, setUserName] = useState('');
  const [userNip, setUserNip] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRoleId, setUserRoleId] = useState<number>(4);
  const [userLocId, setUserLocId] = useState<number>(1);
  const [userError, setUserError] = useState<string | null>(null);

  const canManageLocs = currentUser.permissions.includes('locations:manage');
  const canManageUsers = currentUser.permissions.includes('users:manage');

  const loadData = async () => {
    const [uRes, rRes] = await Promise.all([
      apiRequest<{ users: UserAccount[] }>('/users'),
      apiRequest<{ roles: Role[] }>('/roles'),
    ]);
    setUsers(uRes.users);
    setRoles(rRes.roles);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocError(null);
    try {
      await apiRequest('/locations', {
        method: 'POST',
        body: JSON.stringify({
          code: locCode,
          name: locName,
          type: locType,
          parent_id: locParentId,
        }),
      });
      setLocCode('');
      setLocName('');
      onRefreshLocations();
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Gagal menambahkan lokasi.');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: userName,
          employee_id: userNip,
          email: userEmail,
          role_id: userRoleId,
          location_id: userLocId,
        }),
      });
      setUserName('');
      setUserNip('');
      setUserEmail('');
      await loadData();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Gagal menambahkan pengguna.');
    }
  };

  const toggleUserStatus = async (u: UserAccount) => {
    const nextStatus = u.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    await apiRequest(`/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadData();
  };

  const kecAndKel = locations.filter((l) => l.type === 'Kecamatan' || l.type === 'Kelurahan');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Master Wilayah & Manajemen Pengguna
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Hirarki Kecamatan Taman, 8 Kelurahan, Ruangan, serta pembatasan akses berbasis peran (RBAC)
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            onClick={() => setTab('locations')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'locations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Hirarki Wilayah ({locations.length})
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Akun Petugas ({users.length})
          </button>
          <button
            onClick={() => setTab('roles')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Matriks 6 Role RBAC
          </button>
        </div>
      </div>

      {tab === 'locations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-sky-700" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Struktur Lokasi Kecamatan Taman & 8 Kelurahan
              </h3>
            </div>
            <div className="space-y-4">
              {kecAndKel.map((unit) => {
                const rooms = locations.filter(
                  (r) => r.type === 'Ruang' && r.parent_id === unit.id
                );
                return (
                  <div key={unit.id} className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs text-sky-700 font-semibold mr-2">
                          {unit.code}
                        </span>
                        <span className="font-semibold text-sm text-slate-900">{unit.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">{unit.type}</span>
                    </div>
                    {rooms.length > 0 && (
                      <div className="pl-4 border-l border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {rooms.map((rm) => (
                          <div
                            key={rm.id}
                            className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between"
                          >
                            <span className="text-slate-800">{rm.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">{rm.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {canManageLocs && (
            <section className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 h-fit space-y-4">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Tambah Ruangan / Unit Lokasi
              </h3>
              {locError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
                  {locError}
                </div>
              )}
              <form onSubmit={handleAddLocation} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit Induk</label>
                  <select
                    value={locParentId}
                    onChange={(e) => setLocParentId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {kecAndKel.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tipe Lokasi</label>
                  <select
                    value={locType}
                    onChange={(e) => setLocType(e.target.value as 'Ruang' | 'Kelurahan')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Ruang">Ruang</option>
                    <option value="Kelurahan">Kelurahan</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Kode Lokasi</label>
                  <input
                    type="text"
                    required
                    value={locCode}
                    onChange={(e) => setLocCode(e.target.value)}
                    placeholder="Contoh: KEL-KJR-R03"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nama Lokasi</label>
                  <input
                    type="text"
                    required
                    value={locName}
                    onChange={(e) => setLocName(e.target.value)}
                    placeholder="Contoh: Ruang Rapat Kelurahan"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Simpan Lokasi
                </button>
              </form>
            </section>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section
            className={`${
              canManageUsers ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`}
          >
            <div className="bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] px-6 py-4 flex items-center gap-2 text-white">
              <Users className="h-4 w-4 text-cyan-300" />
              <h3 className="font-display text-base font-semibold text-white">
                Daftar Akun Petugas & Pejabat
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-100 border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Nama & NIP</th>
                    <th className="py-3 px-4">Peran (Role)</th>
                    <th className="py-3 px-4">Wilayah Tugas</th>
                    <th className="py-3 px-4">Status</th>
                    {canManageUsers && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="odd:bg-white even:bg-slate-50/80 hover:bg-blue-50/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          NIP {u.employee_id} · {u.email}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{u.role_name}</td>
                      <td className="py-3 px-4 text-slate-600">{u.location_name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            u.status === 'Aktif' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      {canManageUsers && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => toggleUserStatus(u)}
                            className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
                          >
                            {u.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canManageUsers && (
            <section className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 h-fit space-y-4">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Tambah Akun Petugas
              </h3>
              {userError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
                  {userError}
                </div>
              )}
              <form onSubmit={handleAddUser} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">NIP / ID Pegawai</label>
                  <input
                    type="text"
                    required
                    value={userNip}
                    onChange={(e) => setUserNip(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Dinas</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Peran RBAC</label>
                  <select
                    value={userRoleId}
                    onChange={(e) => setUserRoleId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Wilayah Unit</label>
                  <select
                    value={userLocId}
                    onChange={(e) => setUserLocId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {kecAndKel.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Daftarkan Petugas
                </button>
              </form>
            </section>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-sky-700 shrink-0" />
                <h3 className="font-display text-sm font-bold text-slate-900">{role.name}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{role.description}</p>
              <div className="pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                Izin: {role.permissions.join(' · ')}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
