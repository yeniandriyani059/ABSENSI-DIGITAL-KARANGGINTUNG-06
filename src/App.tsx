import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
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
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import {
  Student,
  AttendanceRecord,
  Holiday,
  SchoolProfile,
  StudentMonthlyStat,
  AdminAccount,
  DbStudent,
  DbAttendance,
  WaLog,
  EwsAlert,
  StudentEwsIndicator,
  HomeroomTeacher,
} from './types';
import {
  INITIAL_HOLIDAYS,
  INITIAL_SCHOOL_PROFILE,
  INITIAL_STUDENTS,
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
import { HomeroomTeachersModal } from './components/HomeroomTeachersModal';
import { TeacherAlertCenter } from './components/TeacherAlertCenter';
import { exportElementToPdf } from './utils/pdfExport';
import {
  fetchSchoolProfileFromSupabase,
  saveSchoolProfileToSupabase,
  subscribeSchoolProfileRealtime,
  getCachedSchoolProfile,
} from './utils/schoolProfileService';
import {
  fetchHomeroomTeachersFromSupabase,
  saveHomeroomTeachersToSupabase,
  getCachedHomeroomTeachers,
} from './utils/homeroomTeacherService';
import {
  getOfflineQueue,
  enqueueOfflineAttendance,
  removeRecordFromOfflineQueue,
  mergeRecordsWithOfflineQueue,
  getCachedStudents,
  setCachedStudents,
  getCachedRecords,
  setCachedRecords,
  syncOfflineQueueToSupabase,
} from './utils/offlineSync';
import {
  CRON_LAST_RUN_DATE_KEY,
  getLocalWaLogs,
  getLocalEwsAlerts,
  fetchWaLogsAndEwsAlertsFromSupabase,
  runCronJob0715UnrecordedStudents,
  handleIncomingWhatsappWebhook,
  updateEwsAlertStatus,
  createWaLogEntry,
  recordManualClickToChatWaLog,
  evaluateStudentEwsIndicators,
  formatPhoneForWaLink,
} from './utils/ewsAndWaService';

type TabType =
  | 'daily'
  | 'scan'
  | 'idcards'
  | 'monthly'
  | 'holidays'
  | 'students'
  | 'settings';

const AUTH_SESSION_STORAGE_KEY = 'absensi_auth_session_v1';
const ADMIN_ACCOUNT_STORAGE_KEY = 'absensi_admin_account_v1';

interface StoredAuthUser {
  username: string;
  email?: string;
  loggedInAt: string;
}

function getStoredAuthUser(): StoredAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.username === 'string' && parsed.username.trim()) {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function saveStoredAuthUser(username: string, email?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredAuthUser = {
      username,
      email,
      loggedInAt: new Date().toISOString(),
    };
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

function clearStoredAuthUser(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // ignore errors
  }
}

function getStoredAdminAccount(): AdminAccount {
  const defaultAccount: AdminAccount = {
    username: 'SuperAdmin',
    password: 'Slemped06',
    recoveryEmail: 'sdn06slemped@gmail.com',
  };
  if (typeof window === 'undefined') return defaultAccount;
  try {
    const raw = window.localStorage.getItem(ADMIN_ACCOUNT_STORAGE_KEY);
    if (!raw) return defaultAccount;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.username && parsed.password) {
      return {
        username: parsed.username,
        password: parsed.password,
        recoveryEmail: parsed.recoveryEmail || defaultAccount.recoveryEmail,
      };
    }
  } catch {
    // ignore parse errors
  }
  return defaultAccount;
}

