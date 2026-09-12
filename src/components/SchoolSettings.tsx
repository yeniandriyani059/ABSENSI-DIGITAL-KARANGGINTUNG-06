import React, { useState } from 'react';
import {
  Building2,
  Save,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  User,
  KeyRound,
  Mail,
} from 'lucide-react';
import { SchoolProfile, AdminAccount } from '../types';

interface SchoolSettingsProps {
  school: SchoolProfile;
  account?: AdminAccount;
  onOpenAccountProfile?: () => void;
  onUpdateSchool: (profile: SchoolProfile) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onResetData: () => void;
}

export const SchoolSettings: React.FC<SchoolSettingsProps> = ({
  school,
  account,
  onOpenAccountProfile,
  onUpdateSchool,
  onExportBackup,
  onImportBackup,
  onResetData,
}) => {
  const [profile, setProfile] = useState<SchoolProfile>(school);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSchool(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      e.target.value = '';
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Hanya file gambar (PNG, JPG, WEBP, SVG) yang diperbolehkan untuk logo.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newLogoUrl = event.target.result as string;
          const updated = { ...profile, logoUrl: newLogoUrl };
          setProfile(updated);
          onUpdateSchool(updated);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-600" />
          Profil Sekolah & Kop Surat Laporan
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Pengaturan identitas sekolah yang akan dicantumkan pada kop surat resmi dan lembar tanda tangan laporan rekapitulasi.
        </p>
      </div>

      {saved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Profil sekolah berhasil diperbarui!</span>
        </div>
      )}

      {/* Form Profil Sekolah */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6"
      >
        <div className="border-b border-slate-100 pb-3 font-semibold text-sm text-slate-800 flex justify-between items-center">
          Identitas Satuan Pendidikan
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="sm:col-span-3 mb-2 flex items-center gap-4">
            <div className="w-16 h-16 rounded border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Logo Sekolah" className="w-full h-full object-contain p-1" />
              ) : (
                <Building2 className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Logo Sekolah (Format PNG, JPG, atau WEBP)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1">Logo akan ditampilkan pada header sudut kiri atas, KTS, dan Cetak Laporan.</p>
            </div>
            {profile.logoUrl && (
              <button
                type="button"
                onClick={() => {
                  const updated = { ...profile, logoUrl: undefined };
                  setProfile(updated);
                  onUpdateSchool(updated);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 3000);
                }}
                className="ml-auto px-3 py-1.5 text-xs text-rose-600 bg-rose-50 rounded hover:bg-rose-100 cursor-pointer"
              >
                Hapus Logo
              </button>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nama Instansi / Dinas (Kop Surat & Kartu) *
            </label>
            <input
              type="text"
              value={profile.educationAgency || ''}
              onChange={(e) => setProfile({ ...profile, educationAgency: e.target.value })}
              placeholder="Contoh: PEMERINTAH KABUPATEN GRESIK • DINAS PENDIDIKAN"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="sm:col-span-1"></div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nama Sekolah *
            </label>
            <input
              type="text"
              value={profile.schoolName}
              onChange={(e) => setProfile({ ...profile, schoolName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              NPSN *
            </label>
            <input
              type="text"
              value={profile.npsn}
              onChange={(e) => setProfile({ ...profile, npsn: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Alamat Lengkap Sekolah *
            </label>
            <input
              type="text"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Kota / Kabupaten *
            </label>
            <input
              type="text"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tahun Ajaran *
            </label>
            <input
              type="text"
              value={profile.academicYear}
              onChange={(e) => setProfile({ ...profile, academicYear: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Semester *
            </label>
            <select
              value={profile.semester}
              onChange={(e) => setProfile({ ...profile, semester: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 pb-1 font-semibold text-sm text-slate-800">
          Aturan Jam Presensi (Scan Barcode)
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-4 border p-4 rounded-lg border-slate-200">
            <h4 className="font-semibold text-xs text-emerald-700 bg-emerald-50 py-1 px-2 rounded inline-block">Kelas 1 & 2</h4>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Batas Jam Datang (Terlambat) *
              </label>
              <input
                type="time"
                value={profile.checkInTimeLower || '07:00'}
                onChange={(e) => setProfile({ ...profile, checkInTimeLower: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Batas Mulai Jam Pulang *
              </label>
              <input
                type="time"
                value={profile.checkOutTimeLower || '10:00'}
                onChange={(e) => setProfile({ ...profile, checkOutTimeLower: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>
          
          <div className="space-y-4 border p-4 rounded-lg border-slate-200">
            <h4 className="font-semibold text-xs text-emerald-700 bg-emerald-50 py-1 px-2 rounded inline-block">Kelas 3, 4, 5, 6</h4>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Batas Jam Datang (Terlambat) *
              </label>
              <input
                type="time"
                value={profile.checkInTime || '07:00'}
                onChange={(e) => setProfile({ ...profile, checkInTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Batas Mulai Jam Pulang *
              </label>
              <input
                type="time"
                value={profile.checkOutTime || '13:00'}
                onChange={(e) => setProfile({ ...profile, checkOutTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 pb-1 font-semibold text-sm text-slate-800">
          Pejabat Pengesah & Tanda Tangan
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nama Kepala Sekolah *
            </label>
            <input
              type="text"
              value={profile.principalName}
              onChange={(e) => setProfile({ ...profile, principalName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              NIP Kepala Sekolah *
            </label>
            <input
              type="text"
              value={profile.principalNip}
              onChange={(e) => setProfile({ ...profile, principalNip: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nama Guru / Wali Kelas *
            </label>
            <input
              type="text"
              value={profile.teacherName}
              onChange={(e) => setProfile({ ...profile, teacherName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              NIP Guru / Wali Kelas *
            </label>
            <input
              type="text"
              value={profile.teacherNip}
              onChange={(e) => setProfile({ ...profile, teacherNip: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Perubahan Profil
          </button>
        </div>
      </form>

      {/* Profil Akun Login & Kredensial */}
      {onOpenAccountProfile && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Profil Akun Administrator ({account?.username || 'SuperAdmin'})
                </h3>
                <p className="text-xs text-slate-500">
                  Kelola nama pengguna, kata sandi, dan email aktif pemulihan akun.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAccountProfile}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Buka Profil Akun
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Username</span>
                <span className="text-xs font-bold text-slate-800">{account?.username || 'SuperAdmin'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <KeyRound className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Kata Sandi</span>
                <span className="text-xs font-bold text-slate-800">••••••••</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="overflow-hidden">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Email Pemulihan</span>
                <span className="text-xs font-medium text-emerald-700 truncate block">
                  {account?.recoveryEmail || 'sdn06slemped@gmail.com'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cadangan & Pemulihan Data */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Cadangan & Pemulihan Data (Backup & Restore)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Simpan seluruh data absensi, siswa, dan hari libur ke berkas JSON atau pulihkan dari cadangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Unduh Cadangan Lengkap (JSON)
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-slate-300">
            <Upload className="w-4 h-4" />
            <span>Pulihkan Data dari Berkas</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onResetData}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer ml-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Reset ke Data Awal
          </button>
        </div>
      </div>
    </div>
  );
};
