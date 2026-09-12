import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  Users,
  Settings,
  GraduationCap,
  CalendarDays,
  Menu,
  X,
  FileSpreadsheet,
  QrCode,
  IdCard,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import {
  Student,
  AttendanceRecord,
  Holiday,
  SchoolProfile,
  StudentMonthlyStat,
  AdminAccount,
} from './types';
import {
  INITIAL_STUDENTS,
  INITIAL_HOLIDAYS,
  INITIAL_SCHOOL_PROFILE,
  generateInitialAttendance,
} from './data/initialData';
import { DailyAttendance } from './components/DailyAttendance';
import { MonthlySummary } from './components/MonthlySummary';
import { HolidaysManager } from './components/HolidaysManager';
import { StudentsManager } from './components/StudentsManager';
import { SchoolSettings } from './components/SchoolSettings';
import { PrintMonthlyReport } from './components/PrintMonthlyReport';
import { StudentIDCards } from './components/StudentIDCards';
import { BarcodeScanner } from './components/BarcodeScanner';
import { LoginPortal } from './components/LoginPortal';
import { AccountProfileModal } from './components/AccountProfileModal';
import { exportElementToPdf } from './utils/pdfExport';

type TabType =
  | 'daily'
  | 'scan'
  | 'idcards'
  | 'monthly'
  | 'holidays'
  | 'students'
  | 'settings';

