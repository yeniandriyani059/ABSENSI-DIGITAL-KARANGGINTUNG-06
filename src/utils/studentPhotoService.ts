import { supabase } from '../supabaseClient';
import { compressAndResizeImage } from './imageExport';

export const STUDENT_PHOTO_BUCKET = 'foto_siswa';

/**
 * Mengunggah file foto siswa dari HP/Laptop ke Supabase Storage Bucket `foto_siswa`,
 * mengambil `publicUrl`, dan menyimpannya ke kolom `foto_url` pada tabel `siswa`
 * agar foto otomatis tersinkronisasi lintas perangkat (HP & Laptop).
 */
export async function uploadStudentPhotoToSupabase(
  file: File,
  nisn: string,
  studentId?: string | number
): Promise<{
  publicUrl: string;
  uploadedToBucket: boolean;
}> {
  const safeNisn = (nisn || 'siswa').replace(/[^a-zA-Z0-9_-]/g, '');
  const ext =
    (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const filePath = `${safeNisn}/foto_${safeNisn}_${Date.now()}.${ext}`;

  let finalFotoUrl = '';
  let uploadedToBucket = false;

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const { error: uploadError } = await supabase.storage
        .from(STUDENT_PHOTO_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from(STUDENT_PHOTO_BUCKET)
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          finalFotoUrl = urlData.publicUrl;
          uploadedToBucket = true;
        }
      } else {
        console.warn(
          'Upload ke bucket foto_siswa gagal, menggunakan fallback terkompresi ke kolom foto_url:',
          uploadError.message
        );
      }
    } catch (err) {
      console.warn('Gagal menghubungi Supabase Storage foto_siswa:', err);
    }
  }

  // Fallback jika offline atau bucket belum dikonfigurasi: tetap kompres dan simpan ke kolom `foto_url` di tabel `siswa`
  if (!finalFotoUrl) {
    finalFotoUrl = await compressAndResizeImage(file, 360, 480, 0.85);
  }

  // Simpan `publicUrl` ke kolom `foto_url` pada tabel `siswa` di Supabase
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      if (studentId !== undefined && studentId !== null && !String(studentId).startsWith('std-')) {
        await supabase
          .from('siswa')
          .update({ foto_url: finalFotoUrl })
          .eq('id', studentId);
      } else if (safeNisn) {
        await supabase
          .from('siswa')
          .update({ foto_url: finalFotoUrl })
          .eq('nisn', safeNisn);
      }
    } catch (dbErr) {
      console.warn('Gagal menyimpan foto_url ke tabel siswa:', dbErr);
    }
  }

  return {
    publicUrl: finalFotoUrl,
    uploadedToBucket,
  };
}
