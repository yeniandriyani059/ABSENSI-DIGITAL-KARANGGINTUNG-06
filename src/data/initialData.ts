import { Student, Holiday, SchoolProfile, AttendanceRecord } from '../types';

export const INITIAL_SCHOOL_PROFILE: SchoolProfile = {
  schoolName: 'SD NEGERI KARANGGINTUNG 06',
  npsn: '20502106',
  district: 'Dinas Pendidikan',
  address: 'Jl. Raya Karanggintung No. 06',
  principalName: 'Drs. Bambang Hariyanto, M.Pd.',
  principalNip: '19690815 199303 1 004',
  teacherName: 'Nurul Hidayati, S.Pd.',
  teacherNip: '19870322 201101 2 015',
  academicYear: '2025/2026',
  semester: 'Ganjil',
  city: 'Gresik',
  educationAgency: 'DINAS PENDIDIKAN',
  checkInTime: '07:00',
  checkOutTime: '13:00',
};

export const INITIAL_STUDENTS: Student[] = [
  { id: 'std-1', nisn: '0123456701', name: 'Ahmad Fauzi Pratama', gender: 'L', classGrade: '4' },
  { id: 'std-2', nisn: '0123456702', name: 'Annisa Dwi Rahmawati', gender: 'P', classGrade: '4' },
  { id: 'std-3', nisn: '0123456703', name: 'Bagus Setiawan', gender: 'L', classGrade: '4' },
  { id: 'std-4', nisn: '0123456704', name: 'Citra Kirana Putri', gender: 'P', classGrade: '4' },
  { id: 'std-5', nisn: '0123456705', name: 'Dimas Arya Nugraha', gender: 'L', classGrade: '4' },
  { id: 'std-6', nisn: '0123456706', name: 'Fadhilah Nur Aini', gender: 'P', classGrade: '4' },
  { id: 'std-7', nisn: '0123456707', name: 'Gilang Ramadhan', gender: 'L', classGrade: '4' },
  { id: 'std-8', nisn: '0123456708', name: 'Hafiz Al-Farisi', gender: 'L', classGrade: '4' },
  { id: 'std-9', nisn: '0123456709', name: 'Intan Permata Sari', gender: 'P', classGrade: '4' },
  { id: 'std-10', nisn: '0123456710', name: 'Muhammad Rizky Ilham', gender: 'L', classGrade: '4' },
  { id: 'std-11', nisn: '0123456711', name: 'Nabila Zahra Syahfitri', gender: 'P', classGrade: '4' },
  { id: 'std-12', nisn: '0123456712', name: 'Rangga Danendra', gender: 'L', classGrade: '4' },
  { id: 'std-13', nisn: '0123456713', name: 'Siti Aisyah Azzahra', gender: 'P', classGrade: '4' },
  { id: 'std-14', nisn: '0123456714', name: 'Yoga Pratama Putra', gender: 'L', classGrade: '4' },
  // Additional classes
  { id: 'std-15', nisn: '0123456715', name: 'Aldi Taher Santoso', gender: 'L', classGrade: '5' },
  { id: 'std-16', nisn: '0123456716', name: 'Bella Safitri', gender: 'P', classGrade: '5' },
  { id: 'std-17', nisn: '0123456717', name: 'Chandra Wibowo', gender: 'L', classGrade: '5' },
  { id: 'std-18', nisn: '0123456718', name: 'Dina Maulida', gender: 'P', classGrade: '6' },
  { id: 'std-19', nisn: '0123456719', name: 'Eko Prasetyo', gender: 'L', classGrade: '6' },
];

export const INITIAL_HOLIDAYS: Holiday[] = [
  { id: 'hol-1', date: '2026-08-17', reason: 'Hari Proklamasi Kemerdekaan RI' },
  { id: 'hol-2', date: '2026-09-05', reason: 'Maulid Nabi Muhammad SAW' },
  { id: 'hol-3', date: '2026-10-01', reason: 'Hari Kesaktian Pancasila' },
  { id: 'hol-4', date: '2026-11-10', reason: 'Hari Pahlawan Nasional' },
  { id: 'hol-5', date: '2026-11-25', reason: 'Hari Guru Nasional' },
  { id: 'hol-6', date: '2026-12-25', reason: 'Hari Raya Natal & Cuti Bersama' },
];

// Generate attendance for the current month dates up to today
export function generateInitialAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();

  const class4Students = INITIAL_STUDENTS.filter(s => s.classGrade === '4');

  for (let day = 1; day <= todayDate; day++) {
    const curDate = new Date(year, month, day);
    const dayOfWeek = curDate.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends (Sabtu & Minggu libur 5 hari sekolah)

    const yStr = curDate.getFullYear();
    const mStr = String(curDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(curDate.getDate()).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    // check if holiday
    if (INITIAL_HOLIDAYS.some(h => h.date === dateStr)) continue;

    class4Students.forEach((student, idx) => {
      let status: 'H' | 'I' | 'S' | 'A' = 'H';
      // Add realistic slight variation for certain students
      if (idx === 2 && (day === 3 || day === 4)) status = 'S';
      else if (idx === 6 && day === 5) status = 'I';
      else if (idx === 9 && day === 8) status = 'A';
      else if (idx === 11 && day === 2) status = 'I';
      else if (idx === 13 && day === 7) status = 'S';

      records.push({
        id: `att-${student.id}-${dateStr}`,
        studentId: student.id,
        date: dateStr,
        status,
        notes: status !== 'H' ? (status === 'S' ? 'Demam' : status === 'I' ? 'Acara keluarga' : 'Tanpa keterangan') : undefined,
      });
    });
  }

  return records;
}
