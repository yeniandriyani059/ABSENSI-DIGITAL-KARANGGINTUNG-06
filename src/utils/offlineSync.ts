import { supabase } from '../supabaseClient';
import { AttendanceRecord, AttendanceStatus, Student } from '../types';

export const OFFLINE_QUEUE_KEY = 'offline_sync_queue';
export const CACHED_STUDENTS_KEY = 'sdn06_cached_students';
export const CACHED_RECORDS_KEY = 'sdn06_cached_records';

export interface OfflineAttendanceQueueItem {
  queueId: string; // unique key per student + date: `${nisn_siswa}_${date}`
  payload: {
    id?: any;
    nisn_siswa: string;
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
    const payloads = queue.map((item) => {
      const dbPayload: Record<string, any> = {
        nisn_siswa: item.payload.nisn_siswa,
        created_at: item.payload.created_at,
        status: item.payload.status,
      };
      if (
        typeof item.payload.id === 'number' ||
        (typeof item.payload.id === 'string' && !item.payload.id.startsWith('att-'))
      ) {
        dbPayload.id = item.payload.id;
      }
      return dbPayload;
    });

    const { error } = await supabase.from('presensi').upsert(payloads).select();
    if (error) throw error;

    // Hapus item yang sudah berhasil disinkronkan
    // (Cek apakah ada item baru yang masuk saat request sedang berjalan)
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
