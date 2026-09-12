import React from 'react';
import { SchoolProfile, StudentMonthlyStat } from '../types';

interface PrintMonthlyReportProps {
  school: SchoolProfile;
  stats: StudentMonthlyStat[];
  monthName: string;
  year: number;
  classGrade: string;
  effectiveDays: number;
}

export const PrintMonthlyReport: React.FC<PrintMonthlyReportProps> = ({
  school,
  stats,
  monthName,
  year,
  classGrade,
  effectiveDays,
}) => {
  const totalHadir = stats.reduce((acc, s) => acc + s.hadir, 0);
  const totalSakit = stats.reduce((acc, s) => acc + s.sakit, 0);
  const totalIzin = stats.reduce((acc, s) => acc + s.izin, 0);
  const totalAlpa = stats.reduce((acc, s) => acc + s.alpa, 0);
  const avgPct = stats.length > 0 ? (stats.reduce((acc, s) => acc + s.pct, 0) / stats.length).toFixed(1) : '0';

  return (
    <div id="print-report-container" className="bg-white text-black p-6 font-serif">
      {/* Kop Surat Resmi */}
      <div className="border-b-4 border-double border-gray-900 pb-3 mb-5 text-center relative">
        <div className="flex items-center justify-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center overflow-hidden shrink-0">
            {school.logoUrl ? (
              <img src={school.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xl border-2 border-gray-900 rounded-full">
                SD
              </div>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-gray-800">
              {school.educationAgency || 'PEMERINTAH DAERAH • DINAS PENDIDIKAN'}
            </h3>
            <h1 className="text-xl font-black tracking-wide text-gray-950 uppercase mt-0.5">
              {school.schoolName}
            </h1>
            <p className="text-xs text-gray-700 mt-1">
              {school.address}
            </p>
            <p className="text-xs text-gray-700">
              NPSN: {school.npsn} | Email: sdn06slemped@gmail.com
            </p>
          </div>
        </div>
      </div>

      {/* Judul Laporan */}
      <div className="text-center mb-6">
        <h2 className="text-base font-bold uppercase underline tracking-wider">
          LAPORAN REKAPITULASI PRESENSI SISWA
        </h2>
        <p className="text-sm font-medium mt-1">
          Bulan: <span className="font-bold">{monthName} {year}</span> &nbsp;|&nbsp; 
          Kelas: <span className="font-bold">{classGrade}</span> &nbsp;|&nbsp; 
          Semester: <span className="font-bold">{school.semester} ({school.academicYear})</span>
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          Jumlah Hari Efektif Belajar: <span className="font-semibold">{effectiveDays} hari</span>
        </p>
      </div>

      {/* Tabel Rekap */}
      <table className="w-full text-xs border-collapse border border-gray-900 mb-6">
        <thead>
          <tr className="bg-gray-100 text-gray-900 font-bold">
            <th className="p-2 border border-gray-800 text-center w-10">No</th>
            <th className="p-2 border border-gray-800 text-center w-24">NISN</th>
            <th className="p-2 border border-gray-800 text-left">Nama Siswa</th>
            <th className="p-2 border border-gray-800 text-center w-12">L/P</th>
            <th className="p-2 border border-gray-800 text-center w-14">Hadir</th>
            <th className="p-2 border border-gray-800 text-center w-14">Telat</th>
            <th className="p-2 border border-gray-800 text-center w-14">Sakit</th>
            <th className="p-2 border border-gray-800 text-center w-14">Izin</th>
            <th className="p-2 border border-gray-800 text-center w-14">Alpa</th>
            <th className="p-2 border border-gray-800 text-center w-16">% Kehadiran</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((item, idx) => (
            <tr key={item.student.id} className="hover:bg-gray-50">
              <td className="p-2 border border-gray-800 text-center">{idx + 1}</td>
              <td className="p-2 border border-gray-800 text-center">{item.student.nisn}</td>
              <td className="p-2 border border-gray-800 font-medium text-left">{item.student.name}</td>
              <td className="p-2 border border-gray-800 text-center">{item.student.gender}</td>
              <td className="p-2 border border-gray-800 text-center font-semibold">{item.hadir}</td>
              <td className="p-2 border border-gray-800 text-center font-semibold text-gray-600">{item.terlambat}</td>
              <td className="p-2 border border-gray-800 text-center">{item.sakit}</td>
              <td className="p-2 border border-gray-800 text-center">{item.izin}</td>
              <td className="p-2 border border-gray-800 text-center">{item.alpa}</td>
              <td className="p-2 border border-gray-800 text-center font-bold">{item.pct}%</td>
            </tr>
          ))}
          {/* Baris Total */}
          <tr className="bg-gray-100 font-bold border-t-2 border-gray-900">
            <td colSpan={4} className="p-2 border border-gray-800 text-right pr-3">
              JUMLAH TOTAL:
            </td>
            <td className="p-2 border border-gray-800 text-center">{totalHadir}</td>
            <td className="p-2 border border-gray-800 text-center">{stats.reduce((acc, s) => acc + s.terlambat, 0)}</td>
            <td className="p-2 border border-gray-800 text-center">{totalSakit}</td>
            <td className="p-2 border border-gray-800 text-center">{totalIzin}</td>
            <td className="p-2 border border-gray-800 text-center">{totalAlpa}</td>
            <td className="p-2 border border-gray-800 text-center">{avgPct}%</td>
          </tr>
        </tbody>
      </table>

      {/* Bagian Tanda Tangan Resmi */}
      <div className="grid grid-cols-2 gap-8 text-xs pt-4">
        <div className="text-center">
          <p className="mb-1">Mengetahui,</p>
          <p className="font-bold">Kepala Sekolah {school.schoolName}</p>
          <div className="h-16"></div>
          <p className="font-bold underline uppercase">{school.principalName}</p>
          <p>NIP. {school.principalNip}</p>
        </div>

        <div className="text-center">
          <p className="mb-1">
            {school.city}, <span id="print-monthly-sig-date"></span>
          </p>
          <p className="font-bold">Guru / Wali Kelas {classGrade}</p>
          <div className="h-16"></div>
          <p className="font-bold underline uppercase">{school.teacherName}</p>
          <p>NIP. {school.teacherNip}</p>
        </div>
      </div>
    </div>
  );
};
