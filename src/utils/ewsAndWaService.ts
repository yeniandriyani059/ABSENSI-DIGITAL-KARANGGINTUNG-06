import { supabase } from '../supabaseClient';
import {
  Student,
  AttendanceRecord,
  AttendanceStatus,
  Holiday,
  WaLog,
  EwsAlert,
  EwsAlertType,
  EwsSeverityLevel,
  EwsActionStatus,
  StudentEwsIndicator,
} from '../types';

export const WA_LOGS_STORAGE_KEY = 'sdn06_wa_logs_v1';
export const EWS_ALERTS_STORAGE_KEY = 'sdn06_ews_alerts_v1';
export const PARENT_PHONES_STORAGE_KEY = 'sdn06_parent_phones_v1';
export const CRON_LAST_RUN_DATE_KEY = 'sdn06_wa_cron_0715_last_date';
export const WA_GATEWAY_CONFIG_KEY = 'sdn06_wa_gateway_config_v1';

export interface WaGatewayConfig {
  enabled: boolean;
  autoCron0715: boolean;
  endpointUrl: string;
  apiKey: string;
}

/**
 * 4. SKEMA TABEL DATABASE SUPABASE (TAMBAHAN):
 * Rancangan tabel `wa_logs` dan `ews_alerts` sesuai spesifikasi
 */
export const SUPABASE_WA_EWS_SCHEMA_SQL = `-- ============================================================================
-- SKEMA TABEL CLOSED-LOOP WHATSAPP GATEWAY & EARLY WARNING SYSTEM (EWS)
-- ============================================================================

-- 1. Tabel Log Pesan WhatsApp Dua Arah (wa_logs)
CREATE TABLE IF NOT EXISTS public.wa_logs (
  id TEXT PRIMARY KEY,
  siswa_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  message_sent TEXT NOT NULL,
  status_reply TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_siswa_id ON public.wa_logs(siswa_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_created_at ON public.wa_logs(created_at DESC);

-- 2. Tabel Early Warning System & Alert Tindak Lanjut Guru (ews_alerts)
CREATE TABLE IF NOT EXISTS public.ews_alerts (
  id TEXT PRIMARY KEY,
  siswa_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity_level TEXT NOT NULL,
  status_action TEXT DEFAULT 'BUTUH TINDAK LANJUT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ews_alerts_siswa_id ON public.ews_alerts(siswa_id);
CREATE INDEX IF NOT EXISTS idx_ews_alerts_status_action ON public.ews_alerts(status_action);

-- Aktifkan Row Level Security (RLS) dengan akses penuh untuk aplikasi
ALTER TABLE public.wa_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ews_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to wa_logs" ON public.wa_logs;
CREATE POLICY "Allow full access to wa_logs" ON public.wa_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to ews_alerts" ON public.ews_alerts;
CREATE POLICY "Allow full access to ews_alerts" ON public.ews_alerts FOR ALL USING (true) WITH CHECK (true);
`;

