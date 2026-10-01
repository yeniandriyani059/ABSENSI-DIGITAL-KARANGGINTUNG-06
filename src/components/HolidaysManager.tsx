import React, { useState } from 'react';
import { Calendar, Trash2, Plus, AlertCircle, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Holiday } from '../types';

interface HolidaysManagerProps {
  holidays: Holiday[];
  onAddHoliday: (date: string, reason: string) => Promise<void> | void;
  onDeleteHoliday: (id: string, date?: string) => Promise<void> | void;
  onRefreshHolidays?: () => Promise<void> | void;
}

export const HolidaysManager: React.FC<HolidaysManagerProps> = ({
  holidays,
  onAddHoliday,
  onDeleteHoliday,
  onRefreshHolidays,
}) => {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date.trim() || !reason.trim()) {
      setError('Harap isi tanggal dan keterangan hari libur!');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onAddHoliday(date.trim(), reason.trim());
      setDate('');
      setReason('');
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan hari libur ke database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (h: Holiday) => {
    setDeletingId(String(h.id));
    try {
      await onDeleteHoliday(String(h.id), h.date);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshHolidays) return;
    setIsRefreshing(true);
    try {
      await onRefreshHolidays();
    } finally {
      setIsRefreshing(false);
    }
  };

  const sortedHolidays = [...holidays].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Kalender Hari Libur &amp; Akademik
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Hari libur tersinkronisasi otomatis di semua perangkat. Tanggal yang tidak terdaftar di bawah ini dihitung sebagai hari efektif belajar aktif.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefreshHolidays && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Muat ulang daftar hari libur dari database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sinkronkan</span>
            </button>
          )}
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
            Total {holidays.length} Hari Libur Terdaftar
          </div>
        </div>
      </div>

      {/* Form Tambah Libur */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4"
      >
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" /> Tambah Hari Libur Baru
        </h3>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tanggal Libur *
            </label>
            <input
              type="date"
              id="holiday-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
              required
            />
          </div>

          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Keterangan / Alasan Libur *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="holiday-reason"
                placeholder="Contoh: Hari Guru Nasional / Libur Semester"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                required
              />
              <button
                type="submit"
                id="btn-add-holiday"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Tabel Hari Libur */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4 w-40">Tanggal</th>
                <th className="p-4">Keterangan</th>
                <th className="p-4 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody id="holidays-tbody" className="divide-y divide-slate-100 text-sm">
              {sortedHolidays.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-400 text-sm">
                    Belum ada hari libur yang ditambahkan. Semua hari Senin s.d. Jumat dihitung sebagai hari sekolah aktif.
                  </td>
                </tr>
              ) : (
                sortedHolidays.map((h) => {
                  const parts = h.date.split('-');
                  const dateObj =
                    parts.length === 3
                      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
                      : new Date(h.date);
                  const formattedDate = dateObj.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });

                  const isDeleting = deletingId === String(h.id);

                  return (
                    <tr key={h.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-4 font-medium text-slate-800">
                        <div className="font-semibold text-slate-900">{h.date}</div>
                        <div className="text-xs text-slate-500">{formattedDate}</div>
                      </td>
                      <td className="p-4 text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {h.reason}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDelete(h)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                          title="Hapus hari libur secara permanen"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
