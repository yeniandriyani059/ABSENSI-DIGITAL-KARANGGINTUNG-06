export type AttendanceStatus = 'H' | 'I' | 'S' | 'A' | 'T'; // H: Hadir, I: Izin, S: Sakit, A: Alpa, T: Terlambat

export interface Student {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classGrade: string; // e.g. "1", "2", "3", "4", "5", "6"
  qrCode?: string; // QR code data or custom identifier (defaults to NISN)
  photoUrl?: string; // Student portrait/pasfoto base64 or URL
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  scannedAt?: string; // HH:mm:ss format when recorded via barcode scanner
  checkInTime?: string; // HH:mm:ss format
  checkOutTime?: string; // HH:mm:ss format
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
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
  logoUrl?: string; // Base64 or URL
  checkInTime?: string; // Jam Datang Kelas 3-6 (Default)
  checkOutTime?: string; // Jam Pulang Kelas 3-6 (Default)
  checkInTimeLower?: string; // Jam Datang Kelas 1-2
  checkOutTimeLower?: string; // Jam Pulang Kelas 1-2
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