export function getWaGatewayConfig(): WaGatewayConfig {
  try {
    const raw = localStorage.getItem(WA_GATEWAY_CONFIG_KEY);
    if (!raw) {
      return {
        enabled: true,
        autoCron0715: true,
        endpointUrl: '',
        apiKey: '',
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      enabled: true,
      autoCron0715: true,
      endpointUrl: '',
      apiKey: '',
    };
  }
}

export function saveWaGatewayConfig(config: WaGatewayConfig): void {
  try {
    localStorage.setItem(WA_GATEWAY_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Penyimpanan nomor WA Orang Tua per NISN di localStorage agar tetap persisten
 */
export function getSavedParentPhones(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PARENT_PHONES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveParentPhoneForStudent(nisn: string, phone: string): void {
  try {
    const current = getSavedParentPhones();
    current[nisn] = phone;
    localStorage.setItem(PARENT_PHONES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function getStudentParentPhone(student: Student): string {
  const map = getSavedParentPhones();
  if (student.parentPhone && student.parentPhone.trim()) {
    return student.parentPhone.trim();
  }
  if (map[student.nisn]) {
    return map[student.nisn];
  }
  // Fallback nomor default berdasarkan urutan NISN
  const suffix = student.nisn.slice(-4) || '0001';
  return `08123456${suffix}`;
}

export function formatPhoneForWaLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  return `62${digits}`;
}

/**
 * Format Pesan WA Otomatis Pukul 07.15 WIB (100% Gratis via Click-to-Chat)
 */
export function buildClosedLoop0715Message(studentName: string): string {
  return `Yth. Orang Tua/Wali Ananda ${studentName}, sampai pukul 07.15 kehadiran Ananda belum tercatat di sekolah. Mohon konfirmasi: 1. Sakit, 2. Izin, 3. Terlambat, 4. Tidak tahu/Sudah Berangkat.`;
}

/**
 * Generasi Link Click-to-Chat WhatsApp Otomatis (`https://wa.me/628...?text=...`)
 */
export function buildClickToChatWaUrl(student: Student, customMessage?: string): string {
  const rawPhone = getStudentParentPhone(student);
  const formattedPhone = formatPhoneForWaLink(rawPhone);
  const message = customMessage || buildClosedLoop0715Message(student.name);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Format Pesan Peringatan EWS 1x Alpa ke WA Orang Tua
 */
export function buildEws1xAlpaMessage(studentName: string, classGrade: string, dateStr: string): string {
  return `Yth. Orang Tua/Wali Ananda ${studentName} (Kelas ${classGrade}), melalui pesan ini kami informasikan bahwa Ananda tercatat 1x Alpa (Tanpa Keterangan) pada tanggal ${dateStr}. Mohon kerja sama Bapak/Ibu untuk memantau kehadiran Ananda di sekolah. Terima kasih.`;
}

/**
 * Format Pesan Peringatan EWS 3x Ketidakhadiran dalam 1 Minggu ke WA Orang Tua
 */
export function buildEws3xWeekMessage(studentName: string, classGrade: string, count: number): string {
  return `Yth. Orang Tua/Wali Ananda ${studentName} (Kelas ${classGrade}), sistem Early Warning System (EWS) sekolah mencatat Ananda telah tidak hadir sebanyak ${count} kali dalam 1 minggu terakhir. Mohon konfirmasi kondisi Ananda kepada Wali Kelas. Terima kasih.`;
}

/**
 * Local Storage & Supabase Sync untuk `wa_logs`
 */
export function getLocalWaLogs(): WaLog[] {
  try {
    const raw = localStorage.getItem(WA_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalWaLogs(logs: WaLog[]): void {
  try {
    localStorage.setItem(WA_LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
}

/**
 * Local Storage & Supabase Sync untuk `ews_alerts`
 */
export function getLocalEwsAlerts(): EwsAlert[] {
  try {
    const raw = localStorage.getItem(EWS_ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalEwsAlerts(alerts: EwsAlert[]): void {
  try {
    localStorage.setItem(EWS_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // ignore
  }
}

export async function fetchWaLogsAndEwsAlertsFromSupabase(): Promise<{
  waLogs: WaLog[];
  ewsAlerts: EwsAlert[];
}> {
  const localWa = getLocalWaLogs();
  const localEws = getLocalEwsAlerts();

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { waLogs: localWa, ewsAlerts: localEws };
  }

  try {
    const [waRes, ewsRes] = await Promise.all([
      supabase.from('wa_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('ews_alerts').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    let mergedWa = localWa;
    if (!waRes.error && Array.isArray(waRes.data)) {
      const map = new Map<string, WaLog>();
      localWa.forEach((item) => map.set(String(item.id), item));
      waRes.data.forEach((dbItem: any) => {
        const existing = map.get(String(dbItem.id));
        map.set(String(dbItem.id), {
          id: String(dbItem.id),
          siswa_id: dbItem.siswa_id,
          phone_number: dbItem.phone_number,
          message_sent: dbItem.message_sent,
          status_reply: dbItem.status_reply || existing?.status_reply || 'PENDING',
          created_at: dbItem.created_at || existing?.created_at || new Date().toISOString(),
          student_name: existing?.student_name,
          class_grade: existing?.class_grade,
        });
      });
      mergedWa = Array.from(map.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      saveLocalWaLogs(mergedWa);
    }

    let mergedEws = localEws;
    if (!ewsRes.error && Array.isArray(ewsRes.data)) {
      const map = new Map<string, EwsAlert>();
      localEws.forEach((item) => map.set(String(item.id), item));
      ewsRes.data.forEach((dbItem: any) => {
        const existing = map.get(String(dbItem.id));
        map.set(String(dbItem.id), {
          id: String(dbItem.id),
          siswa_id: dbItem.siswa_id,
          alert_type: dbItem.alert_type as EwsAlertType,
          severity_level: dbItem.severity_level as EwsSeverityLevel,
          status_action: (dbItem.status_action || existing?.status_action || 'BUTUH TINDAK LANJUT') as EwsActionStatus,
          created_at: dbItem.created_at || existing?.created_at || new Date().toISOString(),
          student_name: existing?.student_name,
          class_grade: existing?.class_grade,
          parent_phone: existing?.parent_phone,
          description: existing?.description,
        });
      });
      mergedEws = Array.from(map.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      saveLocalEwsAlerts(mergedEws);
    }

    return { waLogs: mergedWa, ewsAlerts: mergedEws };
  } catch {
    return { waLogs: localWa, ewsAlerts: localEws };
  }
}

export async function createWaLogEntry(entry: Omit<WaLog, 'id' | 'created_at'>): Promise<WaLog> {
  const newLog: WaLog = {
    ...entry,
    id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  const current = getLocalWaLogs();
  const updated = [newLog, ...current];
  saveLocalWaLogs(updated);

  // Kirim ke Gateway HTTP jika dikonfigurasi oleh sekolah
  const cfg = getWaGatewayConfig();
  if (cfg.enabled && cfg.endpointUrl.trim() && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await fetch(cfg.endpointUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { Authorization: cfg.apiKey } : {}),
        },
        body: JSON.stringify({
          target: entry.phone_number,
          message: entry.message_sent,
          siswa_id: entry.siswa_id,
        }),
      });
    } catch {
      // Gateway eksternal opsional, tetap lanjutkan penyimpanan log
    }
  }

  // Simpan ke tabel `wa_logs` di Supabase secara asinkron (Offline-First safe)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await supabase.from('wa_logs').upsert({
        id: newLog.id,
        siswa_id: newLog.siswa_id,
        phone_number: newLog.phone_number,
        message_sent: newLog.message_sent,
        status_reply: newLog.status_reply,
        created_at: newLog.created_at,
      });
    } catch {
      // Tersimpan aman di localStorage jika tabel belum dibuat / offline
    }
  }

  return newLog;
}

export async function createEwsAlertEntry(
  entry: Omit<EwsAlert, 'id' | 'created_at'>
): Promise<EwsAlert> {
  const current = getLocalEwsAlerts();

  // Cegah duplikasi alert aktif yang sama untuk siswa yang sama pada hari yang sama
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const existingDuplicate = current.find(
    (a) =>
      a.siswa_id === entry.siswa_id &&
      a.alert_type === entry.alert_type &&
      a.status_action === 'BUTUH TINDAK LANJUT' &&
      a.created_at.startsWith(todayPrefix)
  );
  if (existingDuplicate) {
    return existingDuplicate;
  }

  const newAlert: EwsAlert = {
    ...entry,
    id: `ews-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  const updated = [newAlert, ...current];
  saveLocalEwsAlerts(updated);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await supabase.from('ews_alerts').upsert({
        id: newAlert.id,
        siswa_id: newAlert.siswa_id,
        alert_type: newAlert.alert_type,
        severity_level: newAlert.severity_level,
        status_action: newAlert.status_action,
        created_at: newAlert.created_at,
      });
    } catch {
      // Tersimpan aman di localStorage
    }
  }

  return newAlert;
}

export async function updateEwsAlertStatus(
  alertId: string,
  statusAction: EwsActionStatus
): Promise<EwsAlert[]> {
  const current = getLocalEwsAlerts();
  const updated = current.map((a) =>
    a.id === alertId ? { ...a, status_action: statusAction } : a
  );
  saveLocalEwsAlerts(updated);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await supabase
        .from('ews_alerts')
        .update({ status_action: statusAction })
        .eq('id', alertId);
    } catch {
      // ignore
    }
  }

  return updated;
}

/**
 * Mereset / menyelesaikan seluruh status alert aktif milik seorang siswa di `ews_alerts` Supabase & lokal
 * ketika Guru mengklik tombol aksi cepat ([Hadir], [Sakit], [Izin], [Terlambat]).
 */
export async function resetStudentEwsAlerts(siswaId: string): Promise<EwsAlert[]> {
  const current = getLocalEwsAlerts();
  const updated = current.map((a) =>
    a.siswa_id === siswaId && a.status_action === 'BUTUH TINDAK LANJUT'
      ? { ...a, status_action: 'SELESAI' as EwsActionStatus }
      : a
  );
  saveLocalEwsAlerts(updated);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await supabase
        .from('ews_alerts')
        .update({ status_action: 'SELESAI' })
        .eq('siswa_id', siswaId);
    } catch {
      // ignore
    }
  }

  return updated;
}

/**
 * 1A. FUNGSI CRON JOB OTOMATIS PUKUL 07.15 WIB:
 * Mengecek semua siswa yang belum tercatat hadir/absen pada hari tersebut,
 * lalu mengirimkan pesan WA otomatis ke nomor orang tua siswa.
 */
export async function runCronJob0715UnrecordedStudents(params: {
  students: Student[];
  records: AttendanceRecord[];
  holidays: Holiday[];
  dateStr: string;
  selectedClass?: string; // opsional: jika ingin cek per kelas atau seluruh sekolah
}): Promise<{
  sentLogs: WaLog[];
  skippedReason?: string;
}> {
  const { students, records, holidays, dateStr, selectedClass } = params;

  // Cek apakah hari libur atau akhir pekan (Sabtu/Minggu)
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const day = dt.getDay();
    if (day === 0 || day === 6) {
      return { sentLogs: [], skippedReason: 'Akhir pekan (Sabtu/Minggu Libur)' };
    }
  }
  const holiday = holidays.find((h) => h.date === dateStr);
  if (holiday) {
    return { sentLogs: [], skippedReason: `Hari Libur: ${holiday.reason}` };
  }

  const targetStudents =
    selectedClass && selectedClass !== 'all'
      ? students.filter((s) => s.classGrade === selectedClass)
      : students;

  const recordedTodayNisns = new Set(
    records.filter((r) => r.date === dateStr).map((r) => r.studentId)
  );

  // Cari siswa yang belum tercatat hadir/absen sampai pukul 07.15 WIB
  const unrecordedStudents = targetStudents.filter((s) => !recordedTodayNisns.has(s.nisn));

  const sentLogs: WaLog[] = [];
  for (const student of unrecordedStudents) {
    const phone = getStudentParentPhone(student);
    const msg = buildClosedLoop0715Message(student.name);
    const log = await createWaLogEntry({
      siswa_id: student.nisn,
      student_name: student.name,
      class_grade: student.classGrade,
      phone_number: phone,
      message_sent: msg,
      status_reply: 'MENUNGGU BALASAN (1/2/3/4)',
    });
    sentLogs.push(log);
  }

  try {
    localStorage.setItem(CRON_LAST_RUN_DATE_KEY, dateStr);
  } catch {
    // ignore
  }

  return { sentLogs };
}

/**
 * Mencatat log ketika Guru mengklik tombol "Buka WA" (Click-to-Chat Manual Gratis)
 * agar siswa langsung muncul di tabel `wa_logs` untuk ditindaklanjuti saat orang tua membalas.
 */
export async function recordManualClickToChatWaLog(student: Student): Promise<WaLog[]> {
  const phone = getStudentParentPhone(student);
  const formattedPhone = formatPhoneForWaLink(phone);
  const msg = buildClosedLoop0715Message(student.name);
  const current = getLocalWaLogs();
  const todayPrefix = new Date().toISOString().slice(0, 10);

  const existingTodayIdx = current.findIndex(
    (l) => l.siswa_id === student.nisn && l.created_at.startsWith(todayPrefix)
  );

  if (existingTodayIdx !== -1) {
    return current;
  }

  await createWaLogEntry({
    siswa_id: student.nisn,
    student_name: student.name,
    class_grade: student.classGrade,
    phone_number: formattedPhone,
    message_sent: msg,
    status_reply: 'MENUNGGU BALASAN WA ORTU (1/2/3/4)',
  });

  return getLocalWaLogs();
}

/**
 * 1B. PENANGAN AKSI CEPAT DUA ARAH MANUAL & WEBHOOK BALASAN WA:
 * Memproses tombol status cepat Guru ([Hadir], [Sakit], [Izin], [Terlambat], [Sudah Berangkat]):
 * - Mengupdate tabel `sipena_presensi` (dan `presensi`), `wa_logs`, serta mereset status di `ews_alerts` Supabase.
 * - "Hadir" -> Update presensi hari ini menjadi "Hadir" & reset alert di `ews_alerts`
 * - "1" / "Sakit" -> Update presensi hari ini menjadi "Sakit" & reset alert di `ews_alerts`
 * - "2" / "Izin" -> Update presensi hari ini menjadi "Izin" & reset alert di `ews_alerts`
 * - "3" / "Terlambat" -> Update presensi hari ini menjadi "Terlambat" & reset alert di `ews_alerts`
 * - "4" / "Tidak tahu" / "Sudah Berangkat" -> Buat status khusus "BUTUH TINDAK LANJUT" & picu ALERT MERAH Guru/Wali Kelas
 */
export async function handleIncomingWhatsappWebhook(params: {
  student: Student;
  rawReply: string;
  dateStr: string;
}): Promise<{
  mappedStatus: AttendanceStatus;
  replyLabel: string;
  triggeredRedAlert: EwsAlert | null;
  updatedWaLogs: WaLog[];
}> {
  const { student, rawReply, dateStr } = params;
  const normalized = rawReply.trim().toLowerCase();

  let mappedStatus: AttendanceStatus = 'Hadir';
  let replyLabel = '';
  let isCriticalFollowUp = false;

  if (normalized === 'hadir' || normalized === 'h') {
    mappedStatus = 'Hadir';
    replyLabel = 'Hadir (Dikonfirmasi Guru via WA)';
  } else if (normalized === '1' || normalized.includes('sakit')) {
    mappedStatus = 'Sakit';
    replyLabel = '1 - Sakit (Dikonfirmasi via WA: Sakit)';
  } else if (normalized === '2' || normalized.includes('izin') || normalized.includes('ijin')) {
    mappedStatus = 'Izin';
    replyLabel = '2 - Izin (Dikonfirmasi via WA: Izin)';
  } else if (normalized === '3' || normalized.includes('terlambat') || normalized.includes('telat')) {
    mappedStatus = 'Terlambat';
    replyLabel = '3 - Terlambat (Dikonfirmasi via WA: Terlambat)';
  } else if (
    normalized === '4' ||
    normalized.includes('tidak tahu') ||
    normalized.includes('sudah berangkat')
  ) {
    mappedStatus = 'Butuh Tindak Lanjut';
    replyLabel = '4 - Sudah Berangkat / Tidak Tahu (BUTUH TINDAK LANJUT)';
    isCriticalFollowUp = true;
  } else {
    throw new Error(
      'Pilih salah satu aksi cepat: Hadir, Sakit, Izin, Terlambat, atau Sudah Berangkat.'
    );
  }

  const phone = formatPhoneForWaLink(getStudentParentPhone(student));

  // Update juga tabel `sipena_presensi` di Supabase jika tersedia
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const nowTime = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    try {
      await supabase.from('sipena_presensi').upsert({
        nisn_siswa: student.nisn,
        created_at: `${dateStr}T${nowTime}+07:00`,
        status: mappedStatus,
      });
    } catch {
      // Tabel utama `presensi` juga di-update melalui alur Offline-First di App.tsx
    }
  }

  // Perbarui wa_logs terbaru untuk siswa ini (atau buat entri log baru jika belum ada)
  const currentLogs = getLocalWaLogs();
  const existingLogIdx = currentLogs.findIndex((l) => l.siswa_id === student.nisn);

  let updatedWaLogs: WaLog[];
  if (existingLogIdx !== -1) {
    const targetLog = {
      ...currentLogs[existingLogIdx],
      status_reply: replyLabel,
    };
    updatedWaLogs = [...currentLogs];
    updatedWaLogs[existingLogIdx] = targetLog;
    saveLocalWaLogs(updatedWaLogs);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase
          .from('wa_logs')
          .update({ status_reply: replyLabel })
          .eq('id', targetLog.id);
      } catch {
        // ignore
      }
    }
  } else {
    const created = await createWaLogEntry({
      siswa_id: student.nisn,
      student_name: student.name,
      class_grade: student.classGrade,
      phone_number: phone,
      message_sent: buildClosedLoop0715Message(student.name),
      status_reply: replyLabel,
    });
    updatedWaLogs = [created, ...currentLogs];
  }

  // Jika "Sudah Berangkat" (Balasan #4), buat ALERT MERAH di `ews_alerts`.
  // Jika Hadir / Sakit / Izin / Terlambat, otomatis reset status alert di `ews_alerts` menjadi SELESAI!
  let triggeredRedAlert: EwsAlert | null = null;
  if (isCriticalFollowUp) {
    triggeredRedAlert = await createEwsAlertEntry({
      siswa_id: student.nisn,
      student_name: student.name,
      class_grade: student.classGrade,
      parent_phone: phone,
      alert_type: 'WA_CLOSED_LOOP_4',
      severity_level: 'RED',
      status_action: 'BUTUH TINDAK LANJUT',
      description: `PERLU TINDAK LANJUT: Orang tua ${student.name} (Kelas ${student.classGrade}) menyatakan anak sudah berangkat, tetapi belum tercatat di sekolah.`,
    });
  } else {
    await resetStudentEwsAlerts(student.nisn);
  }

  return {
    mappedStatus,
    replyLabel,
    triggeredRedAlert,
    updatedWaLogs,
  };
}

/**
 * 3. MODUL DETEKSI INDIKATOR EARLY WARNING SYSTEM (EWS):
 * Mengevaluasi riwayat presensi setiap siswa terhadap 4 kriteria EWS:
 * - 1x Alpa -> Kirim Notifikasi Peringatan ke WA Orang Tua
 * - 2x Alpa Berturut-turut -> Tampilkan Peringatan Kuning di Dashboard Guru
 * - 3x Ketidakhadiran dalam 1 Minggu -> Tampilkan Alert Merah Wali Kelas & rekomendasi kontak via WA
 * - 5x Ketidakhadiran dalam 1 Bulan -> Tampilkan rekomendasi "Cetak Surat Panggilan Orang Tua / Laporan Bimbingan Konseling (BK)"
 */
export function evaluateStudentEwsIndicators(
  students: Student[],
  records: AttendanceRecord[],
  activeEwsAlerts: EwsAlert[],
  referenceDateStr?: string
): Map<string, StudentEwsIndicator> {
  const resultMap = new Map<string, StudentEwsIndicator>();

  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const refYear = refDate.getFullYear();
  const refMonth = String(refDate.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `${refYear}-${refMonth}`;

  // Hitung batas 7 hari terakhir untuk kriteria "1 Minggu"
  const oneWeekAgo = new Date(refDate);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekStartStr = `${oneWeekAgo.getFullYear()}-${String(oneWeekAgo.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(oneWeekAgo.getDate()).padStart(2, '0')}`;
  const refDateKey = `${refYear}-${refMonth}-${String(refDate.getDate()).padStart(2, '0')}`;

  students.forEach((student) => {
    const phone = getStudentParentPhone(student);

    // Ambil rekaman siswa dan urutkan berdasarkan tanggal (terlama ke terbaru)
    const studentRecords = records
      .filter((r) => r.studentId === student.nisn || r.studentId === student.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Deduplikasi per tanggal
    const byDate = new Map<string, AttendanceStatus>();
    studentRecords.forEach((r) => {
      byDate.set(r.date, r.status);
    });

    const sortedEntries = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // 1) Hitung Alpa & Ketidakhadiran (Sakit/Izin/Alpa) dalam Bulan berjalan
    let alpaCountMonth = 0;
    let absentCountMonth = 0;

    // 2) Hitung Ketidakhadiran dalam 1 Minggu terakhir (7 hari kalender)
    let absentCountWeek = 0;

    // 3) Hitung Alpa berturut-turut maksimum / terkini
    let currentConsecutiveAlpa = 0;
    let maxConsecutiveAlpa = 0;

    sortedEntries.forEach(([date, status]) => {
      const isAbsent = status === 'Alpa' || status === 'Sakit' || status === 'Izin';

      if (date.startsWith(monthPrefix)) {
        if (status === 'Alpa') alpaCountMonth++;
        if (isAbsent) absentCountMonth++;
      }

      if (date >= weekStartStr && date <= refDateKey && isAbsent) {
        absentCountWeek++;
      }

      if (status === 'Alpa') {
        currentConsecutiveAlpa++;
        if (currentConsecutiveAlpa > maxConsecutiveAlpa) {
          maxConsecutiveAlpa = currentConsecutiveAlpa;
        }
      } else if (status === 'Hadir' || status === 'Terlambat') {
        currentConsecutiveAlpa = 0;
      }
    });

    // Cek apakah ada Alert Balasan WA "4" (Tidak tahu / Sudah berangkat) yang aktif
    const needsFollowUpReply4 =
      activeEwsAlerts.some(
        (a) =>
          a.siswa_id === student.nisn &&
          a.alert_type === 'WA_CLOSED_LOOP_4' &&
          a.status_action === 'BUTUH TINDAK LANJUT'
      ) || sortedEntries.some(([d, st]) => d === refDateKey && st === 'Butuh Tindak Lanjut');

    const badges: StudentEwsIndicator['badges'] = [];

    if (needsFollowUpReply4) {
      badges.push({
        type: 'WA_CLOSED_LOOP_4',
        severity: 'RED',
        shortLabel: 'BUTUH TINDAK LANJUT',
        fullTitle: 'Konfirmasi WA #4: Anak Sudah Berangkat Namun Belum Tercatat di Sekolah',
        recommendation: 'Segera verifikasi keberadaan siswa di kelas & hubungi orang tua.',
        count: 1,
      });
    }

    // Kriteria 4: 5x Ketidakhadiran dalam 1 Bulan
    if (absentCountMonth >= 5) {
      badges.push({
        type: 'ABSENT_5X_MONTH',
        severity: 'CRITICAL',
        shortLabel: `EWS: ${absentCountMonth}x Absen/Bln (Panggilan BK)`,
        fullTitle: `${absentCountMonth}x Ketidakhadiran dalam 1 Bulan`,
        recommendation: 'Cetak Surat Panggilan Orang Tua / Laporan Bimbingan Konseling (BK)',
        count: absentCountMonth,
      });
    }

    // Kriteria 3: 3x Ketidakhadiran dalam 1 Minggu
    if (absentCountWeek >= 3) {
      badges.push({
        type: 'ABSENT_3X_WEEK',
        severity: 'RED',
        shortLabel: `EWS: ${absentCountWeek}x Absen/Mgg`,
        fullTitle: `${absentCountWeek}x Ketidakhadiran dalam 1 Minggu`,
        recommendation: 'Alert Merah Wali Kelas & Rekomendasi Kontak via WhatsApp',
        count: absentCountWeek,
      });
    }

    // Kriteria 2: 2x Alpa Berturut-turut
    if (maxConsecutiveAlpa >= 2) {
      badges.push({
        type: 'ALPA_2X_CONSECUTIVE',
        severity: 'YELLOW',
        shortLabel: `EWS: ${maxConsecutiveAlpa}x Alpa Beruntun`,
        fullTitle: `${maxConsecutiveAlpa}x Alpa Berturut-turut`,
        recommendation: 'Peringatan Kuning di Dashboard Guru — Pantau & Konfirmasi Wali Murid',
        count: maxConsecutiveAlpa,
      });
    }

    // Kriteria 1: 1x Alpa
    if (alpaCountMonth >= 1 && maxConsecutiveAlpa < 2) {
      badges.push({
        type: 'ALPA_1X',
        severity: 'INFO',
        shortLabel: `EWS: ${alpaCountMonth}x Alpa`,
        fullTitle: `Tercatat ${alpaCountMonth}x Alpa (Tanpa Keterangan)`,
        recommendation: 'Kirim Notifikasi Peringatan ke WA Orang Tua',
        count: alpaCountMonth,
      });
    }

    let highestSeverity: EwsSeverityLevel | null = null;
    if (badges.some((b) => b.severity === 'CRITICAL')) highestSeverity = 'CRITICAL';
    else if (badges.some((b) => b.severity === 'RED')) highestSeverity = 'RED';
    else if (badges.some((b) => b.severity === 'YELLOW')) highestSeverity = 'YELLOW';
    else if (badges.some((b) => b.severity === 'INFO')) highestSeverity = 'INFO';

    const indicator: StudentEwsIndicator = {
      studentId: student.nisn,
      studentName: student.name,
      classGrade: student.classGrade,
      parentPhone: phone,
      highestSeverity,
      badges,
      alpaCountMonth,
      consecutiveAlpa: maxConsecutiveAlpa,
      absentCountWeek,
      absentCountMonth,
      needsFollowUpReply4,
    };

    resultMap.set(student.nisn, indicator);
    resultMap.set(String(student.id), indicator);
  });

  return resultMap;
}
