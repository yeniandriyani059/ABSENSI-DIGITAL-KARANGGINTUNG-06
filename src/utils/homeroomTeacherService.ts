import { supabase } from '../supabaseClient';
import { HomeroomTeacher } from '../types';

export const WALI_KELAS_TABLE = 'wali_kelas';
const WALI_KELAS_CACHE_KEY = 'sdn06_wali_kelas_cache_v1';

export const CLASS_GRADES = ['1', '2', '3', '4', '5', '6'] as const;

export const DEFAULT_HOMEROOM_TEACHERS: HomeroomTeacher[] = [
  { kelas: '1', nama_guru: 'Siti Aminah, S.Pd.SD.', nip: '19820412 200801 2 009' },
  { kelas: '2', nama_guru: 'Rina Wahyuni, S.Pd.', nip: '19850719 201001 2 014' },
  { kelas: '3', nama_guru: 'Ahmad Fauzi, S.Pd.', nip: '19861105 201101 1 007' },
  { kelas: '4', nama_guru: 'Nurul Hidayati, S.Pd.', nip: '19870322 201101 2 015' },
  { kelas: '5', nama_guru: 'Budi Santoso, S.Pd.', nip: '19830914 200902 1 005' },
  { kelas: '6', nama_guru: 'Dewi Ratnasari, S.Pd.SD.', nip: '19810228 200604 2 011' },
];

/**
 * Normalisasi nilai kolom `kelas` dari database (misal: "Kelas 2" -> "2", "2" -> "2").
 */
export function normalizeClassGrade(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  const match = str.match(/(\d+)/);
  return match ? match[1] : str;
}

export function getCachedHomeroomTeachers(): HomeroomTeacher[] {
  if (typeof window === 'undefined') return DEFAULT_HOMEROOM_TEACHERS;
  try {
    const raw = window.localStorage.getItem(WALI_KELAS_CACHE_KEY);
    if (!raw) return DEFAULT_HOMEROOM_TEACHERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return mergeWithDefaultClasses(parsed);
    }
  } catch {
    // ignore parse error
  }
  return DEFAULT_HOMEROOM_TEACHERS;
}

export function cacheHomeroomTeachers(teachers: HomeroomTeacher[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WALI_KELAS_CACHE_KEY, JSON.stringify(teachers));
  } catch {
    // ignore storage error
  }
}

/**
 * Memastikan daftar wali kelas selalu memiliki 6 baris berurutan (Kelas 1 s/d Kelas 6).
 */
export function mergeWithDefaultClasses(rows: any[]): HomeroomTeacher[] {
  const byClass = new Map<string, HomeroomTeacher>();

  for (const row of rows) {
    const normKelas = normalizeClassGrade(row.kelas);
    if (!normKelas) continue;
    byClass.set(normKelas, {
      id: row.id,
      kelas: normKelas,
      rawKelas: String(row.kelas),
      nama_guru: row.nama_guru ?? row.nama ?? '',
      nip: row.nip ?? row.nip_guru ?? '',
    });
  }

  return CLASS_GRADES.map((grade) => {
    const found = byClass.get(grade);
    const fallback = DEFAULT_HOMEROOM_TEACHERS.find((d) => d.kelas === grade)!;
    if (found) {
      return {
        id: found.id,
        kelas: grade,
        rawKelas: found.rawKelas || grade,
        nama_guru: found.nama_guru !== undefined ? found.nama_guru : fallback.nama_guru,
        nip: found.nip !== undefined ? found.nip : fallback.nip,
      };
    }
    return { ...fallback };
  });
}

/**
 * Mengambil seluruh daftar Wali Kelas (Kelas 1 s/d Kelas 6) dari tabel `wali_kelas` di Supabase.
 */
export async function fetchHomeroomTeachersFromSupabase(): Promise<{
  teachers: HomeroomTeacher[];
  error?: string;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { teachers: getCachedHomeroomTeachers() };
  }

  try {
    const { data, error } = await supabase
      .from(WALI_KELAS_TABLE)
      .select('*')
      .order('kelas', { ascending: true });

    if (error) {
      console.warn('Supabase fetchHomeroomTeachers error:', error.message);
      return {
        teachers: getCachedHomeroomTeachers(),
        error: error.message,
      };
    }

    if (data && data.length > 0) {
      const merged = mergeWithDefaultClasses(data);
      cacheHomeroomTeachers(merged);
      return { teachers: merged };
    }

    const cached = getCachedHomeroomTeachers();
    return { teachers: cached };
  } catch (err: any) {
    console.warn('Unexpected error fetching wali_kelas:', err);
    return {
      teachers: getCachedHomeroomTeachers(),
      error: err?.message,
    };
  }
}

