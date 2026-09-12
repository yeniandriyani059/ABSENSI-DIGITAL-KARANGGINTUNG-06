import React, { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Users,
  Percent,
  AlertTriangle,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, AttendanceRecord, Holiday, SchoolProfile, StudentMonthlyStat } from '../types';

interface MonthlySummaryProps {
  students: Student[];
  records: AttendanceRecord[];
  holidays: Holiday[];
  school: SchoolProfile;
  selectedClass: string;
  onSelectClass: (c: string) => void;
  onPrintReport: (stats: StudentMonthlyStat[], monthName: string, year: number, effectiveDays: number) => void;
  onExportPdfReport?: (stats: StudentMonthlyStat[], monthName: string, year: number, effectiveDays: number) => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({
  students,
  records,
  holidays,
  school,
  selectedClass,
  onSelectClass,
  onPrintReport,
  onExportPdfReport,
}) => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // Filter students by selected class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.classGrade === selectedClass);
  }, [students, selectedClass]);

  // Calculate effective days in the selected month
  const effectiveDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let count = 0;
    const holidayDates = new Set(holidays.map((h) => h.date));

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(selectedYear, selectedMonth, d);
      if (dt.getDay() === 0 || dt.getDay() === 6) continue; // 5 hari sekolah: Sabtu & Minggu libur

      const yStr = dt.getFullYear();
      const mStr = String(dt.getMonth() + 1).padStart(2, '0');
      const dStr = String(dt.getDate()).padStart(2, '0');
      const dateKey = `${yStr}-${mStr}-${dStr}`;

      if (!holidayDates.has(dateKey)) {
        count++;
      }
    }
    return Math.max(count, 1);
  }, [selectedYear, selectedMonth, holidays]);

  // Calculate monthly stats per student
  const stats: StudentMonthlyStat[] = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    return classStudents.map((student) => {
      const studentRecords = records.filter(
        (r) => r.studentId === student.id && r.date.startsWith(monthPrefix)
      );

      let hadir = 0;
      let terlambat = 0;
      let izin = 0;
      let sakit = 0;
      let alpa = 0;

      studentRecords.forEach((r) => {
        if (r.status === 'H') hadir++;
        else if (r.status === 'T') {
          hadir++; // Terlambat counts as hadir essentially, but we also track it separately
          terlambat++;
        }
        else if (r.status === 'I') izin++;
        else if (r.status === 'S') sakit++;
        else if (r.status === 'A') alpa++;
      });

      const totalRecorded = hadir + izin + sakit + alpa;
      // In Indonesian schools: % Hadir = (Hadir / (Hadir + Sakit + Izin + Alpa) * 100) or against effectiveDays
      const denom = totalRecorded > 0 ? totalRecorded : effectiveDays;
      const pct = Math.min(100, Math.round((hadir / denom) * 100));

      return {
        student,
        hadir,
        terlambat,
        izin,
        sakit,
        alpa,
        totalRecorded,
        effectiveDays,
        pct,
      };
    });
  }, [classStudents, records, selectedMonth, selectedYear, effectiveDays]);

  // Filtered by search
  const filteredStats = useMemo(() => {
    if (!searchTerm.trim()) return stats;
    const q = searchTerm.toLowerCase();
    return stats.filter(
      (s) =>
        s.student.name.toLowerCase().includes(q) ||
        s.student.nisn.includes(q)
    );
  }, [stats, searchTerm]);

  // Overall metrics
  const totalStudents = classStudents.length;
  const overallAvgPct =
    stats.length > 0
      ? Math.round(stats.reduce((acc, s) => acc + s.pct, 0) / stats.length)
      : 0;
  const totalHadirAll = stats.reduce((acc, s) => acc + s.hadir, 0);
  const totalIzinAll = stats.reduce((acc, s) => acc + s.izin, 0);
  const totalSakitAll = stats.reduce((acc, s) => acc + s.sakit, 0);
  const totalAlpaAll = stats.reduce((acc, s) => acc + s.alpa, 0);

  // Trigger print handler
  const handlePrint = () => {
    onPrintReport(stats, MONTH_NAMES[selectedMonth], selectedYear, effectiveDays);
  };

  // Excel Export (.xlsx)
  const handleExportExcel = () => {
    const exportData = stats.map((s, idx) => ({
      No: idx + 1,
      NISN: s.student.nisn,
      'Nama Lengkap Siswa': s.student.name,
      Kelas: `Kelas ${s.student.classGrade}`,
      'Jenis Kelamin': s.student.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)',
      'Hadir (H)': s.hadir,
      'Terlambat (T)': s.terlambat,
      'Sakit (S)': s.sakit,
      'Izin (I)': s.izin,
      'Alpa (A)': s.alpa,
      'Total Kehadiran': s.totalRecorded,
      'Hari Efektif': s.effectiveDays,
      'Persentase Kehadiran': `${s.pct}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 30 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rekap_Kls_${selectedClass}`);
    XLSX.writeFile(
      wb,
      `Rekap_Presensi_Kelas_${selectedClass}_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`
    );
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'No',
      'NISN',
      'Nama Siswa',
      'Kelas',
      'L/P',
      'Hadir (H)',
      'Terlambat (T)',
      'Sakit (S)',
      'Izin (I)',
      'Alpa (A)',
      'Persentase Kehadiran (%)',
    ];

    const rows = stats.map((s, idx) => [
      idx + 1,
      `'${s.student.nisn}`,
      `"${s.student.name}"`,
      s.student.classGrade,
      s.student.gender,
      s.hadir,
      s.terlambat,
      s.sakit,
      s.izin,
      s.alpa,
      `${s.pct}%`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Rekap_Presensi_Kelas_${selectedClass}_${MONTH_NAMES[selectedMonth]}_${selectedYear}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Rekapitulasi Presensi Bulanan Siswa
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Data akumulasi kehadiran, sakit, izin, alpa, dan persentase kehadiran resmi {school.schoolName}.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
              title="Unduh format spreadsheet Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Ekspor Excel (.xlsx)
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Unduh format CSV"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>

            {onExportPdfReport && (
              <button
                onClick={() =>
                  onExportPdfReport(stats, MONTH_NAMES[selectedMonth], selectedYear, effectiveDays)
                }
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Unduh laporan bulanan ini sebagai berkas PDF resmi"
              >
                <FileDown className="w-4 h-4 text-emerald-600" />
                Unduh PDF Laporan
              </button>
            )}

            <button
              onClick={handlePrint}
              id="btn-print-monthly"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak Laporan Resmi
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
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

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Bulan
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tahun
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cari Nama / NISN
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Cari siswa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Siswa</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{totalStudents}</div>
          <div className="text-[11px] text-slate-500">Kelas {selectedClass}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Rata-rata</span>
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-600">{overallAvgPct}%</div>
          <div className="text-[11px] text-slate-500">Kehadiran kelas</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Hadir (H)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{totalHadirAll}</div>
          <div className="text-[11px] text-emerald-600">Presensi masuk</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Sakit (S)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          </div>
          <div className="text-xl font-bold text-slate-900">{totalSakitAll}</div>
          <div className="text-[11px] text-amber-600">Surat/keterangan</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Izin (I)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          </div>
          <div className="text-xl font-bold text-slate-900">{totalIzinAll}</div>
          <div className="text-[11px] text-sky-600">Izin keperluan</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Alpa (A)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600">{totalAlpaAll}</div>
          <div className="text-[11px] text-rose-500">Tanpa keterangan</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-800 text-sm">
            Tabel Rekapitulasi: Kelas {selectedClass} — {MONTH_NAMES[selectedMonth]} {selectedYear}
          </div>
          <div className="text-xs text-slate-500">
            Hari Efektif: <span className="font-semibold text-slate-700">{effectiveDays} hari</span>
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
                <th className="p-3 text-center w-20 text-emerald-700 bg-emerald-50/50">Hadir (H)</th>
                <th className="p-3 text-center w-20 text-orange-700 bg-orange-50/50">Telat (T)</th>
                <th className="p-3 text-center w-20 text-amber-700 bg-amber-50/50">Sakit (S)</th>
                <th className="p-3 text-center w-20 text-sky-700 bg-sky-50/50">Izin (I)</th>
                <th className="p-3 text-center w-20 text-rose-700 bg-rose-50/50">Alpa (A)</th>
                <th className="p-3 text-center w-28">Persentase</th>
                <th className="p-3 text-left w-36">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    Tidak ada data siswa ditemukan untuk Kelas {selectedClass}.
                  </td>
                </tr>
              ) : (
                filteredStats.map((item, idx) => {
                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                      Sangat Baik
                    </span>
                  );
                  if (item.pct < 75) {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800">
                        Perlu Perhatian
                      </span>
                    );
                  } else if (item.pct < 85) {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">
                        Cukup
                      </span>
                    );
                  }

                  return (
                    <tr key={item.student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-slate-500 text-xs">{idx + 1}</td>
                      <td className="p-3 text-center font-mono text-xs text-slate-600">
                        {item.student.nisn}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {item.student.name}
                      </td>
                      <td className="p-3 text-center text-slate-600 text-xs font-semibold">
                        {item.student.gender}
                      </td>
                      <td className="p-3 text-center font-semibold text-emerald-600 bg-emerald-50/20">
                        {item.hadir}
                      </td>
                      <td className="p-3 text-center font-semibold text-orange-600 bg-orange-50/20">
                        {item.terlambat}
                      </td>
                      <td className="p-3 text-center font-semibold text-amber-600 bg-amber-50/20">
                        {item.sakit}
                      </td>
                      <td className="p-3 text-center font-semibold text-sky-600 bg-sky-50/20">
                        {item.izin}
                      </td>
                      <td className="p-3 text-center font-semibold text-rose-600 bg-rose-50/20">
                        {item.alpa}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-10 text-right">{item.pct}%</span>
                          <div className="w-12 bg-slate-200 rounded-full h-1.5 hidden sm:block overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                item.pct >= 85
                                  ? 'bg-emerald-500'
                                  : item.pct >= 75
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${item.pct}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-left">{statusBadge}</td>
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
