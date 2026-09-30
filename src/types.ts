export type AttendanceStatus =
  | 'Hadir'
  | 'Izin'
  | 'Sakit'
  | 'Alpa'
  | 'Terlambat'
  | 'Butuh Tindak Lanjut';

export interface DbStudent {
  id: any;
  nisn: string;
  nama: string;
  kelas: string;
  no_wa_ortu?: string;
  foto_url?: string;
  photo_url?: string;
  jenis_kelamin?: 'L' | 'P';
  gender?: 'L' | 'P';
  qr_code?: string;
}

export interface DbAttendance {
  id: any;
  siswa_id?: string;
  tanggal?: string;
  nisn_siswa?: string;
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
  parentPhone?: string; // Nomor WhatsApp Orang Tua / Wali
}

export interface AttendanceRecord {
  id: any;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  scannedAt: string; // HH:mm:ss
  checkInTime?: string;
  checkOutTime?: string;
}

export type WaReplyCode =
  | 'PENDING'
  | '1_SAKIT'
  | '2_IZIN'
  | '3_TERLAMBAT'
  | '4_TIDAK_TAHU'
  | 'EWS_NOTIFIED';

export interface WaLog {
  id: string;
  siswa_id: string; // NISN atau ID siswa
  student_name?: string;
  class_grade?: string;
  phone_number: string;
  message_sent: string;
  status_reply: string;
  created_at: string;
}

export type EwsAlertType =
  | 'WA_CLOSED_LOOP_4' // Balasan WA "4" / Tidak tahu / Sudah Berangkat -> BUTUH TINDAK LANJUT
  | 'ALPA_1X' // 1x Alpa -> Kirim Notifikasi Peringatan ke WA Orang Tua
  | 'ALPA_2X_CONSECUTIVE' // 2x Alpa Berturut-turut -> Peringatan Kuning di Dashboard Guru
  | 'ABSENT_3X_WEEK' // 3x Ketidakhadiran dalam 1 Minggu -> Alert Merah Wali Kelas & kontak WA
  | 'ABSENT_5X_MONTH'; // 5x Ketidakhadiran dalam 1 Bulan -> Cetak Surat Panggilan Ortu / Laporan BK

export type EwsSeverityLevel = 'INFO' | 'YELLOW' | 'RED' | 'CRITICAL';

export type EwsActionStatus = 'BUTUH TINDAK LANJUT' | 'MENUNGGU KONFIRMASI' | 'SELESAI';

export interface EwsAlert {
  id: string;
  siswa_id: string; // NISN siswa
  student_name?: string;
  class_grade?: string;
  parent_phone?: string;
  alert_type: EwsAlertType;
  severity_level: EwsSeverityLevel;
  status_action: EwsActionStatus;
  description?: string;
  created_at: string;
}

export interface StudentEwsIndicator {
  studentId: string; // NISN
  studentName: string;
  classGrade: string;
  parentPhone: string;
  highestSeverity: EwsSeverityLevel | null;
  badges: {
    type: EwsAlertType;
    severity: EwsSeverityLevel;
    shortLabel: string;
    fullTitle: string;
    recommendation: string;
    count: number;
  }[];
  alpaCountMonth: number;
  consecutiveAlpa: number;
  absentCountWeek: number;
  absentCountMonth: number;
  needsFollowUpReply4: boolean;
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