/**
 * Mengambil data `nama_guru` dan `nip` dari tabel `wali_kelas` secara dinamis
 * untuk kelas tertentu (misal saat pengguna memilih "Kelas 1", "Kelas 2", dst.).
 */
export async function fetchHomeroomTeacherByClass(
  classGrade: string
): Promise<HomeroomTeacher | null> {
  const normGrade = normalizeClassGrade(classGrade) || '1';
  const cachedList = getCachedHomeroomTeachers();
  const cachedMatch = cachedList.find((t) => normalizeClassGrade(t.kelas) === normGrade) || null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return cachedMatch;
  }

  try {
    // Cari baik dengan format "2" maupun "Kelas 2" agar selalu cocok dengan isi tabel wali_kelas di Supabase
    const possibleValues = [normGrade, `Kelas ${normGrade}`, `KELAS ${normGrade}`, `kelas ${normGrade}`];
    const { data, error } = await supabase
      .from(WALI_KELAS_TABLE)
      .select('*')
      .in('kelas', possibleValues)
      .limit(1);

    if (!error && data && data.length > 0) {
      const row = data[0];
      const teacher: HomeroomTeacher = {
        id: row.id,
        kelas: normGrade,
        rawKelas: String(row.kelas),
        nama_guru: row.nama_guru ?? row.nama ?? '',
        nip: row.nip ?? row.nip_guru ?? '',
      };

      // Perbarui cache lokal untuk kelas ini
      const updatedCache = cachedList.map((item) =>
        normalizeClassGrade(item.kelas) === normGrade ? teacher : item
      );
      cacheHomeroomTeachers(updatedCache);

      return teacher;
    }
  } catch (err) {
    console.warn(`Gagal mengambil wali_kelas untuk kelas ${classGrade}:`, err);
  }

  return cachedMatch;
}

/**
 * Menyimpan/memperbarui data Wali Kelas (Kelas 1 s/d Kelas 6) langsung ke tabel `wali_kelas`
 * di Supabase berdasarkan kolom `kelas`.
 */
export async function saveHomeroomTeachersToSupabase(
  teachers: HomeroomTeacher[]
): Promise<{
  success: boolean;
  teachers: HomeroomTeacher[];
  error?: string;
}> {
  const normalizedList = mergeWithDefaultClasses(teachers);
  cacheHomeroomTeachers(normalizedList);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      success: true,
      teachers: normalizedList,
    };
  }

  try {
    // Ambil baris yang sudah ada di tabel `wali_kelas` untuk mencocokkan nilai kolom `kelas`
    const { data: existingRows, error: selectErr } = await supabase
      .from(WALI_KELAS_TABLE)
      .select('*');

    if (selectErr) {
      throw selectErr;
    }

    const existingMap = new Map<string, any>();
    (existingRows || []).forEach((row: any) => {
      const norm = normalizeClassGrade(row.kelas);
      if (norm) {
        existingMap.set(norm, row);
      }
    });

    for (const item of normalizedList) {
      const norm = normalizeClassGrade(item.kelas);
      const existing = existingMap.get(norm);

      if (existing) {
        const targetKelasValue = existing.kelas; // Gunakan nilai persis di DB (misal "1" atau "Kelas 1")
        const { error: updateErr } = await supabase
          .from(WALI_KELAS_TABLE)
          .update({
            nama_guru: item.nama_guru.trim(),
            nip: item.nip.trim(),
          })
          .eq('kelas', targetKelasValue);

        if (updateErr) {
          throw updateErr;
        }
      } else {
        const { error: insertErr } = await supabase.from(WALI_KELAS_TABLE).insert([
          {
            kelas: norm,
            nama_guru: item.nama_guru.trim(),
            nip: item.nip.trim(),
          },
        ]);

        if (insertErr) {
          // Jika gagal insert (misal sudah ada baris dengan "Kelas X"), coba update dengan .in('kelas', ...)
          const { error: fallbackUpdateErr } = await supabase
            .from(WALI_KELAS_TABLE)
            .update({
              nama_guru: item.nama_guru.trim(),
              nip: item.nip.trim(),
            })
            .in('kelas', [norm, `Kelas ${norm}`]);

          if (fallbackUpdateErr) {
            throw insertErr;
          }
        }
      }
    }

    // Muat ulang dari Supabase untuk memastikan sinkronisasi penuh
    const refreshed = await fetchHomeroomTeachersFromSupabase();
    return {
      success: true,
      teachers: refreshed.teachers,
    };
  } catch (err: any) {
    console.error('Error saving wali_kelas to Supabase:', err);
    return {
      success: false,
      teachers: normalizedList,
      error: err?.message || 'Gagal menyimpan data Wali Kelas ke tabel wali_kelas di Supabase.',
    };
  }
}
