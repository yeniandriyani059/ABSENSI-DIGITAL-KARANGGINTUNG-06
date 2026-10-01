import { supabase } from '../supabaseClient';
import { AttendanceRecord, AttendanceStatus, Holiday, Student } from '../types';

export const OFFLINE_QUEUE_KEY = 'offline_sync_queue';
export const CACHED_STUDENTS_KEY = 'sdn06_cached_students';
export const CACHED_RECORDS_KEY = 'sdn06_cached_records';

/**
 * Menormalisasi status kehadiran agar nilai singkatan ('H', 'T', 'S', 'I', 'A')
 * maupun teks penuh selalu konsisten menjadi 'Hadir' | 'Terlambat' | 'Sakit' | 'Izin' | 'Alpa'.
 */
export function normalizeAttendanceStatus(raw: any): AttendanceStatus {
  const str = String(raw || '').trim();
  const lower = str.toLowerCase();
  if (str === 'H' || lower === 'hadir') return 'Hadir';
  if (str === 'T' || lower === 'terlambat' || lower === 'telat') return 'Terlambat';
  if (str === 'S' || lower === 'sakit') return 'Sakit';
  if (str === 'I' || lower === 'izin' || lower === 'ijin') return 'Izin';
  if (str === 'A' || lower === 'alpa' || lower === 'alpha') return 'Alpa';
  if (lower.includes('tindak lanjut')) return 'Butuh Tindak Lanjut';
  return 'Hadir';
}

/**
 * Mengonversi timestamp ISO dari Supabase (`created_at`) ke tanggal & jam WIB (UTC+7) secara akurat.
 */
export function extractWibDateAndTime(isoString?: string, fallbackDate?: string): {
  dateStr: string;
  timeStr: string;
} {
  if (!isoString) {
    const now = new Date(Date.now() + 7 * 3600 * 1000);
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return {
      dateStr: fallbackDate || `${y}-${m}-${d}`,
      timeStr: '07:00:00',
    };
  }

  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return {
      dateStr: fallbackDate || String(isoString).slice(0, 10),
      timeStr: '07:00:00',
    };
  }

  // Tambahkan offset +07:00 (WIB) agar pembacaan tanggal tidak meleset ke hari sebelumnya saat jam < 07:00 pagi
  const wibTime = new Date(parsed.getTime() + 7 * 3600 * 1000);
  const y = wibTime.getUTCFullYear();
  const m = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wibTime.getUTCDate()).padStart(2, '0');
  const hh = String(wibTime.getUTCHours()).padStart(2, '0');
  const mm = String(wibTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(wibTime.getUTCSeconds()).padStart(2, '0');

  return {
    dateStr: fallbackDate || `${y}-${m}-${d}`,
    timeStr: `${hh}:${mm}:${ss}`,
  };
}

export interface OfflineAttendanceQueueItem {
  queueId: string; // unique key per student + date: `${siswa_id}_${tanggal}`
  payload: {
    id?: any;
    siswa_id: string;
    tanggal: string;
    nisn_siswa?: string;
    created_at: string;
    status: AttendanceStatus;
  };
  record: AttendanceRecord;
  queuedAt: string;
}

/**
 * Membaca antrean presensi offline dari localStorage (`offline_sync_queue`)
 */
export function getOfflineQueue(): OfflineAttendanceQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Gagal membaca offline_sync_queue dari localStorage:', err);
    return [];
  }
}

/**
 * Menyimpan daftar antrean presensi offline ke localStorage (`offline_sync_queue`)
 */
export function setOfflineQueue(queue: OfflineAttendanceQueueItem[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error('Gagal menyimpan offline_sync_queue ke localStorage:', err);
  }
}

/**
 * Menambahkan satu atau banyak rekaman presensi ke dalam `offline_sync_queue`.
 * Melakukan deduplikasi berdasarkan kombinasi NISN siswa dan tanggal presensi
 * agar pembaruan status saat offline selalu menggunakan status terbaru.
 */
export function enqueueOfflineAttendance(recordsToQueue: AttendanceRecord[]): OfflineAttendanceQueueItem[] {
  const currentQueue = getOfflineQueue();
  const queueMap = new Map<string, OfflineAttendanceQueueItem>();

  currentQueue.forEach((item) => {
    queueMap.set(item.queueId, item);
  });

  const nowIso = new Date().toISOString();

  recordsToQueue.forEach((r) => {
    const cleanTime = (r.scannedAt || '07:00:00').replace(/\./g, ':');
    const payload: OfflineAttendanceQueueItem['payload'] = {
      siswa_id: r.studentId,
      tanggal: r.date,
      nisn_siswa: r.studentId,
      created_at: `${r.date}T${cleanTime}+07:00`,
      status: r.status,
    };

    if (typeof r.id === 'number' || (typeof r.id === 'string' && !r.id.startsWith('att-'))) {
      payload.id = r.id;
    }

    const queueId = `${r.studentId}_${r.date}`;
    queueMap.set(queueId, {
      queueId,
      payload,
      record: {
        ...r,
        scannedAt: r.scannedAt || '07:00:00',
      },
      queuedAt: nowIso,
    });
  });

  const updatedQueue = Array.from(queueMap.values());
  setOfflineQueue(updatedQueue);
  return updatedQueue;
}

