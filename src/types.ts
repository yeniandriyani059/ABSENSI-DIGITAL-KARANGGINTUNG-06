export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa' | 'Terlambat';

export interface DbStudent {
  id: any;
  nisn: string;
  nama: string;
  kelas: string;
  // Supabase might have these, but user didn't mention them explicitly.
  gender?: 'L' | 'P';
  qr_code?: string;
  photo_url?: string;
}

export interface DbAttendance {
  id: any;
  nisn_siswa: string;
  created_at: string; // ISO string
  status: AttendanceStatus;
}

export interface Student {
  id: any;
  nisn: string;
  name: string;
  gender?: 'L' | 'P';
  classGrade: string; 
  qrCode?: string;
  photoUrl?: string;
}

export interface AttendanceRecord {
  id: any;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  scannedAt: string; // HH:mm:ss
}

export interface Holiday {
  id: any;
  date: string; 
  reason: string;
}

export interface SchoolProfile {
  schoolName: string;
  npsn: string;
  district: string;
  address: string;
  principalName: string;
  principalNip: string;
  teacherName: string;
  teacherNip: string;
  academicYear: string;
  semester: string;
  city: string;
  educationAgency?: string;
  logoUrl?: string; 
  checkInTime?: string; 
  checkOutTime?: string; 
  checkInTimeLower?: string; 
  checkOutTimeLower?: string; 
}

export interface StudentMonthlyStat {
  student: Student;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  totalRecorded: number;
  effectiveDays: number;
  pct: number;
}

export interface AdminAccount {
  username: string;
  password: string;
  recoveryEmail: string;
}
