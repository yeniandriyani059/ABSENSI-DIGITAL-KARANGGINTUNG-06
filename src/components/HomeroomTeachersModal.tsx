import React, { useState, useEffect } from 'react';
import {
  Users,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  GraduationCap,
} from 'lucide-react';
import { HomeroomTeacher } from '../types';
import { CLASS_GRADES, normalizeClassGrade } from '../utils/homeroomTeacherService';

interface HomeroomTeachersModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: HomeroomTeacher[];
  onSaveTeachers: (
    updatedTeachers: HomeroomTeacher[]
  ) => Promise<{ success: boolean; error?: string }>;
  onRefreshTeachers?: () => Promise<void> | void;
}

export const HomeroomTeachersModal: React.FC<HomeroomTeachersModalProps> = ({
  isOpen,
  onClose,
  teachers,
  onSaveTeachers,
  onRefreshTeachers,
}) => {
  const [formRows, setFormRows] = useState<HomeroomTeacher[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const ordered: HomeroomTeacher[] = CLASS_GRADES.map((grade) => {
      const found = teachers.find((t) => normalizeClassGrade(t.kelas) === grade);
      return {
        id: found?.id,
        kelas: grade,
        rawKelas: found?.rawKelas || grade,
        nama_guru: found?.nama_guru || '',
        nip: found?.nip || '',
      };
    });
    setFormRows(ordered);
  }, [teachers, isOpen]);

  if (!isOpen) return null;

  const handleFieldChange = (
    kelas: string,
    field: 'nama_guru' | 'nip',
    value: string
  ) => {
    setFormRows((prev) =>
      prev.map((row) => (row.kelas === kelas ? { ...row, [field]: value } : row))
    );
  };

  const handleRefresh = async () => {
    if (!onRefreshTeachers) return;
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      await onRefreshTeachers();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await onSaveTeachers(formRows);
      if (res.success) {
        setSuccessMessage(
          'Data Wali Kelas (Kelas 1 s/d Kelas 6) berhasil disimpan dan diperbarui!'
        );
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(
          res.error || 'Gagal menyimpan data Wali Kelas ke database Supabase.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat menyimpan data Wali Kelas.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Pengaturan Wali Kelas (Kelas 1 s/d Kelas 6)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur nama guru dan NIP wali kelas untuk tanda tangan otomatis pada laporan rekapitulasi resmi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshTeachers && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Muat ulang dari tabel wali_kelas Supabase"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-emerald-600 ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
                <span className="hidden sm:inline">Sinkronkan</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form & Interactive Table */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {successMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5 text-emerald-900 text-xs shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Gagal Menyimpan ke Supabase:</div>
                  <div>{errorMessage}</div>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                    <th className="py-3 px-4 w-28">Kelas</th>
                    <th className="py-3 px-4">Nama Guru / Wali Kelas</th>
                    <th className="py-3 px-4 w-64">NIP Wali Kelas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm bg-white">
                  {formRows.map((row) => (
                    <tr key={row.kelas} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          Kelas {row.kelas}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={row.nama_guru}
                          onChange={(e) =>
                            handleFieldChange(row.kelas, 'nama_guru', e.target.value)
                          }
                          placeholder={`Nama Wali Kelas ${row.kelas}...`}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white bg-slate-50/50 font-medium text-slate-900"
                          required
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={row.nip}
                          onChange={(e) =>
                            handleFieldChange(row.kelas, 'nip', e.target.value)
                          }
                          placeholder="Contoh: 19870322 201101 2 015"
                          className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white bg-slate-50/50 text-slate-800"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Modal */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Tutup
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Menyimpan ke Supabase...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
