import React, { useState, useRef, useMemo } from 'react';
import {
  UserPlus,
  Trash2,
  Edit2,
  Users,
  Check,
  X,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
  QrCode,
  Eye,
  FileDown,
  CheckCircle2,
  Sparkles,
  Camera,
  Image as ImageIcon,
  User,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Student } from '../types';
import { StudentQRCode } from './StudentQRCode';
import {
  downloadStudentTemplate,
  exportStudentsToExcel,
  parseStudentsFromExcel,
} from '../utils/excelHelper';
import { compressAndResizeImage } from '../utils/imageExport';

interface StudentsManagerProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onBatchAddStudents?: (students: Omit<Student, 'id'>[]) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onRemoveDuplicates?: () => void;
}

export const StudentsManager: React.FC<StudentsManagerProps> = ({
  students,
  onAddStudent,
  onBatchAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onRemoveDuplicates,
}) => {
  const [selectedClass, setSelectedClass] = useState('4');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nisn, setNisn] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [classGrade, setClassGrade] = useState('4');
  const [qrCodeVal, setQrCodeVal] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');
  const [qrUploadSuccess, setQrUploadSuccess] = useState('');

  // Delete confirmation modal state
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

  // QR preview modal
  const [previewQrStudent, setPreviewQrStudent] = useState<Student | null>(null);

  // Excel Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Omit<Student, 'id'>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);

  // Hidden file inputs
  const qrImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  // Detect duplicate NISNs across all students
  const duplicateNisns = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((s) => {
      const k = s.nisn.trim();
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries()).filter(([_, count]) => count > 1);
  }, [students]);

  // Filter students by class
  const filteredStudents =
    selectedClass === 'all'
      ? students
      : students.filter((s) => s.classGrade === selectedClass);

  const resetForm = () => {
    setNisn('');
    setName('');
    setGender('L');
    setClassGrade(selectedClass === 'all' ? '4' : selectedClass);
    setQrCodeVal('');
    setPhotoUrl('');
    setError('');
    setQrUploadSuccess('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartAdd = () => {
    resetForm();
    setClassGrade(selectedClass === 'all' ? '4' : selectedClass);
    setIsAdding(true);
  };

  const handleStartEdit = (student: Student) => {
    setEditingId(student.id);
    setNisn(student.nisn);
    setName(student.name);
    setGender(student.gender);
    setClassGrade(student.classGrade);
    setQrCodeVal(student.qrCode || student.nisn);
    setPhotoUrl(student.photoUrl || '');
    setIsAdding(false);
    setError('');
    setQrUploadSuccess('');
  };

  // Process uploaded student portrait photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressAndResizeImage(file, 360, 480, 0.85);
      setPhotoUrl(compressed);
    } catch (err) {
      alert('Gagal memproses gambar foto. Pastikan format berkas berupa gambar JPG atau PNG.');
    }
    e.target.value = '';
  };

  // Decode uploaded QR code image to set qrCodeVal
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Create temporary HTML container for scanner if needed
      const tempId = 'temp-qr-image-decoder';
      let el = document.getElementById(tempId);
      if (!el) {
        el = document.createElement('div');
        el.id = tempId;
        el.style.display = 'none';
        document.body.appendChild(el);
      }

      const html5Qr = new Html5Qrcode(tempId);
      const decoded = await html5Qr.scanFile(file, true);

      setQrCodeVal(decoded.trim());
      setQrUploadSuccess(`Berhasil membaca QR Code: "${decoded.trim()}"`);
      setTimeout(() => setQrUploadSuccess(''), 4000);
    } catch (err) {
      setError('Tidak dapat membaca QR Code dari berkas gambar. Pastikan gambar jelas.');
      setTimeout(() => setError(''), 4000);
    }

    e.target.value = '';
  };

  // Handle Excel file selection
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    try {
      const { students: parsed, errors } = await parseStudentsFromExcel(file);
      setImportPreview(parsed);
      setImportErrors(errors);
      setIsImportModalOpen(true);
    } catch (err) {
      alert('Gagal membaca file Excel/CSV. Pastikan format file sesuai.');
    }
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;
    setImporting(true);

    if (onBatchAddStudents) {
      onBatchAddStudents(importPreview);
    } else {
      // Fallback one by one
      importPreview.forEach((s) => onAddStudent(s));
    }

    setImporting(false);
    setIsImportModalOpen(false);
    setImportPreview([]);
    setImportErrors([]);
    alert(`Berhasil mengimpor ${importPreview.length} data siswa ke dalam sistem!`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nisn.trim() || !name.trim()) {
      setError('Harap isi NISN dan Nama Lengkap Siswa!');
      return;
    }

    const finalQr = qrCodeVal.trim() || nisn.trim();

    if (editingId) {
      onUpdateStudent({
        id: editingId,
        nisn: nisn.trim(),
        name: name.trim(),
        gender,
        classGrade,
        qrCode: finalQr,
        photoUrl: photoUrl || undefined,
      });
    } else {
      onAddStudent({
        nisn: nisn.trim(),
        name: name.trim(),
        gender,
        classGrade,
        qrCode: finalQr,
        photoUrl: photoUrl || undefined,
      });
    }

    resetForm();
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={photoFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />
      <input
        type="file"
        ref={qrImageFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleQrImageUpload}
      />
      <input
        type="file"
        ref={excelFileInputRef}
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleExcelFileChange}
      />

      {/* Header and Action Buttons */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Manajemen Data Siswa & QR Code
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Kelola data peserta didik, buat dan unggah QR Code presensi, atau impor siswa massal via Excel.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadStudentTemplate}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Unduh format template Excel untuk data siswa"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              Unduh Template Excel
            </button>

            <button
              onClick={() => excelFileInputRef.current?.click()}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
              title="Unggah berkas Excel data siswa"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              Unggah Excel (Impor)
            </button>

            <button
              onClick={() => exportStudentsToExcel(students)}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Ekspor seluruh data siswa ke berkas Excel"
            >
              <Download className="w-4 h-4 text-slate-600" />
              Ekspor Excel
            </button>

            <button
              onClick={handleStartAdd}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Siswa
            </button>
          </div>
        </div>

        {/* Class Filter Tabs */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => {
              setSelectedClass('all');
              resetForm();
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedClass === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>Semua Kelas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedClass === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {students.length}
            </span>
          </button>

          {['1', '2', '3', '4', '5', '6'].map((cls) => {
            const count = students.filter((s) => s.classGrade === cls).length;
            const isActive = selectedClass === cls;
            return (
              <button
                key={cls}
                onClick={() => {
                  setSelectedClass(cls);
                  resetForm();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Kelas {cls}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add or Edit Modal / Form Card */}
      {(isAdding || editingId) && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-xl border-2 border-emerald-500 shadow-sm space-y-5 animate-fade-in"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {editingId ? (
                <Edit2 className="w-4 h-4 text-amber-600" />
              ) : (
                <UserPlus className="w-4 h-4 text-emerald-600" />
              )}
              {editingId ? 'Edit Data Siswa & QR Code' : 'Tambah Siswa Baru & Atur QR Code'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {qrUploadSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{qrUploadSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left inputs */}
            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  NISN (10 Digit) *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 0123456789"
                  value={nisn}
                  onChange={(e) => {
                    setNisn(e.target.value);
                    if (!qrCodeVal || qrCodeVal === nisn) {
                      setQrCodeVal(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rombel Kelas *
                </label>
                <select
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="1">Kelas 1</option>
                  <option value="2">Kelas 2</option>
                  <option value="3">Kelas 3</option>
                  <option value="4">Kelas 4</option>
                  <option value="5">Kelas 5</option>
                  <option value="6">Kelas 6</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  placeholder="Nama lengkap sesuai data Dapodik / Akta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Jenis Kelamin *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span>Isi Nilai QR Code Presensi</span>
                  <span className="text-[10px] text-slate-400 font-normal">Default: NISN</span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Sama dengan NISN atau ID Kartu"
                    value={qrCodeVal}
                    onChange={(e) => setQrCodeVal(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => qrImageFileInputRef.current?.click()}
                    className="px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                    title="Unggah berkas foto/gambar QR Code untuk membaca kodenya secara otomatis"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Upload QR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Student Photo & QR Code Previews */}
            <div className="md:col-span-5 grid grid-cols-2 gap-3">
              {/* Photo Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center">
                <div className="w-full">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Foto Siswa (KTS)</span>
                  </div>

                  <div className="w-24 h-28 mx-auto bg-white rounded-lg border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center shadow-2xs relative group">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Pratinjau Foto Siswa"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        <User className="w-8 h-8 stroke-1" />
                        <span className="text-[10px] mt-1 font-medium">Belum Ada Foto</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full space-y-1 mt-2.5">
                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
                  </button>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="w-full px-2 py-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>
              </div>

              {/* QR Code Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col items-center justify-between text-center">
                <div className="w-full">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    <span>QR Presensi</span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs inline-block">
                    <StudentQRCode
                      value={qrCodeVal.trim() || nisn.trim() || 'SDN06-PREVIEW'}
                      size={86}
                    />
                  </div>
                </div>

                <div className="w-full mt-2">
                  <div className="text-[10px] font-mono font-bold text-slate-800 truncate">
                    {qrCodeVal.trim() || nisn.trim() || '0000000000'}
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    Otomatis di ID Card
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {editingId ? 'Perbarui Data & QR' : 'Simpan Siswa & Buat QR'}
            </button>
          </div>
        </form>
      )}

      {/* Success / Feedback Toast */}
      {deleteSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between gap-2 text-sm shadow-xs animate-fade-in">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessMsg('')}
            className="text-emerald-600 hover:text-emerald-900 p-1 text-sm font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Duplicate NISN Warning Banner & Auto Clean Button */}
      {duplicateNisns.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                Terdeteksi {duplicateNisns.length} Data Siswa Ganda (NISN Dobel)
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Terdapat NISN yang terdaftar lebih dari satu kali ({duplicateNisns.map(([n]) => n).join(', ')}).
                Hapus siswa duplikat menggunakan tombol sampah di tabel atau klik tombol di samping.
              </p>
            </div>
          </div>
          {onRemoveDuplicates && (
            <button
              type="button"
              onClick={() => {
                onRemoveDuplicates();
                setDeleteSuccessMsg(`Berhasil membersihkan ${duplicateNisns.length} data siswa yang dobel.`);
                setTimeout(() => setDeleteSuccessMsg(''), 4000);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Bersihkan Data Dobel
            </button>
          )}
        </div>
      )}

      {/* Table of Students */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-800 text-sm">
            Daftar Siswa {selectedClass === 'all' ? 'Semua Kelas' : `Kelas ${selectedClass}`} (
            {filteredStudents.length} Siswa)
          </div>
          <div className="text-xs text-slate-500">
            Mendukung QR Code & Barcode untuk presensi
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-3.5 text-center w-12">No</th>
                <th className="p-3.5 text-center w-16">Foto</th>
                <th className="p-3.5 text-center w-24">QR Code</th>
                <th className="p-3.5 text-center w-32">NISN</th>
                <th className="p-3.5">Nama Siswa</th>
                <th className="p-3.5 text-center w-20">Kelas</th>
                <th className="p-3.5 text-center w-24">L/P</th>
                <th className="p-3.5 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-sm">
                    Belum ada data siswa untuk kelas ini. Klik &quot;Tambah Siswa&quot; atau &quot;Unggah Excel&quot; untuk menambahkan siswa.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-center text-slate-500 text-xs">{idx + 1}</td>

                    {/* Photo thumbnail */}
                    <td className="p-2 text-center">
                      <div className="w-9 h-11 mx-auto bg-slate-100 rounded-md border border-slate-200 overflow-hidden flex items-center justify-center shadow-2xs">
                        {s.photoUrl ? (
                          <img
                            src={s.photoUrl}
                            alt={s.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-400 flex flex-col items-center">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* QR Code thumbnail */}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewQrStudent(s)}
                        className="p-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer group shadow-2xs"
                        title="Klik untuk melihat dan mengunduh QR Code"
                      >
                        <StudentQRCode value={s.qrCode || s.nisn} size={36} />
                      </button>
                    </td>

                    <td className="p-3 text-center font-mono text-xs text-slate-700 font-bold">
                      {s.nisn}
                    </td>

                    <td className="p-3 font-semibold text-slate-800">
                      <div>{s.name}</div>
                      {s.qrCode && s.qrCode !== s.nisn && (
                        <div className="text-[10px] font-mono text-emerald-700 font-normal">
                          Custom QR: {s.qrCode}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center text-xs font-semibold text-slate-700">
                      Kelas {s.classGrade}
                    </td>

                    <td className="p-3 text-center text-xs">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md font-semibold ${
                          s.gender === 'L'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-pink-50 text-pink-700 border border-pink-200'
                        }`}
                      >
                        {s.gender === 'L' ? 'L' : 'P'}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setPreviewQrStudent(s)}
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          title="Lihat QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(s)}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                          title="Edit Siswa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(s)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100/70 rounded-md transition-colors cursor-pointer"
                          title="Hapus Siswa (Cegah Dobel)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Siswa (Bebas dari window.confirm yang sering diblokir peramban/iframe) */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base text-slate-900">
                  Hapus Data Siswa Ini?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tindakan ini akan menghapus siswa secara permanen dari basis data presensi agar tidak terjadi data ganda / dobel.
                </p>
              </div>
            </div>

            {/* Kartu Profil Siswa Yang Akan Dihapus */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
              <div className="w-12 h-14 bg-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-slate-700 font-bold border border-slate-300">
                {studentToDelete.photoUrl ? (
                  <img
                    src={studentToDelete.photoUrl}
                    alt={studentToDelete.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg">{studentToDelete.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-sm truncate">
                  {studentToDelete.name}
                </h4>
                <p className="text-xs text-slate-600 font-mono">
                  NISN: <span className="font-semibold text-emerald-800">{studentToDelete.nisn}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Kelas {studentToDelete.classGrade} &bull;{' '}
                  <span className="font-medium">
                    {studentToDelete.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedName = studentToDelete.name;
                  onDeleteStudent(studentToDelete.id);
                  setStudentToDelete(null);
                  setDeleteSuccessMsg(`Data siswa "${deletedName}" berhasil dihapus dari sistem.`);
                  setTimeout(() => setDeleteSuccessMsg(''), 4000);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ya, Hapus Data Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Single Preview Modal */}
      {previewQrStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600" />
                QR Code Siswa
              </h3>
              <button
                type="button"
                onClick={() => setPreviewQrStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 inline-block mx-auto">
              <StudentQRCode
                value={previewQrStudent.qrCode || previewQrStudent.nisn}
                size={180}
              />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-base">{previewQrStudent.name}</h4>
              <p className="font-mono text-xs font-semibold text-emerald-800">
                NISN: {previewQrStudent.nisn}
              </p>
              <p className="text-xs text-slate-500">
                Kelas {previewQrStudent.classGrade}
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewQrStudent(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Pratinjau Impor Data Siswa ({importFileName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Error notifications if any */}
            {importErrors.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Ditemukan {importErrors.length} baris tidak lengkap / diabaikan:</span>
                </div>
                <ul className="list-disc pl-5 max-h-20 overflow-y-auto space-y-0.5">
                  {importErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-slate-600 flex items-center justify-between">
              <span>
                Ditemukan <strong>{importPreview.length} calon siswa valid</strong> yang siap dimasukkan ke sistem.
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                Valid
              </span>
            </div>

            {/* Table of preview */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                  <tr>
                    <th className="p-2.5 text-center w-10">No</th>
                    <th className="p-2.5 text-center w-28">NISN</th>
                    <th className="p-2.5">Nama Siswa</th>
                    <th className="p-2.5 text-center w-14">L/P</th>
                    <th className="p-2.5 text-center w-16">Kelas</th>
                    <th className="p-2.5">Kode QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importPreview.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-2.5 text-center font-mono font-semibold text-slate-800">
                        {s.nisn}
                      </td>
                      <td className="p-2.5 font-medium text-slate-900">{s.name}</td>
                      <td className="p-2.5 text-center font-semibold text-slate-600">
                        {s.gender}
                      </td>
                      <td className="p-2.5 text-center font-bold text-emerald-700">
                        Kelas {s.classGrade}
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">
                        {s.qrCode || s.nisn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importing || importPreview.length === 0}
                onClick={handleConfirmImport}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {importing ? 'Mengimpor...' : `Impor ${importPreview.length} Siswa`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