export default function App() {
  const [students, setStudents] = useState<Student[]>(() => getCachedStudents() || INITIAL_STUDENTS);
  const [records, setRecords] = useState<AttendanceRecord[]>(() =>
    mergeRecordsWithOfflineQueue(getCachedRecords() || [])
  );
  const [isLoading, setIsLoading] = useState(true);

  // Offline-First Network & Sync States
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  // Toast Notification State (Non-blocking UI feedback)
  const [toast, setToast] = useState<{
    id: number;
    variant: 'offline' | 'success' | 'sync';
    message: string;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, variant: 'offline' | 'success' | 'sync' = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), variant, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const fetchStudentsAndRecords = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }

    // Jika sedang offline, gunakan data cache lokal + antrean offline tanpa error
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cachedStd = getCachedStudents();
      if (cachedStd && cachedStd.length > 0) {
        setStudents(cachedStd);
      }
      setRecords((prev) => {
        const merged = mergeRecordsWithOfflineQueue(prev.length > 0 ? prev : getCachedRecords() || []);
        setCachedRecords(merged);
        return merged;
      });
      setIsLoading(false);
      return;
    }

    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase.from('siswa').select('*'),
        supabase.from('presensi').select('*'),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      const mappedStudents: Student[] = (studentsRes.data || []).map((db: DbStudent) => ({
        id: db.id,
        nisn: db.nisn,
        name: db.nama,
        classGrade: db.kelas,
        parentPhone: db.no_wa_ortu || undefined,
        photoUrl: db.foto_url || db.photo_url || undefined,
        gender: db.jenis_kelamin || db.gender || 'L',
        qrCode: db.qr_code || db.nisn,
      }));
      if (mappedStudents.length > 0) {
        setStudents(mappedStudents);
        setCachedStudents(mappedStudents);
      }

      const mappedRecords: AttendanceRecord[] = (attendanceRes.data || []).map((db: DbAttendance) => {
        const d = db.created_at ? new Date(db.created_at) : new Date();
        const dateStr =
          db.tanggal ||
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate()
          ).padStart(2, '0')}`;
        return {
          id: db.id,
          studentId: String(db.siswa_id || db.nisn_siswa || ''),
          date: dateStr,
          scannedAt: `${String(d.getHours()).padStart(2, '0')}:${String(
            d.getMinutes()
          ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`,
          status: db.status,
        };
      });

      const mergedRecords = mergeRecordsWithOfflineQueue(mappedRecords);
      setRecords(mergedRecords);
      setCachedRecords(mergedRecords);
    } catch (error) {
      console.warn('Menggunakan penyimpanan lokal (mode offline-first):', error);
      // Fallback ke data lokal tanpa menampilkan pesan error yang mengganggu guru
      setRecords((prev) => mergeRecordsWithOfflineQueue(prev));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 3. SINKRONISASI OTOMATIS (AUTO-SYNC BACKGROUND):
   * Membaca `offline_sync_queue` dari localStorage dan mengirimkan data tertunda ke Supabase
   * di latar belakang tanpa memblokir aktivitas guru.
   */
  const processOfflineQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (isSyncingRef.current) return;

    const pendingQueue = getOfflineQueue();
    if (pendingQueue.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const result = await syncOfflineQueueToSupabase();
      if (result.success && result.syncedCount > 0) {
        await fetchStudentsAndRecords({ silent: true });
      }
    } catch (err) {
      console.warn('Gagal memproses antrean offline di latar belakang:', err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [fetchStudentsAndRecords]);

  // 1. DETEKSI STATUS KONEKSI (NETWORK LISTENER) & AUTO-SYNC SAAT ONLINE / INITIAL LOAD
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
      fetchStudentsAndRecords({ silent: true });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Jalankan otomatis saat aplikasi pertama kali dimuat dan statusnya online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      processOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processOfflineQueue, fetchStudentsAndRecords]);

  // School Profile state & Supabase Realtime synchronization
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
  const [school, setSchool] = useState<SchoolProfile>(() => getCachedSchoolProfile() || INITIAL_SCHOOL_PROFILE);
  const [schoolRowId, setSchoolRowId] = useState<any>(1);
  const [isSchoolTableReady, setIsSchoolTableReady] = useState<boolean>(true);
  const [schoolSyncError, setSchoolSyncError] = useState<string | null>(null);
  const [homeroomTeachers, setHomeroomTeachers] = useState<HomeroomTeacher[]>(() =>
    getCachedHomeroomTeachers()
  );
  const [isHomeroomModalOpen, setIsHomeroomModalOpen] = useState<boolean>(false);

  const fetchHomeroomTeachers = useCallback(async () => {
    try {
      const res = await fetchHomeroomTeachersFromSupabase();
      setHomeroomTeachers(res.teachers);
    } catch (err) {
      console.warn('Error fetching wali_kelas from Supabase:', err);
    }
  }, []);

  const handleSaveHomeroomTeachers = useCallback(
    async (updatedTeachers: HomeroomTeacher[]) => {
      const res = await saveHomeroomTeachersToSupabase(updatedTeachers);
      setHomeroomTeachers(res.teachers);
      if (res.success) {
        showToast('Data Wali Kelas berhasil disimpan ke tabel wali_kelas!', 'success');
      }
      return { success: res.success, error: res.error };
    },
    [showToast]
  );

  const fetchSchoolProfile = useCallback(async () => {
    try {
      const res = await fetchSchoolProfileFromSupabase();
      setSchool(res.profile);
      setSchoolRowId(res.rowId);
      setIsSchoolTableReady(res.tableExists);
      if (res.error && !res.tableExists) {
        setSchoolSyncError(res.error);
      } else {
        setSchoolSyncError(null);
      }
    } catch (err: any) {
      console.error('Error fetching school profile from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    fetchStudentsAndRecords();
    fetchSchoolProfile();
    fetchHomeroomTeachers();

    // Berlangganan (Realtime Subscription) perubahan tabel profil_sekolah, siswa (foto_url), presensi, dan wali_kelas dari Supabase
    const unsubscribe = subscribeSchoolProfileRealtime((updatedProfile) => {
      setSchool(updatedProfile);
    });

    const dataChannel = supabase
      .channel('realtime_siswa_presensi')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'siswa' },
        () => {
          fetchStudentsAndRecords({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'presensi' },
        () => {
          fetchStudentsAndRecords({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wali_kelas' },
        () => {
          fetchHomeroomTeachers();
        }
      )
      .subscribe();

    return () => {
      unsubscribe();
      supabase.removeChannel(dataChannel);
    };
  }, [fetchStudentsAndRecords, fetchSchoolProfile, fetchHomeroomTeachers]);

  const [account, setAccount] = useState<AdminAccount>(() => getStoredAdminAccount());

  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  // State penanda pengecekan sesi awal (default: true agar tidak melempar ke Login saat di-refresh)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authSession, setAuthSession] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    const stored = getStoredAuthUser();
    return stored ? stored.username : null;
  });
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [selectedClass, setSelectedClass] = useState<string>('1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [scanInitialValue, setScanInitialValue] = useState<string>('');

  // 1 & 2. PENANGANAN INITIAL LOADING, SESSION CHECK (getSession), DAN AUTH STATE LISTENER (onAuthStateChange)
  useEffect(() => {
    let isMounted = true;

    const checkInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!error && session?.user) {
          const resolvedUser =
            session.user.user_metadata?.username ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            getStoredAdminAccount().username;
          setAuthSession(session);
          setCurrentUser(resolvedUser);
          saveStoredAuthUser(resolvedUser, session.user.email);
        } else {
          // Cek sesi login aktif yang tersimpan di localStorage agar tidak logout saat halaman di-refresh
          const storedUser = getStoredAuthUser();
          if (storedUser) {
            setCurrentUser(storedUser.username);
          } else {
            setAuthSession(null);
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.warn('Gagal mengecek sesi awal Supabase:', err);
        if (!isMounted) return;
        const storedUser = getStoredAuthUser();
        if (storedUser) {
          setCurrentUser(storedUser.username);
        } else {
          setAuthSession(null);
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    checkInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        const resolvedUser =
          session.user.user_metadata?.username ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          getStoredAdminAccount().username;
        setAuthSession(session);
        setCurrentUser(resolvedUser);
        saveStoredAuthUser(resolvedUser, session.user.email);
        setIsAuthLoading(false);
      } else if (event === 'SIGNED_OUT') {
        const storedUser = getStoredAuthUser();
        if (!storedUser) {
          setAuthSession(null);
          setCurrentUser(null);
        }
        setIsAuthLoading(false);
      } else if (!session) {
        const storedUser = getStoredAuthUser();
        if (storedUser) {
          setCurrentUser(storedUser.username);
        } else {
          setAuthSession(null);
          setCurrentUser(null);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Closed-Loop WhatsApp & Early Warning System (EWS) States
  const [waLogs, setWaLogs] = useState<WaLog[]>(() => getLocalWaLogs());
  const [ewsAlerts, setEwsAlerts] = useState<EwsAlert[]>(() => getLocalEwsAlerts());
  const [bkLetterTarget, setBkLetterTarget] = useState<StudentEwsIndicator | null>(null);

  // Load wa_logs & ews_alerts from Supabase / local cache on startup
  useEffect(() => {
    fetchWaLogsAndEwsAlertsFromSupabase().then(({ waLogs: w, ewsAlerts: e }) => {
      setWaLogs(w);
      setEwsAlerts(e);
    });
  }, []);

  // Evaluasi otomatis indikator EWS setiap siswa berdasarkan rekaman presensi
  const ewsIndicatorsMap = useMemo(() => {
    return evaluateStudentEwsIndicators(students, records, ewsAlerts);
  }, [students, records, ewsAlerts]);

  // Close desktop "Lainnya" dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateAccount = useCallback((updated: AdminAccount) => {
    setAccount(updated);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ADMIN_ACCOUNT_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore quota error
      }
    }
    setCurrentUser((prev) => {
      if (prev) {
        saveStoredAuthUser(updated.username, updated.recoveryEmail);
        return updated.username;
      }
      return prev;
    });
  }, []);

  const handleLoginSuccess = useCallback(
    (user: string, _rememberMe: boolean) => {
      saveStoredAuthUser(user, account.recoveryEmail);
      setCurrentUser(user);
    },
    [account.recoveryEmail]
  );

  const handleLogout = useCallback(async () => {
    setIsProfileModalOpen(false);
    setMobileMenuOpen(false);
    clearStoredAuthUser();
    setAuthSession(null);
    setCurrentUser(null);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error saat signOut dari Supabase:', err);
    }
  }, []);

  const [printData, setPrintData] = useState<{
    stats: StudentMonthlyStat[];
    monthName: string;
    year: number;
    effectiveDays: number;
    homeroomTeacher?: HomeroomTeacher | null;
  }>({
    stats: [],
    monthName: '',
    year: new Date().getFullYear(),
    effectiveDays: 20,
    homeroomTeacher: null,
  });

  // Replaces the old local storage syncs - we don't save students or records here anymore
  
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

  // 2. LOGIKA PENYIMPANAN OFFLINE-FIRST (LOCAL QUEUE + BACKGROUND SYNC)
  const applyLocalAttendanceUpdate = useCallback((incomingRecords: AttendanceRecord[]) => {
    setRecords((prev) => {
      const map = new Map<string, AttendanceRecord>();
      prev.forEach((r) => map.set(`${r.studentId}_${r.date}`, r));
      incomingRecords.forEach((r) => {
        const existing = map.get(`${r.studentId}_${r.date}`);
        map.set(`${r.studentId}_${r.date}`, {
          ...r,
          id: existing?.id && !String(existing.id).startsWith('att-') ? existing.id : r.id,
          scannedAt: r.scannedAt || existing?.scannedAt || '07:00:00',
        });
      });
      const updated = Array.from(map.values());
      setCachedRecords(updated);
      return updated;
    });
  }, []);

  // Handlers for Attendance ("Simpan Presensi")
  const handleSaveAttendance = useCallback(
    async (newRecords: AttendanceRecord[]) => {
      // Perbarui state lokal secara instan agar antarmuka langsung merespons tanpa jeda
      applyLocalAttendanceUpdate(newRecords);

      // Jika sedang offline, langsung simpan ke antrean localStorage (`offline_sync_queue`) tanpa error
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineAttendance(newRecords);
        showToast(
          'Internet terputus. Presensi tersimpan di perangkat dan akan disinkronkan otomatis.',
          'offline'
        );
        return;
      }

      try {
        const primaryInserts = newRecords.map((r) => {
          const payload: any = {
            siswa_id: r.studentId,
            tanggal: r.date,
            status: r.status,
            created_at: `${r.date}T${(r.scannedAt || '07:00:00').replace(/\./g, ':')}+07:00`,
          };
          if (typeof r.id === 'number' || (typeof r.id === 'string' && !r.id.startsWith('att-'))) {
            payload.id = r.id;
          }
          return payload;
        });

        const { error } = await supabase.from('presensi').upsert(primaryInserts).select();

        if (error) {
          const fallbackInserts = newRecords.map((r) => {
            const payload: any = {
              nisn_siswa: r.studentId,
              created_at: `${r.date}T${(r.scannedAt || '07:00:00').replace(/\./g, ':')}+07:00`,
              status: r.status,
            };
            if (typeof r.id === 'number' || (typeof r.id === 'string' && !r.id.startsWith('att-'))) {
              payload.id = r.id;
            }
            return payload;
          });
          const { error: fbError } = await supabase.from('presensi').upsert(fallbackInserts).select();
          if (fbError) throw fbError;
        }

        showToast('Presensi berhasil disimpan ke server.', 'success');
        fetchStudentsAndRecords({ silent: true });
      } catch (e) {
        console.warn('Koneksi terputus saat menyimpan, mengalihkan ke antrean offline:', e);
        // Jangan tampilkan pesan error, simpan ke offline_sync_queue dan beri Toast offline
        enqueueOfflineAttendance(newRecords);
        showToast(
          'Internet terputus. Presensi tersimpan di perangkat dan akan disinkronkan otomatis.',
          'offline'
        );
      }
    },
    [applyLocalAttendanceUpdate, fetchStudentsAndRecords, showToast]
  );

  // Handler for single scan record (Barcode Scanner)
  const handleRecordSingleAttendance = useCallback(
    async (newRecord: AttendanceRecord) => {
      // Perbarui state lokal secara instan
      applyLocalAttendanceUpdate([newRecord]);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineAttendance([newRecord]);
        showToast(
          'Internet terputus. Presensi tersimpan di perangkat dan akan disinkronkan otomatis.',
          'offline'
        );
        return;
      }

      try {
        const cleanTime = (newRecord.scannedAt || '07:00:00').replace(/\./g, ':');
        const primaryPayload: any = {
          siswa_id: newRecord.studentId,
          tanggal: newRecord.date,
          status: newRecord.status,
          created_at: `${newRecord.date}T${cleanTime}+07:00`,
        };

        if (
          typeof newRecord.id === 'number' ||
          (typeof newRecord.id === 'string' && !newRecord.id.startsWith('att-'))
        ) {
          primaryPayload.id = newRecord.id;
        }

        const { error } = await supabase.from('presensi').upsert(primaryPayload).select();

        if (error) {
          const fallbackPayload: any = {
            nisn_siswa: newRecord.studentId,
            created_at: `${newRecord.date}T${cleanTime}+07:00`,
            status: newRecord.status,
          };
          if (primaryPayload.id !== undefined) {
            fallbackPayload.id = primaryPayload.id;
          }
          const { error: fbError } = await supabase.from('presensi').upsert(fallbackPayload).select();
          if (fbError) throw fbError;
        }

        fetchStudentsAndRecords({ silent: true });
      } catch (e) {
        console.warn('Koneksi terputus saat scan, menyimpan ke antrean offline:', e);
        enqueueOfflineAttendance([newRecord]);
        showToast(
          'Internet terputus. Presensi tersimpan di perangkat dan akan disinkronkan otomatis.',
          'offline'
        );
      }
    },
    [applyLocalAttendanceUpdate, fetchStudentsAndRecords, showToast]
  );

  const handleDeleteRecord = useCallback(
    async (recordId: string, studentId?: string, date?: string) => {
      // Hapus dari antrean lokal jika ada
      removeRecordFromOfflineQueue(recordId, studentId, date);

      setRecords((prev) => {
        const filtered = prev.filter((r) => {
          if (recordId && r.id === recordId) return false;
          if (studentId && date && r.studentId === studentId && r.date === date) return false;
          return true;
        });
        setCachedRecords(filtered);
        return filtered;
      });

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      try {
        if (recordId && !String(recordId).startsWith('att-')) {
          const { error } = await supabase.from('presensi').delete().eq('id', recordId);
          if (error) throw error;
        }
      } catch (e) {
        console.warn('Gagal menghapus rekaman di server:', e);
      }
    },
    []
  );

  // Open scanner with student NISN
  const handleOpenScannerWithNISN = useCallback((nisn: string) => {
    setScanInitialValue(nisn);
    setActiveTab('scan');
  }, []);

  // ===========================================================================
  // HANDLERS CLOSED-LOOP WHATSAPP GATEWAY (CRON 07.15 WIB & WEBHOOK) & EWS
  // ===========================================================================
  const getTodayStrWib = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }, []);

  const handleTriggerCron0715 = useCallback(async () => {
    const todayStr = getTodayStrWib();
    const res = await runCronJob0715UnrecordedStudents({
      students,
      records,
      holidays,
      dateStr: todayStr,
    });
    setWaLogs(getLocalWaLogs());

    if (res.skippedReason) {
      showToast(`Cron 07.15 WIB dilewati: ${res.skippedReason}`, 'offline');
    } else if (res.sentLogs.length === 0) {
      showToast('Seluruh siswa sudah tercatat presensi hari ini.', 'success');
    } else {
      showToast(
        `Cron 07.15 WIB: Mengirim ${res.sentLogs.length} pesan WA otomatis ke orang tua siswa yang belum tercatat.`,
        'success'
      );
    }
  }, [getTodayStrWib, students, records, holidays, showToast]);

  // Penjadwal Otomatis (Cron Job) setiap pukul 07.15 WIB
  useEffect(() => {
    const checkCronTime = () => {
      if (students.length === 0) return;
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const todayStr = getTodayStrWib();

      // Jika sudah masuk pukul 07:15 ke atas pada hari ini dan belum dijalankan otomatis
      if (hours === 7 && minutes >= 15) {
        const lastRun = localStorage.getItem(CRON_LAST_RUN_DATE_KEY);
        if (lastRun !== todayStr) {
          handleTriggerCron0715();
        }
      }
    };

    const intervalId = window.setInterval(checkCronTime, 30000);
    return () => window.clearInterval(intervalId);
  }, [students.length, getTodayStrWib, handleTriggerCron0715]);

  // Penangan Webhook Pesan Masuk WA (Balasan 1/2/3/4 dari Orang Tua)
  const handleIncomingWaReply = useCallback(
    async (student: Student, replyText: string) => {
      const todayStr = getTodayStrWib();
      try {
        const res = await handleIncomingWhatsappWebhook({
          student,
          rawReply: replyText,
          dateStr: todayStr,
        });

        setWaLogs(res.updatedWaLogs);
        setEwsAlerts(getLocalEwsAlerts());

        const nowTime = new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Update status presensi hari ini secara otomatis sesuai balasan WA orang tua
        await handleRecordSingleAttendance({
          id: `att-${student.nisn}-${todayStr}`,
          studentId: student.nisn,
          date: todayStr,
          status: res.mappedStatus,
          scannedAt: nowTime,
        });

        if (res.triggeredRedAlert) {
          showToast(
            `ALERT DARURAT: Orang tua ${student.name} menyatakan "Sudah Berangkat" namun belum tercatat di sekolah!`,
            'offline'
          );
        } else {
          showToast(
            `Presensi ${student.name} diperbarui menjadi "${res.mappedStatus}" (presensi & wa_logs diupdate, ews_alerts direset).`,
            'success'
          );
        }
      } catch (err: any) {
        showToast(err?.message || 'Gagal memproses balasan WhatsApp.', 'offline');
      }
    },
    [getTodayStrWib, handleRecordSingleAttendance, showToast]
  );

  // Tombol Cepat Guru: [Tandai Hadir Terlambat] dari Kartu Alert Merah
  const handleMarkLatePresentFromAlert = useCallback(
    async (studentNisn: string, alertId?: string) => {
      const todayStr = getTodayStrWib();
      const nowTime = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      await handleRecordSingleAttendance({
        id: `att-${studentNisn}-${todayStr}`,
        studentId: studentNisn,
        date: todayStr,
        status: 'Terlambat',
        scannedAt: nowTime,
      });

      if (alertId) {
        const updated = await updateEwsAlertStatus(alertId, 'SELESAI');
        setEwsAlerts(updated);
      }
      showToast('Siswa berhasil ditandai Hadir Terlambat & alert diselesaikan.', 'success');
    },
    [getTodayStrWib, handleRecordSingleAttendance, showToast]
  );

  // Tombol Cepat Guru: [Selesai Ditindaklanjuti]
  const handleResolveEwsAlert = useCallback(
    async (alertId: string) => {
      const updated = await updateEwsAlertStatus(alertId, 'SELESAI');
      setEwsAlerts(updated);
      showToast('Status tindak lanjut alert telah ditandai Selesai.', 'success');
    },
    [showToast]
  );

  // Catat log WA manual ketika Guru mengklik tombol "Buka WA" (Click-to-Chat Gratis)
  const handleOpenManualWaChat = useCallback(async (student: Student) => {
    const updatedLogs = await recordManualClickToChatWaLog(student);
    setWaLogs(updatedLogs);
  }, []);

  // Catat pengiriman notifikasi peringatan EWS ke wa_logs
  const handleSendEwsWaNotification = useCallback(
    async (indicator: StudentEwsIndicator, reasonText: string) => {
      await createWaLogEntry({
        siswa_id: indicator.studentId,
        student_name: indicator.studentName,
        class_grade: indicator.classGrade,
        phone_number: indicator.parentPhone,
        message_sent: `Notifikasi EWS (${reasonText}) kepada Orang Tua/Wali ${indicator.studentName}`,
        status_reply: 'TERKIRIM (PERINGATAN EWS)',
      });
      setWaLogs(getLocalWaLogs());
    },
    []
  );

  // Handlers for Students (tabel `siswa`: id, nisn, nama, kelas, jenis_kelamin, no_wa_ortu, foto_url, qr_code)
  const handleAddStudent = useCallback(
    async (s: Omit<Student, 'id'>) => {
      try {
        const cleanWa = s.parentPhone?.trim()
          ? formatPhoneForWaLink(s.parentPhone.trim())
          : null;
        let insertedRow: any = null;

        const fullPayload: Record<string, any> = {
          nisn: s.nisn,
          nama: s.name,
          kelas: s.classGrade,
          jenis_kelamin: s.gender || 'L',
          no_wa_ortu: cleanWa,
          foto_url: s.photoUrl || null,
          qr_code: s.qrCode || s.nisn,
        };

        const { data, error } = await supabase.from('siswa').insert(fullPayload).select();

        if (error) {
          const { data: midData, error: midError } = await supabase
            .from('siswa')
            .insert({
              nisn: s.nisn,
              nama: s.name,
              kelas: s.classGrade,
              no_wa_ortu: cleanWa,
              foto_url: s.photoUrl || null,
            })
            .select();

          if (midError) {
            const { data: fbData, error: fbError } = await supabase
              .from('siswa')
              .insert({
                nisn: s.nisn,
                nama: s.name,
                kelas: s.classGrade,
              })
              .select();
            if (fbError) throw fbError;
            insertedRow = fbData?.[0];
          } else {
            insertedRow = midData?.[0];
          }
        } else {
          insertedRow = data?.[0];
        }

        const newS: Student = {
          ...s,
          id: insertedRow?.id || `std-${Date.now()}`,
          photoUrl: insertedRow?.foto_url || s.photoUrl,
          parentPhone: insertedRow?.no_wa_ortu || cleanWa || undefined,
          qrCode: insertedRow?.qr_code || s.qrCode || s.nisn,
        };

        setStudents((prev) => {
          const next = [...prev, newS];
          setCachedStudents(next);
          return next;
        });

        showToast('Data siswa dan foto berhasil disimpan!', 'success');
        await fetchStudentsAndRecords({ silent: true });
      } catch (e) {
        console.error(e);
        alert('Gagal menambah data siswa ke server.');
      }
    },
    [fetchStudentsAndRecords, showToast]
  );

  const handleBatchAddStudents = useCallback(
    async (newStudentsList: Omit<Student, 'id'>[]) => {
      try {
        const fullInserts = newStudentsList.map((s) => ({
          nisn: s.nisn,
          nama: s.name,
          kelas: s.classGrade,
          jenis_kelamin: s.gender || 'L',
          no_wa_ortu: s.parentPhone?.trim() ? formatPhoneForWaLink(s.parentPhone.trim()) : null,
          foto_url: s.photoUrl || null,
          qr_code: s.qrCode || s.nisn,
        }));

        const { error } = await supabase.from('siswa').insert(fullInserts).select();

        if (error) {
          const basicInserts = newStudentsList.map((s) => ({
            nisn: s.nisn,
            nama: s.name,
            kelas: s.classGrade,
          }));
          const { error: fbError } = await supabase.from('siswa').insert(basicInserts).select();
          if (fbError) throw fbError;
        }

        fetchStudentsAndRecords();
      } catch (e) {
        console.error(e);
        alert('Gagal menambah siswa secara massal.');
      }
    },
    [fetchStudentsAndRecords]
  );

  const handleUpdateStudent = useCallback(
    async (s: Student) => {
      // 1. Automatisasi format nomor WhatsApp ('08...' -> '628...')
      const cleanWa = s.parentPhone?.trim()
        ? formatPhoneForWaLink(s.parentPhone.trim())
        : undefined;

      const normalizedStudent: Student = {
        ...s,
        parentPhone: cleanWa,
        qrCode: s.qrCode || s.nisn,
      };

      // Optimistic update lokal & cache agar langsung tampil di ID Card & Data Siswa
      setStudents((prev) => {
        const next = prev.map((item) =>
          item.id === s.id || item.nisn === s.nisn ? normalizedStudent : item
        );
        setCachedStudents(next);
        return next;
      });

      try {
        // 3. Eksekusi Update Database Supabase pada tabel `siswa` berdasarkan ID / NISN
        const fullUpdate: Record<string, any> = {
          nisn: s.nisn,
          nama: s.name,
          kelas: s.classGrade,
          jenis_kelamin: s.gender || 'L',
          no_wa_ortu: cleanWa || null,
          foto_url: s.photoUrl || null,
          qr_code: s.qrCode || s.nisn,
        };

        const isLocalSeedId = String(s.id).startsWith('std-');
        const matchColumn = isLocalSeedId ? 'nisn' : 'id';
        const matchValue = isLocalSeedId ? s.nisn : s.id;

        const { error } = await supabase
          .from('siswa')
          .update(fullUpdate)
          .eq(matchColumn, matchValue);

        if (error) {
          // Fallback bertahap apabila ada kolom opsional yang belum dibuat pada tabel `siswa`
          const { error: midErr } = await supabase
            .from('siswa')
            .update({
              nisn: s.nisn,
              nama: s.name,
              kelas: s.classGrade,
              no_wa_ortu: cleanWa || null,
              foto_url: s.photoUrl || null,
            })
            .eq(matchColumn, matchValue);

          if (midErr) {
            const { error: photoErr } = await supabase
              .from('siswa')
              .update({
                nisn: s.nisn,
                nama: s.name,
                kelas: s.classGrade,
                foto_url: s.photoUrl || null,
              })
              .eq(matchColumn, matchValue);

            if (photoErr) {
              const { error: basicErr } = await supabase
                .from('siswa')
                .update({
                  nisn: s.nisn,
                  nama: s.name,
                  kelas: s.classGrade,
                })
                .eq(matchColumn, matchValue);
              if (basicErr) throw basicErr;
            }
          }
        }

        showToast('Data siswa dan foto berhasil diperbarui!', 'success');
        await fetchStudentsAndRecords({ silent: true });
      } catch (e) {
        console.error(e);
        alert('Gagal memperbarui data siswa.');
      }
    },
    [fetchStudentsAndRecords, showToast]
  );

  const handleDeleteStudent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('siswa').delete().eq('id', id);
      if (error) throw error;
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setRecords((prev) => prev.filter((r) => r.studentId !== id)); // also assume cascading or cleanup
    } catch (e) {
      console.error(e);
      alert('Gagal menghapus siswa dari server.');
    }
  }, []);

  const handleRemoveDuplicateStudents = useCallback(async () => {
    // Handling duplicate removal in Supabase is complex via UI, 
    // we'll just reload from server as Supabase NISN is assumed unique.
    fetchStudentsAndRecords();
  }, [fetchStudentsAndRecords]);

  // Handlers for School Profile with Supabase Persistence
  const handleUpdateSchool = useCallback(
    async (profile: SchoolProfile) => {
      setSchool(profile);
      const res = await saveSchoolProfileToSupabase(profile, schoolRowId);
      if (res.success) {
        setSchool(res.profile);
        setIsSchoolTableReady(true);
        setSchoolSyncError(null);
        return { success: true };
      } else {
        setIsSchoolTableReady(res.tableExists ?? false);
        setSchoolSyncError(res.error || null);
        return {
          success: false,
          error: res.error,
          tableExists: res.tableExists,
        };
      }
    },
    [schoolRowId]
  );

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
    alert('Fitur reset data dinonaktifkan pada versi Cloud Database demi keamanan data.');
  }, []);

  // Print Monthly Report handler as requested in user prompt
  const handlePrintReport = useCallback(
    (
      stats: StudentMonthlyStat[],
      monthName: string,
      year: number,
      effectiveDays: number,
      homeroomTeacher?: HomeroomTeacher | null
    ) => {
      setPrintData({ stats, monthName, year, effectiveDays, homeroomTeacher });

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
      effectiveDays: number,
      homeroomTeacher?: HomeroomTeacher | null
    ) => {
      setPrintData({ stats, monthName, year, effectiveDays, homeroomTeacher });

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

  // 1. Penanganan Initial Loading & Session Check:
  // Jangan melempar pengguna ke halaman Login sebelum pengecekan getSession() selesai (isAuthLoading === false)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 font-sans text-slate-700">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 px-8 py-6 flex flex-col items-center gap-3 max-w-xs w-full text-center">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <div>
            <p className="text-sm font-bold text-slate-900">Memeriksa Sesi Login...</p>
            <p className="text-xs text-slate-500 mt-0.5">{school.schoolName}</p>
          </div>
        </div>
      </div>
    );
  }

  // Portal Masuk (Authentication Guard) - hanya diarahkan ke Login jika pengecekan selesai dan sesi bernilai null
  if (!currentUser && !authSession) {
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

      {/* Modal Pengaturan Wali Kelas (Tabel wali_kelas Kelas 1 s/d Kelas 6) */}
      <HomeroomTeachersModal
        isOpen={isHomeroomModalOpen}
        onClose={() => setIsHomeroomModalOpen(false)}
        teachers={homeroomTeachers}
        onSaveTeachers={handleSaveHomeroomTeachers}
        onRefreshTeachers={fetchHomeroomTeachers}
      />

      {/* Container for Printable Report */}
      <PrintMonthlyReport
        school={school}
        stats={printData.stats}
        monthName={printData.monthName}
        year={printData.year}
        classGrade={selectedClass}
        effectiveDays={printData.effectiveDays}
        homeroomTeacher={printData.homeroomTeacher}
        homeroomTeachers={homeroomTeachers}
      />

      {/* Toast Notification (Offline-First & Background Sync Feedback) */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium ${
              toast.variant === 'offline'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-emerald-900 text-white border-emerald-700'
            }`}
          >
            {toast.variant === 'offline' ? (
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main App Container */}
      <div className="app-container flex-1 flex flex-col">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 h-16 flex-nowrap">
              {/* 1. Logo and School Name (No-Wrap, Ample Space) */}
              <div className="flex items-center gap-2.5 shrink-0 flex-nowrap min-w-0">
                {school.logoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                    <img
                      src={school.logoUrl}
                      alt={school.schoolName}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-emerald-200 shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                )}
                <div className="flex flex-col justify-center shrink-0">
                  <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                    <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base lg:text-lg whitespace-nowrap">
                      {school.schoolName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 hidden sm:block whitespace-nowrap leading-tight">
                    Sistem Presensi Barcode
                  </p>
                </div>
              </div>

              {/* 3. Desktop Navigation & Account Bar (Responsive with Overflow Dropdown) */}
              <div className="hidden lg:flex items-center gap-2 shrink-0 flex-nowrap">
                <nav className="flex items-center gap-1 shrink-0 flex-nowrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('daily')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      activeTab === 'daily'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    Presensi Harian
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('scan')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      activeTab === 'scan'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 shrink-0" />
                    Scan Barcode
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('idcards')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      activeTab === 'idcards'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <IdCard className="w-3.5 h-3.5 shrink-0" />
                    ID Card Siswa
                  </button>

                  {/* Full Inline Secondary Menus on Ultra-Wide Screens (2xl+) */}
                  <div className="hidden 2xl:flex items-center gap-1 shrink-0 flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setActiveTab('monthly')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        activeTab === 'monthly'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                      Rekap Bulanan
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('holidays')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        activeTab === 'holidays'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      Hari Libur ({holidays.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('students')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        activeTab === 'students'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      Data Siswa ({students.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        activeTab === 'settings'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5 shrink-0" />
                      Profil & Kop
                    </button>
                  </div>

                  {/* Compact Dropdown (Three-Dots Icon) for Secondary Menus on Standard Desktop (lg to xl) */}
                  <div className="relative 2xl:hidden shrink-0" ref={moreMenuRef}>
                    <button
                      type="button"
                      onClick={() => setMoreMenuOpen((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        ['monthly', 'holidays', 'students', 'settings'].includes(activeTab)
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                      }`}
                      title="Menu Lainnya (Rekap Bulanan, Hari Libur, Data Siswa, Profil & Kop)"
                    >
                      <MoreHorizontal className="w-4 h-4 shrink-0" />
                      <span>
                        {activeTab === 'monthly'
                          ? 'Rekap Bulanan'
                          : activeTab === 'holidays'
                          ? `Hari Libur (${holidays.length})`
                          : activeTab === 'students'
                          ? `Data Siswa (${students.length})`
                          : activeTab === 'settings'
                          ? 'Profil & Kop'
                          : 'Menu Lainnya'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0" />
                    </button>

                    {moreMenuOpen && (
                      <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('monthly');
                            setMoreMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            activeTab === 'monthly'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Rekap Bulanan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('holidays');
                            setMoreMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            activeTab === 'holidays'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Hari Libur ({holidays.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('students');
                            setMoreMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            activeTab === 'students'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Data Siswa ({students.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('settings');
                            setMoreMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            activeTab === 'settings'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Settings className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Profil & Kop</span>
                        </button>
                      </div>
                    )}
                  </div>
                </nav>

                {/* Indikator Status Koneksi & Sinkronisasi + Profil Akun Desktop Bar */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 shrink-0 flex-nowrap">
                  {isSyncing ? (
                    <div
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium whitespace-nowrap shrink-0"
                      title="Sedang menyinkronkan data presensi ke server..."
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                      <span>Menyinkronkan...</span>
                    </div>
                  ) : isOnline ? (
                    <div
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-50/70 border border-emerald-200/80 text-emerald-600 shrink-0"
                      title="Status Koneksi: Online"
                    >
                      <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ) : (
                    <div
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium whitespace-nowrap shrink-0"
                      title="Internet terputus. Data presensi disimpan secara lokal di perangkat."
                    >
                      <WifiOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Offline - Data tersimpan lokal</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-700 hover:text-emerald-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Buka Profil Akun (Ganti Username, Ganti Sandi, Email Pemulihan)"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {account.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold max-w-[80px] truncate">{account.username}</span>
                    <span className="hidden xl:inline-block text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Profil Akun
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Keluar dari Akun"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>

              {/* Tablet & Mobile menu toggle (< lg) */}
              <div className="flex lg:hidden items-center gap-1.5 shrink-0">
                {isSyncing ? (
                  <div
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium whitespace-nowrap"
                    title="Menyinkronkan..."
                  >
                    <RefreshCw className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
                    <span className="hidden sm:inline">Menyinkronkan...</span>
                  </div>
                ) : isOnline ? (
                  <div
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600"
                    title="Status Koneksi: Online"
                  >
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-medium whitespace-nowrap"
                    title="Offline - Data tersimpan lokal"
                  >
                    <WifiOff className="w-3 h-3 text-rose-600 shrink-0" />
                    <span className="hidden sm:inline">Offline - Data tersimpan lokal</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 border border-slate-200 flex items-center gap-1 text-xs font-bold whitespace-nowrap shrink-0"
                  title="Profil Akun"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {account.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">Profil Akun</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 shrink-0"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* Tablet & Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-3 space-y-1">
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
          {/* Pusat Notifikasi & Alert Guru (Closed-Loop WhatsApp & Early Warning System) */}
          <TeacherAlertCenter
            students={students}
            records={records}
            holidays={holidays}
            school={school}
            selectedClass={selectedClass}
            waLogs={waLogs}
            ewsAlerts={ewsAlerts}
            ewsIndicatorsMap={ewsIndicatorsMap}
            onTriggerCron0715={handleTriggerCron0715}
            onIncomingWaReply={handleIncomingWaReply}
            onMarkLatePresent={handleMarkLatePresentFromAlert}
            onResolveEwsAlert={handleResolveEwsAlert}
            onSendEwsWaNotification={handleSendEwsWaNotification}
            onOpenManualWaChat={handleOpenManualWaChat}
            bkLetterTarget={bkLetterTarget}
            onSelectBkLetterTarget={setBkLetterTarget}
            homeroomTeachers={homeroomTeachers}
          />

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
              ewsIndicatorsMap={ewsIndicatorsMap}
              onPrintBkLetter={(ind) => setBkLetterTarget(ind)}
              onSendWaWarning={(ind) =>
                handleSendEwsWaNotification(ind, ind.badges[0]?.fullTitle || 'Peringatan EWS')
              }
              onOpenManualWaChat={handleOpenManualWaChat}
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
              ewsIndicatorsMap={ewsIndicatorsMap}
              onPrintBkLetter={(ind) => setBkLetterTarget(ind)}
              onSendWaWarning={(ind) =>
                handleSendEwsWaNotification(ind, ind.badges[0]?.fullTitle || 'Peringatan EWS')
              }
              homeroomTeachers={homeroomTeachers}
              onOpenHomeroomModal={() => setIsHomeroomModalOpen(true)}
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
              ewsIndicatorsMap={ewsIndicatorsMap}
              onPrintBkLetter={(ind) => setBkLetterTarget(ind)}
              onSendWaWarning={(ind) =>
                handleSendEwsWaNotification(ind, ind.badges[0]?.fullTitle || 'Peringatan EWS')
              }
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
              isTableReady={isSchoolTableReady}
              syncError={schoolSyncError}
              onRefreshSchool={fetchSchoolProfile}
              homeroomTeachers={homeroomTeachers}
              onSaveHomeroomTeachers={handleSaveHomeroomTeachers}
              onOpenHomeroomModal={() => setIsHomeroomModalOpen(true)}
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
