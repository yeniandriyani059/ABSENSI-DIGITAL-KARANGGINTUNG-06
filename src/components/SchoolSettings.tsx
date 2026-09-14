import React, { useState, useEffect } from 'react';
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
  Database,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Code2,
  X,
  Layers,
} from 'lucide-react';
import { SchoolProfile, AdminAccount } from '../types';
import {
  SQL_CREATE_TABLE_SCRIPT,
  COLUMNS_DOCUMENTATION,
  PROFIL_SEKOLAH_TABLE,
} from '../utils/schoolProfileService';

interface SchoolSettingsProps {
  school: SchoolProfile;
  account?: AdminAccount;
  onOpenAccountProfile?: () => void;
  onUpdateSchool: (profile: SchoolProfile) => Promise<{ success: boolean; error?: string; tableExists?: boolean } | void> | void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onResetData: () => void;
  isTableReady?: boolean;
  syncError?: string | null;
  onRefreshSchool?: () => void;
}

export const SchoolSettings: React.FC<SchoolSettingsProps> = ({
  school,
  account,
  onOpenAccountProfile,
  onUpdateSchool,
  onExportBackup,
  onImportBackup,
  onResetData,
  isTableReady = true,
  syncError = null,
  onRefreshSchool,
}) => {
  const [profile, setProfile] = useState<SchoolProfile>(school);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Sync profile when school data arrives or is updated in real-time from Supabase
  useEffect(() => {
    setProfile(school);
  }, [school]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    try {
      const res = await onUpdateSchool(profile);
      if (res && res.success === false) {
        setErrorMessage(
          res.error || 'Gagal menyimpan profil ke Supabase. Periksa apakah tabel profil_sekolah sudah dibuat.'
        );
      } else {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menyimpan ke database Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_CREATE_TABLE_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
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
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Profil Sekolah & Kop Surat Laporan
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengaturan identitas sekolah yang tersinkronisasi otomatis via Supabase Realtime untuk kop surat, cetak KTS, dan rekapitulasi.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Lihat nama tabel, kolom, dan script SQL Supabase"
          >
            <Code2 className="w-4 h-4 text-emerald-700" />
            <span>Instruksi SQL Supabase</span>
          </button>

          {onRefreshSchool && (
            <button
              type="button"
              onClick={onRefreshSchool}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Periksa ulang data terbaru dari Supabase"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Sinkronkan</span>
            </button>
          )}
        </div>
      </div>

      {/* Database Connection / Synchronization Status Card */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isTableReady
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isTableReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isTableReady ? <Database className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Status Penyimpanan Supabase:
              </span>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  isTableReady ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                }`}
              >
                {isTableReady ? 'Terhubung & Real-Time' : 'Tabel Belum Terdeteksi'}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              {isTableReady
                ? `Data profil tersimpan di tabel "${PROFIL_SEKOLAH_TABLE}". Setiap perubahan langsung otomatis sinkron ke seluruh perangkat & pencetakan.`
                : `Tabel "${PROFIL_SEKOLAH_TABLE}" belum dibuat di Supabase. Klik "Instruksi SQL Supabase" untuk membuat tabel dalam 1 kali klik.`}
            </p>
          </div>
        </div>

        {!isTableReady && (
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            Buka Panduan SQL
          </button>
        )}
      </div>

      {/* Success Alert */}
      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5 text-emerald-900 text-xs shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Profil sekolah berhasil disimpan ke Supabase!</strong> Data kop surat dan cetak KTS kini telah diperbarui di semua perangkat.
          </span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Gagal Menyimpan ke Supabase:</div>
            <div>{errorMessage}</div>
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="mt-1.5 text-rose-700 font-bold underline hover:text-rose-900 cursor-pointer inline-flex items-center gap-1"
            >
              <Code2 className="w-3 h-3" />
              Buka script SQL untuk membuat tabel profil_sekolah
            </button>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form Profil Sekolah */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6"
      >
        <div className="border-b border-slate-100 pb-3 font-semibold text-sm text-slate-800 flex justify-between items-center">
          <span>Identitas Satuan Pendidikan</span>
          <span className="text-[11px] font-normal text-slate-500">
            Tersimpan di tabel: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-semibold">{PROFIL_SEKOLAH_TABLE}</code>
          </span>
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
                  setSavedSuccess(true);
                  setTimeout(() => setSavedSuccess(false), 3000);
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
              Kecamatan / Wilayah
            </label>
            <input
              type="text"
              value={profile.district || ''}
              onChange={(e) => setProfile({ ...profile, district: e.target.value })}
              placeholder="Contoh: Kebomas / Gresik"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-4 h-4" />
            <span>Lihat Skema Kolom & Script SQL Supabase</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Menyimpan ke Supabase...' : 'Simpan Perubahan ke Supabase'}</span>
          </button>
        </div>
      </form>

      {/* MODAL INSTRUKSI SQL & SKEMA TABEL SUPABASE */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Panduan & Script SQL Supabase
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tabel: <span className="font-mono font-bold text-emerald-800">{PROFIL_SEKOLAH_TABLE}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs leading-relaxed">
              {/* Langkah Cepat */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h4 className="font-bold text-emerald-950 text-sm mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Langkah-Langkah Pembuatan Tabel di Supabase:
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-emerald-900 font-medium">
                  <li>Buka Dashboard Supabase Anda (misal: <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-emerald-950">https://supabase.com/dashboard</code>).</li>
                  <li>Pilih menu <strong>SQL Editor</strong> di bilah navigasi kiri (ikon terminal).</li>
                  <li>Klik <strong>New Query</strong> (atau tanda tambah +).</li>
                  <li>Salin kode SQL di bawah ini dan tempel (Paste) ke editor.</li>
                  <li>Klik tombol <strong>Run</strong> (atau tekan <kbd className="bg-white border px-1 rounded font-mono text-[10px]">Ctrl+Enter</kbd>).</li>
                </ol>
              </div>

              {/* Script SQL Lengkap dengan Tombol Copy */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-600" />
                    Script SQL Siap Eksekusi (Copy-Paste):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Salin Kode SQL
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <pre className="p-3.5 bg-slate-950 text-emerald-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-56 leading-relaxed border border-slate-800 selection:bg-emerald-800 selection:text-white">
                    {SQL_CREATE_TABLE_SCRIPT}
                  </pre>
                </div>
              </div>

              {/* Rincian Nama Kolom & Tipe Data */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-2">
                  Daftar Nama Kolom, Tipe Data & Peruntukan:
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Nama Kolom</th>
                        <th className="p-2.5">Tipe Data</th>
                        <th className="p-2.5">Keterangan / Form</th>
                        <th className="p-2.5 hidden sm:table-cell">Contoh Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {COLUMNS_DOCUMENTATION.map((col) => (
                        <tr key={col.name} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-emerald-800">{col.name}</td>
                          <td className="p-2 font-mono text-slate-600">{col.type}</td>
                          <td className="p-2 text-slate-700">{col.description}</td>
                          <td className="p-2 font-mono text-slate-500 truncate max-w-[140px] hidden sm:table-cell">
                            {col.example}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-bold underline"
              >
                <span>Buka Dashboard Supabase</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex items-center gap-2">
                {onRefreshSchool && (
                  <button
                    type="button"
                    onClick={() => {
                      onRefreshSchool();
                      setShowSqlModal(false);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Tutup & Uji Koneksi
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