export default function App() {
  // Persistence state
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('sdn06_students');
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('sdn06_attendance');
    return saved ? JSON.parse(saved) : generateInitialAttendance();
  });

  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    const saved = localStorage.getItem('sdn06_holidays');
    return saved ? JSON.parse(saved) : INITIAL_HOLIDAYS;
  });

  const [school, setSchool] = useState<SchoolProfile>(() => {
    const saved = localStorage.getItem('sdn06_school');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.schoolName === 'SD NEGERI 06 SLEMPED') {
          parsed.schoolName = 'SD NEGERI KARANGGINTUNG 06';
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SCHOOL_PROFILE;
  });

  // Admin credentials state (saved to localStorage so it persists across refreshes)
  const [account, setAccount] = useState<AdminAccount>(() => {
    const saved = localStorage.getItem('sdn06_account');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          username: parsed.username || 'SuperAdmin',
          password: parsed.password || 'Slemped06',
          recoveryEmail: parsed.recoveryEmail || 'sdn06slemped@gmail.com',
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      username: 'SuperAdmin',
      password: 'Slemped06',
      recoveryEmail: 'sdn06slemped@gmail.com',
    };
  });

  // Profile modal toggle
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Authentication state (SuperAdmin portal)
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return (
      localStorage.getItem('sdn06_auth_user') ||
      sessionStorage.getItem('sdn06_auth_user') ||
      null
    );
  });

  // Preserve and restore the last visited tab
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem('sdn06_last_tab');
    if (
      saved &&
      ['daily', 'scan', 'idcards', 'monthly', 'holidays', 'students', 'settings'].includes(saved)
    ) {
      return saved as TabType;
    }
    return 'daily';
  });

  const [selectedClass, setSelectedClass] = useState<string>('4');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [scanInitialValue, setScanInitialValue] = useState<string>('');

  // Save last active tab to localStorage so reopening preserves view
  useEffect(() => {
    localStorage.setItem('sdn06_last_tab', activeTab);
  }, [activeTab]);

  // Persist account changes
  const handleUpdateAccount = useCallback((updated: AdminAccount) => {
    setAccount(updated);
    localStorage.setItem('sdn06_account', JSON.stringify(updated));
    setCurrentUser(updated.username);
    if (localStorage.getItem('sdn06_auth_user')) {
      localStorage.setItem('sdn06_auth_user', updated.username);
    }
    if (sessionStorage.getItem('sdn06_auth_user')) {
      sessionStorage.setItem('sdn06_auth_user', updated.username);
    }
  }, []);

  const handleLoginSuccess = useCallback((user: string, rememberMe: boolean) => {
    setCurrentUser(user);
    if (rememberMe) {
      localStorage.setItem('sdn06_auth_user', user);
    } else {
      sessionStorage.setItem('sdn06_auth_user', user);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setIsProfileModalOpen(false);
    setMobileMenuOpen(false);
    setCurrentUser(null);
    localStorage.removeItem('sdn06_auth_user');
    sessionStorage.removeItem('sdn06_auth_user');
  }, []);

  // Print state
  const [printData, setPrintData] = useState<{
    stats: StudentMonthlyStat[];
    monthName: string;
    year: number;
    effectiveDays: number;
  }>({
    stats: [],
    monthName: '',
    year: new Date().getFullYear(),
    effectiveDays: 20,
  });

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('sdn06_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('sdn06_attendance', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('sdn06_holidays', JSON.stringify(holidays));
  }, [holidays]);

  useEffect(() => {
    localStorage.setItem('sdn06_school', JSON.stringify(school));
  }, [school]);

  // Handlers for Holidays
  const handleAddHoliday = useCallback((date: string, reason: string) => {
    const newHoliday: Holiday = {
      id: `hol-${Date.now()}`,
      date,
      reason,
    };
    setHolidays((prev) => [...prev, newHoliday]);
  }, []);

  const handleDeleteHoliday = useCallback((id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // Handlers for Attendance
  const handleSaveAttendance = useCallback((newRecords: AttendanceRecord[]) => {
    setRecords((prev) => {
      // Remove any existing records that match studentId + date
      const keys = new Set(newRecords.map((r) => `${r.studentId}_${r.date}`));
      const kept = prev.filter((r) => !keys.has(`${r.studentId}_${r.date}`));
      return [...kept, ...newRecords];
    });
  }, []);

  // Handler for single scan record
  const handleRecordSingleAttendance = useCallback((newRecord: AttendanceRecord) => {
    setRecords((prev) => {
      const filtered = prev.filter(
        (r) => !(r.studentId === newRecord.studentId && r.date === newRecord.date)
      );
      return [...filtered, newRecord];
    });
  }, []);

  const handleDeleteRecord = useCallback((recordId: string, studentId?: string, date?: string) => {
    setRecords((prev) =>
      prev.filter((r) => {
        if (recordId && r.id === recordId) return false;
        if (studentId && date && r.studentId === studentId && r.date === date) return false;
        return true;
      })
    );
  }, []);

  // Open scanner with student NISN
  const handleOpenScannerWithNISN = useCallback((nisn: string) => {
    setScanInitialValue(nisn);
    setActiveTab('scan');
  }, []);

  // Handlers for Students
  const handleAddStudent = useCallback((s: Omit<Student, 'id'>) => {
    setStudents((prev) => {
      // Check if student with same NISN already exists to avoid duplicates
      const trimmedNisn = s.nisn.trim();
      const existingIndex = prev.findIndex((item) => item.nisn.trim() === trimmedNisn);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...s,
        };
        return updated;
      }
      const newStudent: Student = {
        ...s,
        id: `std-${Date.now()}`,
      };
      return [...prev, newStudent];
    });
  }, []);

  const handleBatchAddStudents = useCallback((newStudentsList: Omit<Student, 'id'>[]) => {
    setStudents((prev) => {
      const studentMap = new Map<string, Student>();
      // Keep existing students keyed by NISN
      prev.forEach((st) => {
        studentMap.set(st.nisn.trim(), st);
      });

      // Merge new list, updating existing NISNs or inserting new ones
      newStudentsList.forEach((s, idx) => {
        const key = s.nisn.trim();
        if (studentMap.has(key)) {
          const existing = studentMap.get(key)!;
          studentMap.set(key, {
            ...existing,
            ...s,
            // Keep existing photo if new one is empty
            photoUrl: s.photoUrl || existing.photoUrl,
          });
        } else {
          studentMap.set(key, {
            ...s,
            id: `std-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          });
        }
      });

      return Array.from(studentMap.values());
    });
  }, []);

  const handleUpdateStudent = useCallback((s: Student) => {
    setStudents((prev) => prev.map((item) => (item.id === s.id ? s : item)));
  }, []);

  const handleDeleteStudent = useCallback((id: string) => {
    // Delete student directly without window.confirm to avoid iframe blocking
    setStudents((prev) => prev.filter((s) => s.id !== id));
    // Also clean up any orphaned records for this student
    setRecords((prev) => prev.filter((r) => r.studentId !== id));
  }, []);

  const handleRemoveDuplicateStudents = useCallback(() => {
    setStudents((prev) => {
      const seen = new Set<string>();
      const unique: Student[] = [];
      for (const s of prev) {
        const key = s.nisn.trim();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(s);
        }
      }
      return unique;
    });
  }, []);

  // Handlers for School Profile
  const handleUpdateSchool = useCallback((profile: SchoolProfile) => {
    setSchool(profile);
  }, []);

  // Backup & Restore
  const handleExportBackup = useCallback(() => {
    const data = {
      school,
      students,
      holidays,
      records,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_presensi_sdn06_slemped_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [school, students, holidays, records]);

  const handleImportBackup = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.students && parsed.records) {
          if (parsed.school) setSchool(parsed.school);
          if (parsed.students) setStudents(parsed.students);
          if (parsed.holidays) setHolidays(parsed.holidays);
          if (parsed.records) setRecords(parsed.records);
          alert('Data berhasil dipulihkan dari berkas cadangan!');
        } else {
          alert('Format berkas cadangan tidak sesuai.');
        }
      } catch {
        alert('Gagal membaca berkas JSON.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleResetData = useCallback(() => {
    if (
      window.confirm(
        'Apakah Anda yakin ingin mereset seluruh data kembali ke kondisi contoh awal?'
      )
    ) {
      setStudents(INITIAL_STUDENTS);
      setHolidays(INITIAL_HOLIDAYS);
      setSchool(INITIAL_SCHOOL_PROFILE);
      setRecords(generateInitialAttendance());
      alert('Data berhasil direset.');
    }
  }, []);

  // Print Monthly Report handler as requested in user prompt
  const handlePrintReport = useCallback(
    (
      stats: StudentMonthlyStat[],
      monthName: string,
      year: number,
      effectiveDays: number
    ) => {
      setPrintData({ stats, monthName, year, effectiveDays });

      setTimeout(() => {
        const today = new Date();
        const sigDateEl = document.getElementById('print-monthly-sig-date');
        if (sigDateEl) {
          sigDateEl.innerText = today.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        }

        document.body.classList.add('print-mode-monthly');
        setTimeout(() => {
          window.print();
          document.body.classList.remove('print-mode-monthly');
        }, 500);
      }, 100);
    },
    []
  );

  // Export Monthly Report PDF handler
  const handleExportPdfReport = useCallback(
    async (
      stats: StudentMonthlyStat[],
      monthName: string,
      year: number,
      effectiveDays: number
    ) => {
      setPrintData({ stats, monthName, year, effectiveDays });

      setTimeout(async () => {
        const today = new Date();
        const sigDateEl = document.getElementById('print-monthly-sig-date');
        if (sigDateEl) {
          sigDateEl.innerText = today.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        }

        try {
          const filename = `Laporan_Rekap_Presensi_Kelas_${selectedClass}_${monthName}_${year}.pdf`;
          await exportElementToPdf('print-report-container', filename, {
            orientation: 'portrait',
            format: 'a4',
            marginMm: 8,
          });
        } catch (err) {
          console.error('Failed to export report PDF:', err);
          alert('Gagal mengunduh PDF laporan bulanan.');
        }
      }, 150);
    },
    [selectedClass]
  );

  // Portal Masuk (Authentication Guard)
  if (!currentUser) {
    return (
      <LoginPortal
        school={school}
        account={account}
        onLoginSuccess={handleLoginSuccess}
        onUpdateAccount={handleUpdateAccount}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      {/* Account Profile Modal (Ganti Username, Ganti Sandi, Email Pemulihan, Log Out) */}
      <AccountProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        account={account}
        onUpdateAccount={handleUpdateAccount}
        onLogout={handleLogout}
      />

      {/* Container for Printable Report */}
      <PrintMonthlyReport
        school={school}
        stats={printData.stats}
        monthName={printData.monthName}
        year={printData.year}
        classGrade={selectedClass}
        effectiveDays={printData.effectiveDays}
      />

      {/* Main App Container */}
      <div className="app-container flex-1 flex flex-col">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo and School Name */}
              <div className="flex items-center gap-3">
                {school.logoUrl ? (
                  <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                    <img
                      src={school.logoUrl}
                      alt={school.schoolName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-emerald-200 shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                      {school.schoolName}
                    </span>
                    <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                      5 Hari Belajar
                    </span>
                    <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-full">
                      NPSN: {school.npsn}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 hidden sm:block">
                    Sistem Presensi Barcode • Senin - Jumat (Sabtu & Minggu Libur)
                  </p>
                </div>
              </div>

              {/* Desktop Navigation & Account Bar */}
              <div className="hidden md:flex items-center gap-2">
                <nav className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('daily')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'daily'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Presensi Harian
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('scan')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'scan'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    Scan Barcode
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('idcards')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'idcards'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <IdCard className="w-4 h-4" />
                    ID Card Siswa
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('monthly')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'monthly'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Rekap Bulanan
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('holidays')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'holidays'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    Hari Libur ({holidays.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('students')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'students'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Data Siswa ({students.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'settings'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Profil & Kop
                  </button>
                </nav>

                {/* Profil Akun & Log Out Desktop Bar */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer"
                    title="Buka Profil Akun (Ganti Username, Ganti Sandi, Email Pemulihan)"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {account.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold max-w-[80px] truncate">{account.username}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Profil Akun
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-colors cursor-pointer"
                    title="Keluar dari Akun"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>

              {/* Mobile menu toggle */}
              <div className="flex md:hidden items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 border border-slate-200 flex items-center gap-1 text-xs font-bold"
                  title="Profil Akun"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {account.username.charAt(0).toUpperCase()}
                  </div>
                  <span>Profil Akun</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-3 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('daily');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'daily'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4" /> Presensi Harian
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('scan');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg ${
                  activeTab === 'scan'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <QrCode className="w-4 h-4" /> Scan Barcode Presensi
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('idcards');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'idcards'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <IdCard className="w-4 h-4" /> ID Card Siswa (Barcode)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('monthly');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'monthly'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Rekap Bulanan
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('holidays');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'holidays'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CalendarDays className="w-4 h-4" /> Hari Libur ({holidays.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('students');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'students'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" /> Data Siswa ({students.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'settings'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-4 h-4" /> Profil & Kop
              </button>

              {/* Mobile Profil Akun & Log Out items */}
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-800"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Profil Akun ({account.username})</span>
                  </div>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                    Ganti Sandi/User
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out (Keluar)</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Content Area */}
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
          {activeTab === 'daily' && (
            <DailyAttendance
              students={students}
              records={records}
              holidays={holidays}
              school={school}
              selectedClass={selectedClass}
              onSelectClass={setSelectedClass}
              onSaveAttendance={handleSaveAttendance}
              onOpenScanner={() => setActiveTab('scan')}
            />
          )}

          {activeTab === 'scan' && (
            <BarcodeScanner
              students={students}
              records={records}
              holidays={holidays}
              school={school}
              onRecordAttendance={handleRecordSingleAttendance}
              onDeleteRecord={handleDeleteRecord}
              initialScanValue={scanInitialValue}
            />
          )}

          {activeTab === 'idcards' && (
            <StudentIDCards
              students={students}
              school={school}
              selectedClass={selectedClass}
              onSelectClass={setSelectedClass}
              onOpenScannerWithNISN={handleOpenScannerWithNISN}
              onUpdateStudent={handleUpdateStudent}
            />
          )}

          {activeTab === 'monthly' && (
            <MonthlySummary
              students={students}
              records={records}
              holidays={holidays}
              school={school}
              selectedClass={selectedClass}
              onSelectClass={setSelectedClass}
              onPrintReport={handlePrintReport}
              onExportPdfReport={handleExportPdfReport}
            />
          )}

          {activeTab === 'holidays' && (
            <HolidaysManager
              holidays={holidays}
              onAddHoliday={handleAddHoliday}
              onDeleteHoliday={handleDeleteHoliday}
            />
          )}

          {activeTab === 'students' && (
            <StudentsManager
              students={students}
              onAddStudent={handleAddStudent}
              onBatchAddStudents={handleBatchAddStudents}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onRemoveDuplicates={handleRemoveDuplicateStudents}
            />
          )}

          {activeTab === 'settings' && (
            <SchoolSettings
              school={school}
              account={account}
              onOpenAccountProfile={() => setIsProfileModalOpen(true)}
              onUpdateSchool={handleUpdateSchool}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onResetData={handleResetData}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              &copy; {new Date().getFullYear()} {school.schoolName} — {school.educationAgency || school.district}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Tahun Ajaran {school.academicYear} ({school.semester})
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
