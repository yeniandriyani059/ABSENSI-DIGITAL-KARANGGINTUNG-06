import * as XLSX from 'xlsx';
import { Student } from '../types';

export function downloadStudentTemplate() {
  const templateData = [
    {
      NISN: '0123456701',
      'Nama Siswa': 'Ahmad Fauzi Pratama',
      'Jenis Kelamin': 'L',
      Kelas: '4',
      'Kode QR (Opsional)': '0123456701',
    },
    {
      NISN: '0123456702',
      'Nama Siswa': 'Siti Nurhaliza Putri',
      'Jenis Kelamin': 'P',
      Kelas: '4',
      'Kode QR (Opsional)': '0123456702',
    },
    {
      NISN: '0123456703',
      'Nama Siswa': 'Budi Santoso',
      'Jenis Kelamin': 'L',
      Kelas: '4',
      'Kode QR (Opsional)': '',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  ws['!cols'] = [
    { wch: 16 }, // NISN
    { wch: 28 }, // Nama Siswa
    { wch: 16 }, // Jenis Kelamin
    { wch: 10 }, // Kelas
    { wch: 22 }, // Kode QR
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');

  XLSX.writeFile(wb, 'Template_Data_Siswa_SDN06.xlsx');
}

export function exportStudentsToExcel(students: Student[], filename = 'Data_Siswa_SDN06.xlsx') {
  const exportData = students.map((s, idx) => ({
    No: idx + 1,
    NISN: s.nisn,
    'Nama Lengkap': s.name,
    'Jenis Kelamin': s.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)',
    Kelas: `Kelas ${s.classGrade}`,
    'Kode QR': s.qrCode || s.nisn,
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 12 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Siswa');
  XLSX.writeFile(wb, filename);
}

export async function parseStudentsFromExcel(file: File): Promise<{
  students: Omit<Student, 'id'>[];
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Read rows as array of objects
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const students: Omit<Student, 'id'>[] = [];
        const errors: string[] = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // account for header

          // Flexible header resolution
          const nisnRaw =
            row['NISN'] ?? row['nisn'] ?? row['Nisn'] ?? row['Nomor Induk'] ?? '';
          const nameRaw =
            row['Nama Siswa'] ??
            row['Nama'] ??
            row['nama'] ??
            row['Nama Lengkap'] ??
            '';
          const genderRaw =
            row['Jenis Kelamin'] ??
            row['JK'] ??
            row['jk'] ??
            row['Gender'] ??
            row['L/P'] ??
            'L';
          const classRaw =
            row['Kelas'] ?? row['kelas'] ?? row['Tingkat'] ?? row['Rombel'] ?? '4';
          const qrRaw =
            row['Kode QR (Opsional)'] ??
            row['Kode QR'] ??
            row['QR Code'] ??
            row['QR'] ??
            row['qr'] ??
            '';

          const nisn = String(nisnRaw).trim();
          const name = String(nameRaw).trim();
          let gender: 'L' | 'P' = 'L';
          const genderStr = String(genderRaw).trim().toUpperCase();
          if (genderStr.startsWith('P') || genderStr.includes('PEREMPUAN')) {
            gender = 'P';
          } else {
            gender = 'L';
          }

          // Clean class format (e.g., "Kelas 4" -> "4")
          const classMatch = String(classRaw).match(/[1-6]/);
          const classGrade = classMatch ? classMatch[0] : '4';

          const qrCode = qrRaw ? String(qrRaw).trim() : undefined;

          if (!name) {
            errors.push(`Baris ${rowNum}: Nama siswa kosong.`);
            return;
          }

          if (!nisn) {
            errors.push(`Baris ${rowNum} (${name}): NISN kosong.`);
            return;
          }

          students.push({
            nisn,
            name,
            gender,
            classGrade,
            qrCode: qrCode || nisn,
          });
        });

        resolve({ students, errors });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
