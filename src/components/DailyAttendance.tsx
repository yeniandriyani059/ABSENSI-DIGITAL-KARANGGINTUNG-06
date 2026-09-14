import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  Save,
  CheckCheck,
  QrCode,
} from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus, Holiday, SchoolProfile } from '../types';

interface DailyAttendanceProps {
  students: Student[];
  records: AttendanceRecord[];
  holidays: Holiday[];
  school: SchoolProfile;
  selectedClass: string;
  onSelectClass: (c: string) => void;
  onSaveAttendance: (records: AttendanceRecord[]) => void;
  onOpenScanner?: () => void;
}

export const DailyAttendance: React.FC<DailyAttendanceProps> = ({
  students,
  records,
  holidays,
  school,
  selectedClass,
  onSelectClass,
  onSaveAttendance,
  onOpenScanner,
}) => {
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const [currentDate, setCurrentDate] = useState<string>(getTodayStr());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filter students by selected class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.classGrade === selectedClass);
  }, [students, selectedClass]);

  // Check if date is Weekend (Sabtu / Minggu pada 5 hari sekolah)
  const weekendInfo = useMemo(() => {
    const parts = currentDate.split('-');
    if (parts.length !== 3) return { isWeekend: false, dayName: '' };
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const day = d.getDay();
    if (day === 0) return { isWeekend: true, dayName: 'Hari Minggu' };
    if (day === 6) return { isWeekend: true, dayName: 'Hari Sabtu' };
    return { isWeekend: false, dayName: '' };
  }, [currentDate]);

  // Check if date is holiday
  const activeHoliday = useMemo(() => {
    return holidays.find((h) => h.date === currentDate);
  }, [holidays, currentDate]);

  // Existing records for this date and class
  const existingMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records
      .filter((r) => r.date === currentDate)
      .forEach((r) => {
        map.set(r.studentId, r);
      });
    return map;
  }, [records, currentDate]);

  // Local working state for the daily sheet
  const [localStatuses, setLocalStatuses] = useState<{
    [studentId: string]: { status: AttendanceStatus };
  }>({});

  // Sync localStatuses when date or class changes
  React.useEffect(() => {
    const nextStatuses: { [studentId: string]: { status: AttendanceStatus } } = {};
    classStudents.forEach((student) => {
      const rec = existingMap.get(student.nisn);
      nextStatuses[student.id] = {
        status: rec ? rec.status : 'Hadir',
      };
    });
    setLocalStatuses(nextStatuses);
    setSaveSuccess(false);
  }, [currentDate, selectedClass, classStudents, existingMap]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
    setSaveSuccess(false);
  };

  const handleMarkAllHadir = () => {
    setLocalStatuses((prev) => {
      const updated = { ...prev };
      classStudents.forEach((s) => {
        updated[s.id] = {
          ...updated[s.id],
          status: 'Hadir',
        };
      });
      return updated;
    });
  };

  const handleSave = () => {
    const newRecords: AttendanceRecord[] = classStudents.map((s) => {
      const cur = localStatuses[s.id] || { status: 'Hadir' };
      return {
        id: `att-${s.nisn}-${currentDate}`,
        studentId: s.nisn,
        date: currentDate,
        status: cur.status,
        scannedAt: ''
      };
    });

    onSaveAttendance(newRecords);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  // Metrics for today's sheet
  const statusValues = Object.values(localStatuses) as Array<{ status: AttendanceStatus }>;
  const hadirCount = statusValues.filter((s) => s.status === 'Hadir').length;
  const sakitCount = statusValues.filter((s) => s.status === 'Sakit').length;
  const izinCount = statusValues.filter((s) => s.status === 'Izin').length;
  const alpaCount = statusValues.filter((s) => s.status === 'Alpa').length;

  return (
    <div className="space-y-6">
      {/* Filter and date header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Presensi Harian Siswa
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Catat kehadiran harian siswa {school.schoolName} dengan cepat dan akurat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenScanner && (
              <button
                onClick={onOpenScanner}
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-emerald-700" />
                Scan Barcode Presensi
              </button>
            )}
            <button
              onClick={handleMarkAllHadir}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              Tandai Semua Hadir
            </button>
            <button
              onClick={handleSave}
              type="button"
              id="btn-save-attendance"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Presensi
            </button>
          </div>
        </div>

        {/* Date and Class Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tanggal Presensi
            </label>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Pilih Kelas
            </label>
            <select
              value={selectedClass}
              onChange={(e) => onSelectClass(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="1">Kelas 1</option>
              <option value="2">Kelas 2</option>
              <option value="3">Kelas 3</option>
              <option value="4">Kelas 4</option>
              <option value="5">Kelas 5</option>
              <option value="6">Kelas 6</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setCurrentDate(getTodayStr())}
              className="w-full px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-center"
            >
              Pilih Hari Ini
            </button>
          </div>
        </div>
      </div>

      {/* Alert if holiday or weekend */}
      {weekendInfo.isWeekend && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Peringatan Hari Libur:</strong> Tanggal terpilih adalah {weekendInfo.dayName} (SD Negeri Karanggintung 06 menerapkan 5 hari sekolah: Senin s.d. Jumat, akhir pekan libur).
          </span>
        </div>
      )}

      {activeHoliday && (
        <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-2.5 text-sky-800 text-xs">
          <Sparkles className="w-4 h-4 shrink-0 text-sky-600" />
          <span>
            <strong>Kalender Akademik:</strong> Tanggal ini tercatat sebagai hari libur: &quot;{activeHoliday.reason}&quot;.
          </span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Presensi harian tanggal <strong>{currentDate}</strong> untuk Kelas <strong>{selectedClass}</strong> berhasil disimpan!</span>
        </div>
      )}

      {/* Today metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-emerald-900">
          <div className="text-xs font-medium text-emerald-700">Hadir (H)</div>
          <div className="text-xl sm:text-2xl font-bold mt-1">{hadirCount} Siswa</div>
        </div>

        <div className="bg-orange-50 border border-orange-200 p-3.5 rounded-xl text-orange-900">
          <div className="text-xs font-medium text-orange-700">Terlambat (T)</div>
          <div className="text-xl sm:text-2xl font-bold mt-1">{statusValues.filter(s => s.status === 'Terlambat').length} Siswa</div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900">
          <div className="text-xs font-medium text-amber-700">Sakit (S)</div>
          <div className="text-xl sm:text-2xl font-bold mt-1">{sakitCount} Siswa</div>
        </div>

        <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl text-sky-900">
          <div className="text-xs font-medium text-sky-700">Izin (I)</div>
          <div className="text-xl sm:text-2xl font-bold mt-1">{izinCount} Siswa</div>
        </div>

        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-rose-900">
          <div className="text-xs font-medium text-rose-700">Alpa (A)</div>
          <div className="text-xl sm:text-2xl font-bold mt-1">{alpaCount} Siswa</div>
        </div>
      </div>

      {/* Attendance Student List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-800 text-sm">
            Daftar Siswa Kelas {selectedClass} ({classStudents.length} Siswa)
          </div>
          <div className="text-xs text-slate-500">
            Tanggal: <span className="font-semibold text-slate-700">{currentDate}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="p-3 text-center w-12">No</th>
                <th className="p-3 text-center w-28">NISN</th>
                <th className="p-3">Nama Siswa</th>
                <th className="p-3 text-center w-14">L/P</th>
                <th className="p-3 text-center w-80">Status Kehadiran</th>
                <th className="p-3">Waktu Pemindaian (Jika ada)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                    Belum ada siswa di Kelas {selectedClass}. Buka menu &quot;Data Siswa&quot; untuk menambahkan siswa.
                  </td>
                </tr>
              ) : (
                classStudents.map((student, idx) => {
                  const cur = localStatuses[student.id] || { status: 'Hadir' };
                  // existing record to display time
                  const existingRecord = records.find(r => r.studentId === student.nisn && r.date === currentDate);
                  let timeString = '';
                  if (existingRecord?.scannedAt) timeString += `${existingRecord.scannedAt}`;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 text-center text-slate-500 text-xs">{idx + 1}</td>
                      <td className="p-3 text-center font-mono text-xs text-slate-600">
                        {student.nisn}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {student.name}
                      </td>
                      <td className="p-3 text-center text-slate-500 text-xs font-semibold">
                        {student.gender}
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Hadir')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                              cur.status === 'Hadir'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700'
                            }`}
                            title="Hadir"
                          >
                            H
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Terlambat')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                              cur.status === 'Terlambat'
                                ? 'bg-orange-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-orange-700'
                            }`}
                            title="Terlambat"
                          >
                            T
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Sakit')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                              cur.status === 'Sakit'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-amber-700'
                            }`}
                            title="Sakit"
                          >
                            S
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Izin')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                              cur.status === 'Izin'
                                ? 'bg-sky-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-sky-700'
                            }`}
                            title="Izin"
                          >
                            I
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, 'Alpa')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                              cur.status === 'Alpa'
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-rose-700'
                            }`}
                            title="Alpa (Tanpa Keterangan)"
                          >
                            A
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {timeString ? (
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 self-start">
                              {timeString}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {classStudents.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleSave}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Presensi Kelas {selectedClass}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