/**
 * Menghapus rekaman dari antrean offline jika pengguna menghapus rekaman tersebut
 */
export function removeRecordFromOfflineQueue(
  recordId?: string,
  studentId?: string,
  date?: string
): void {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const filtered = queue.filter((item) => {
    if (recordId && String(item.record.id) === String(recordId)) return false;
    if (studentId && date && item.queueId === `${studentId}_${date}`) return false;
    return true;
  });

  if (filtered.length !== queue.length) {
    setOfflineQueue(filtered);
  }
}

/**
 * Menggabungkan rekaman dari server/cache dengan antrean offline yang belum tersinkronisasi
 */
export function mergeRecordsWithOfflineQueue(baseRecords: AttendanceRecord[]): AttendanceRecord[] {
  const queue = getOfflineQueue();
  if (queue.length === 0) return baseRecords;

  const recordMap = new Map<string, AttendanceRecord>();
  baseRecords.forEach((r) => {
    recordMap.set(`${r.studentId}_${r.date}`, r);
  });

  queue.forEach((item) => {
    const existing = recordMap.get(item.queueId);
    recordMap.set(item.queueId, {
      ...item.record,
      id: existing?.id && !String(existing.id).startsWith('att-') ? existing.id : item.record.id,
    });
  });

  return Array.from(recordMap.values());
}

/**
 * Cache lokal untuk data siswa & presensi agar aplikasi tetap berfungsi penuh saat dibuka dalam kondisi offline
 */
export function getCachedStudents(): Student[] | null {
  try {
    const raw = localStorage.getItem(CACHED_STUDENTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedStudents(students: Student[]): void {
  try {
    localStorage.setItem(CACHED_STUDENTS_KEY, JSON.stringify(students));
  } catch {
    // Abaikan jika storage penuh
  }
}

export function getCachedRecords(): AttendanceRecord[] | null {
  try {
    const raw = localStorage.getItem(CACHED_RECORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedRecords(records: AttendanceRecord[]): void {
  try {
    localStorage.setItem(CACHED_RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Abaikan jika storage penuh
  }
}

/**
 * Menyimpan / memperbarui rekaman presensi (Hadir, Terlambat, Sakit, Izin, Alpa) ke tabel `presensi` di Supabase
 * dengan memisahkan baris UPDATE (yang sudah memiliki ID di database) dan baris INSERT (baru),
 * sehingga tidak pernah gagal akibat perbedaan key objek (PGRST102) dan tidak menimbulkan duplikasi data.
 */
export async function upsertAttendanceRecordsToSupabase(
  recordsToSave: AttendanceRecord[]
): Promise<void> {
  if (recordsToSave.length === 0) return;

  // Kumpulkan tanggal unik dari rekaman yang akan disimpan
  const uniqueDates = Array.from(new Set(recordsToSave.map((r) => r.date).filter(Boolean)));

  // Peta rekaman yang sudah ada di Supabase berdasarkan `${nisn_siswa}_${date}`
  const existingDbMap = new Map<string, { id: any; created_at: string }>();

  for (const dStr of uniqueDates) {
    const startWib = `${dStr}T00:00:00+07:00`;
    const endWib = `${dStr}T23:59:59+07:00`;
    const { data: existingRows, error: fetchErr } = await supabase
      .from('presensi')
      .select('*')
      .gte('created_at', startWib)
      .lte('created_at', endWib)
      .order('id', { ascending: true });

    if (!fetchErr && Array.isArray(existingRows)) {
      existingRows.forEach((row: any) => {
        const studentKey = String(row.nisn_siswa || row.siswa_id || '');
        if (studentKey) {
          existingDbMap.set(`${studentKey}_${dStr}`, {
            id: row.id,
            created_at: row.created_at,
          });
        }
      });
    }
  }

  // Deduplikasi input berdasarkan `${studentId}_${date}`
  const dedupedInput = new Map<string, AttendanceRecord>();
  recordsToSave.forEach((r) => {
    dedupedInput.set(`${r.studentId}_${r.date}`, {
      ...r,
      status: normalizeAttendanceStatus(r.status),
    });
  });

  const toUpdateNisnSchema: Array<{
    id: any;
    nisn_siswa: string;
    created_at: string;
    status: AttendanceStatus;
  }> = [];

  const toInsertNisnSchema: Array<{
    nisn_siswa: string;
    created_at: string;
    status: AttendanceStatus;
  }> = [];

  dedupedInput.forEach((r, key) => {
    const cleanTime = (r.scannedAt || '07:00:00').replace(/\./g, ':') || '07:00:00';
    const computedCreatedAt = `${r.date}T${cleanTime}+07:00`;
    const existing = existingDbMap.get(key);
    const hasValidRecordId =
      typeof r.id === 'number' ||
      (typeof r.id === 'string' && r.id.trim() !== '' && !r.id.startsWith('att-'));

    const resolvedId = existing?.id ?? (hasValidRecordId ? r.id : undefined);

    if (resolvedId !== undefined) {
      toUpdateNisnSchema.push({
        id: resolvedId,
        nisn_siswa: r.studentId,
        created_at: existing?.created_at || computedCreatedAt,
        status: r.status,
      });
    } else {
      toInsertNisnSchema.push({
        nisn_siswa: r.studentId,
        created_at: computedCreatedAt,
        status: r.status,
      });
    }
  });

  // 1. Jalankan UPDATE untuk baris yang sudah ada di tabel `presensi`
  if (toUpdateNisnSchema.length > 0) {
    const { error: updateErr } = await supabase
      .from('presensi')
      .upsert(toUpdateNisnSchema, { onConflict: 'id' })
      .select();

    if (updateErr) {
      // Fallback jika skema menggunakan siswa_id & tanggal
      const altUpdate = toUpdateNisnSchema.map((u) => ({
        id: u.id,
        siswa_id: u.nisn_siswa,
        tanggal: extractWibDateAndTime(u.created_at).dateStr,
        status: u.status,
        created_at: u.created_at,
      }));
      const { error: altErr } = await supabase
        .from('presensi')
        .upsert(altUpdate, { onConflict: 'id' })
        .select();
      if (altErr) throw updateErr;
    }
  }

  // 2. Jalankan INSERT murni (tanpa properti `id`) untuk baris baru
  if (toInsertNisnSchema.length > 0) {
    const { error: insertErr } = await supabase
      .from('presensi')
      .insert(toInsertNisnSchema)
      .select();

    if (insertErr) {
      const altInsert = toInsertNisnSchema.map((ins) => ({
        siswa_id: ins.nisn_siswa,
        tanggal: extractWibDateAndTime(ins.created_at).dateStr,
        status: ins.status,
        created_at: ins.created_at,
      }));
      const { error: altInsErr } = await supabase
        .from('presensi')
        .insert(altInsert)
        .select();
      if (altInsErr) throw insertErr;
    }
  }
}

/**
 * Memproses antrean presensi di `localStorage` (`offline_sync_queue`) dan mengirimkannya ke Supabase.
 * Jika berhasil tersimpan di database cloud, antrean yang berhasil akan dihapus dari `localStorage`.
 */
export async function syncOfflineQueueToSupabase(): Promise<{
  syncedCount: number;
  remainingCount: number;
  success: boolean;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const q = getOfflineQueue();
    return { syncedCount: 0, remainingCount: q.length, success: false };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, remainingCount: 0, success: true };
  }

  try {
    const recordsToSync: AttendanceRecord[] = queue.map((item) => ({
      id: item.payload.id ?? item.record.id,
      studentId: item.payload.siswa_id || item.payload.nisn_siswa || item.record.studentId,
      date: item.payload.tanggal || item.record.date,
      status: normalizeAttendanceStatus(item.payload.status || item.record.status),
      scannedAt: item.record.scannedAt || '07:00:00',
    }));

    await upsertAttendanceRecordsToSupabase(recordsToSync);

    // Hapus item yang sudah berhasil disinkronkan
    const latestQueue = getOfflineQueue();
    const syncedIds = new Set(queue.map((q) => `${q.queueId}_${q.queuedAt}`));
    const remaining = latestQueue.filter((q) => !syncedIds.has(`${q.queueId}_${q.queuedAt}`));

    setOfflineQueue(remaining);

    return {
      syncedCount: queue.length,
      remainingCount: remaining.length,
      success: true,
    };
  } catch (err) {
    console.warn('Sinkronisasi latar belakang tertunda, akan dicoba kembali saat koneksi stabil:', err);
    return {
      syncedCount: 0,
      remainingCount: queue.length,
      success: false,
    };
  }
}
